# frozen_string_literal: true

# SketchUp-MCP-Bridge — 核心服务端
# 职责: 在 SketchUp 内部启动轻量 TCP HTTP Server,
#       通过主线程定时器安全调度 SketchUp Ruby API 调用。
#
# 架构:
#   [MCP Server / LLM] --HTTP POST--> [TCPServer 后台线程]
#       --> [请求队列] --UI.start_timer轮询--> [主线程执行 API]
#       --> [响应回写 socket]
#
# 线程安全: SketchUp Ruby API 仅允许在主线程调用,
#           因此所有 API 操作必须经由 timer 回调在主线程执行。

require 'socket'
require 'json'
require 'thread'

module MCPBridge

  # ─────────────────────────────────────────────
  # 配置
  # ─────────────────────────────────────────────
  PORT            = 18234          # 监听端口, 避开常用端口段
  HOST            = '127.0.0.1'   # 仅本机回环, 安全隔离
  POLL_INTERVAL   = 0.05          # 主线程轮询间隔 (秒)
  MAX_BODY_SIZE   = 1024 * 1024   # 请求体上限 1MB

  # ─────────────────────────────────────────────
  # 请求队列 (线程安全)
  # ─────────────────────────────────────────────
  @queue  = Queue.new
  @server = nil
  @timer_id = nil
  @running  = false

  class << self
    attr_reader :queue, :running
  end

  # ─────────────────────────────────────────────
  # HTTP 协议解析 (极简实现, 仅处理 POST)
  # ─────────────────────────────────────────────
  module HttpParser
    # 从 socket 读取一个完整的 HTTP 请求, 返回 [method, path, body]
    def self.read_request(client)
      # 读取请求行
      request_line = client.gets
      return nil unless request_line

      method, path, _version = request_line.strip.split(' ', 3)

      # 读取头部
      headers = {}
      while (line = client.gets)
        line = line.strip
        break if line.empty?
        key, value = line.split(':', 2)
        headers[key.strip.downcase] = value.strip if key && value
      end

      # 读取 body
      body = ''
      content_length = (headers['content-length'] || '0').to_i
      content_length = [content_length, MAX_BODY_SIZE].min
      if content_length > 0
        body = client.read(content_length)
      end

      [method, path, body]
    rescue IOError, Errno::ECONNRESET
      nil
    end

    # 构造 HTTP 响应
    def self.response(status_code, status_text, body_hash)
      json_body = JSON.generate(body_hash)
      "HTTP/1.1 #{status_code} #{status_text}\r\n" \
      "Content-Type: application/json; charset=utf-8\r\n" \
      "Content-Length: #{json_body.bytesize}\r\n" \
      "Connection: close\r\n" \
      "\r\n" \
      "#{json_body}"
    end
  end

  # ─────────────────────────────────────────────
  # TCP Server (后台线程)
  # ─────────────────────────────────────────────
  module Server
    def self.start
      return if MCPBridge.running

      @server = TCPServer.new(HOST, PORT)
      MCPBridge.instance_variable_set(:@running, true)

      Thread.new do
        loop do
          begin
            client = @server.accept
            Thread.new(client) { |c| handle_client(c) }
          rescue IOError, Errno::EBADF
            break # server 已关闭
          rescue => e
            MCPBridge.log_error("Accept error: #{e.message}")
          end
        end
      end

      MCPBridge.log_info("MCP Bridge server listening on #{HOST}:#{PORT}")
    end

    def self.stop
      MCPBridge.instance_variable_set(:@running, false)
      @server&.close rescue nil
      @server = nil
      MCPBridge.log_info("MCP Bridge server stopped")
    end

    def self.handle_client(client)
      method, path, body = HttpParser.read_request(client)

      unless method && path
        client.close rescue nil
        return
      end

      # 仅支持 POST /execute
      unless method == 'POST' && path == '/execute'
        resp = HttpParser.response(404, 'Not Found',
          { success: false, error: "Unknown endpoint: #{method} #{path}" })
        client.write(resp)
        client.close rescue nil
        return
      end

      # 解析 JSON body
      begin
        payload = JSON.parse(body)
      rescue JSON::ParserError => e
        resp = HttpParser.response(400, 'Bad Request',
          { success: false, error: "Invalid JSON: #{e.message}" })
        client.write(resp)
        client.close rescue nil
        return
      end

      # 将请求推入队列, 由主线程 timer 消费
      # 使用 SizedQueue 语义: 此处用普通 Queue + 同步等待
      response_ready = Queue.new
      MCPBridge.queue.push({ payload: payload, response_queue: response_ready })

      # 阻塞等待主线程处理完毕 (超时 30s)
      begin
        result = nil
        timeout_thread = Thread.new { sleep(30); response_ready.push(:__timeout__) }
        result = response_ready.pop
        timeout_thread.kill

        if result == :__timeout__
          resp = HttpParser.response(504, 'Gateway Timeout',
            { success: false, error: 'SketchUp main thread did not respond within 30s' })
        else
          resp = HttpParser.response(200, 'OK', result)
        end
      rescue => e
        resp = HttpParser.response(500, 'Internal Server Error',
          { success: false, error: "Bridge error: #{e.message}" })
      end

      client.write(resp)
      client.close rescue nil
    end
  end

  # ─────────────────────────────────────────────
  # 主线程调度器 (通过 UI.start_timer 轮询)
  # ─────────────────────────────────────────────
  module Dispatcher
    def self.start
      @timer_id = UI.start_timer(POLL_INTERVAL, true) do
        # 非阻塞地取出所有待处理请求
        until MCPBridge.queue.empty?
          begin
            request = MCPBridge.queue.pop(true) # non-blocking
            payload = request[:payload]
            response_queue = request[:response_queue]

            result = execute_action(payload)
            response_queue.push(result)
          rescue ThreadError
            break # 队列已空
          rescue => e
            response_queue&.push({ success: false, error: "Dispatcher error: #{e.message}" })
          end
        end
      end
    end

    def self.stop
      UI.stop_timer(@timer_id) if @timer_id
      @timer_id = nil
    end

    # 路由分发
    def self.execute_action(payload)
      action = payload['action']
      params = payload['params'] || {}

      case action
      when 'get_model_info'
        Actions.get_model_info(params)
      when 'query_dimensions'
        Actions.query_dimensions(params)
      when 'create_geometry'
        Actions.create_geometry(params)
      when 'set_camera_view'
        Actions.set_camera_view(params)
      when 'add_dimension'
        Actions.add_dimension(params)
      when 'annotate_component'
        Actions.annotate_component(params)
      when 'annotate_notches'
        Actions.annotate_notches(params)
      when 'ping'
        { success: true, data: { pong: true, version: PLUGIN_VERSION } }
      else
        { success: false, error: "Unknown action: #{action}" }
      end
    rescue => e
      { success: false, error: "#{e.class}: #{e.message}", backtrace: e.backtrace&.first(5) }
    end
  end

  # ─────────────────────────────────────────────
  # SketchUp API 操作实现
  # ─────────────────────────────────────────────
  module Actions

    # ── Tool 1: 获取模型基本信息 ──
    def self.get_model_info(_params)
      model = Sketchup.active_model
      unless model
        return { success: false, error: 'No active SketchUp model is open.' }
      end

      entities = model.active_entities

      # 统计各类图元
      group_count     = entities.grep(Sketchup::Group).length
      component_count = entities.grep(Sketchup::ComponentInstance).length
      face_count      = entities.grep(Sketchup::Face).length
      edge_count      = entities.grep(Sketchup::Edge).length

      # 当前选择集概览
      selection   = model.selection
      sel_summary = selection.map { |e| "#{e.typename}(#{e.entityID})" }.first(20)

      # 模型单位
      unit_opts = model.options['UnitsOptions']
      unit_map = { 0 => 'inches', 1 => 'feet', 2 => 'millimeters', 3 => 'centimeters', 4 => 'meters' }
      unit = unit_map[unit_opts['LengthUnit']] || 'unknown'

      # 模型路径
      path = model.path
      name = path.empty? ? '(untitled)' : File.basename(path)

      {
        success: true,
        data: {
          file_name: name,
          file_path: path.empty? ? nil : path,
          unit: unit,
          entities: {
            groups: group_count,
            component_instances: component_count,
            faces: face_count,
            edges: edge_count
          },
          selection: {
            count: selection.length,
            items: sel_summary
          },
          layers_count: model.layers.length,
          pages_count: model.pages.length
        }
      }
    end

    # ── Tool 2: 查询物体包围盒尺寸 ──
    def self.query_dimensions(params)
      model = Sketchup.active_model
      unless model
        return { success: false, error: 'No active SketchUp model is open.' }
      end

      name_or_id = params['name']
      unless name_or_id
        return { success: false, error: "Missing required param 'name' (component/group name or entity ID)." }
      end

      entities = model.active_entities
      target = nil

      # 尝试按 entityID 查找 (纯数字)
      if name_or_id.to_s =~ /\A\d+\z/
        target = entities.grep(Sketchup::Drawingelement).find { |e| e.entityID == name_or_id.to_i }
      end

      # 按名称查找 (Group 或 ComponentInstance)
      unless target
        target = entities.find do |e|
          next false unless e.is_a?(Sketchup::Group) || e.is_a?(Sketchup::ComponentInstance)
          if e.is_a?(Sketchup::Group)
            e.name == name_or_id
          else
            e.definition.name == name_or_id || e.name == name_or_id
          end
        end
      end

      unless target
        return { success: false, error: "Entity '#{name_or_id}' not found in active entities." }
      end

      # 获取包围盒 (世界坐标)
      bb = target.bounds
      min = bb.min
      max = bb.max

      # 转换为模型单位长度
      width  = (max.x - min.x)
      depth  = (max.y - min.y)
      height = (max.z - min.z)

      {
        success: true,
        data: {
          entity_type: target.typename,
          entity_id: target.entityID,
          name: target.respond_to?(:name) ? target.name : nil,
          bounding_box: {
            min: { x: min.x.to_f, y: min.y.to_f, z: min.z.to_f },
            max: { x: max.x.to_f, y: max.y.to_f, z: max.z.to_f },
            width:  width.to_f,
            depth:  depth.to_f,
            height: height.to_f,
            diagonal: bb.diagonal.to_f
          }
        }
      }
    end

    # ── Tool 3: 创建几何体 (立方体/墙体) 并打组 ──
    def self.create_geometry(params)
      model = Sketchup.active_model
      unless model
        return { success: false, error: 'No active SketchUp model is open.' }
      end

      # 参数提取 (单位: 英寸, SketchUp 内部单位)
      width  = (params['width']  || 10).to_f
      depth  = (params['depth']  || 10).to_f
      height = (params['height'] || 10).to_f
      origin = params['origin'] || { 'x' => 0, 'y' => 0, 'z' => 0 }
      group_name = params['name'] || 'MCP_Box'

      ox = (origin['x'] || 0).to_f
      oy = (origin['y'] || 0).to_f
      oz = (origin['z'] || 0).to_f

      # 参数校验
      if width <= 0 || depth <= 0 || height <= 0
        return { success: false, error: 'Dimensions (width/depth/height) must be positive.' }
      end

      result = nil

      model.start_operation('MCP Create Geometry', true)
      begin
        entities = model.active_entities

        # 创建组
        group = entities.add_group
        group.name = group_name

        ge = group.entities

        # 底面矩形
        pt1 = Geom::Point3d.new(ox, oy, oz)
        pt2 = Geom::Point3d.new(ox + width, oy, oz)
        pt3 = Geom::Point3d.new(ox + width, oy + depth, oz)
        pt4 = Geom::Point3d.new(ox, oy + depth, oz)

        face = ge.add_face(pt1, pt2, pt3, pt4)

        # 推拉成体
        if face
          face.pushpull(height)
        end

        model.commit_operation

        # 返回创建结果
        bb = group.bounds
        result = {
          success: true,
          data: {
            entity_type: 'Group',
            entity_id: group.entityID,
            name: group_name,
            dimensions: { width: width, depth: depth, height: height },
            origin: { x: ox, y: oy, z: oz },
            bounding_box: {
              min: { x: bb.min.x.to_f, y: bb.min.y.to_f, z: bb.min.z.to_f },
              max: { x: bb.max.x.to_f, y: bb.max.y.to_f, z: bb.max.z.to_f }
            }
          }
        }
      rescue => e
        model.abort_operation
        return { success: false, error: "Geometry creation failed: #{e.message}" }
      end

      result
    end

    # ── Tool 4: 设置相机视角 ──
    def self.set_camera_view(params)
      model = Sketchup.active_model
      unless model
        return { success: false, error: 'No active SketchUp model is open.' }
      end

      eye    = params['eye']
      target = params['target']
      up     = params['up'] || { 'x' => 0, 'y' => 0, 'z' => 1 }

      unless eye && target
        return { success: false, error: "Missing required params 'eye' and 'target' (each with x/y/z)." }
      end

      begin
        eye_pt    = Geom::Point3d.new(eye['x'].to_f,    eye['y'].to_f,    eye['z'].to_f)
        target_pt = Geom::Point3d.new(target['x'].to_f, target['y'].to_f, target['z'].to_f)
        up_vec    = Geom::Vector3d.new(up['x'].to_f,    up['y'].to_f,    up['z'].to_f)

        # 校验: eye 和 target 不能重合
        if eye_pt.distance(target_pt) < 0.001
          return { success: false, error: "'eye' and 'target' must not be the same point." }
        end

        view   = model.active_view
        camera = view.camera

        # 设置为透视相机 (非平行投影)
        camera.perspective = true
        camera.set(eye_pt, target_pt, up_vec)

        view.refresh

        {
          success: true,
          data: {
            eye:    { x: eye_pt.x.to_f,    y: eye_pt.y.to_f,    z: eye_pt.z.to_f },
            target: { x: target_pt.x.to_f, y: target_pt.y.to_f, z: target_pt.z.to_f },
            up:     { x: up_vec.x.to_f,    y: up_vec.y.to_f,    z: up_vec.z.to_f },
            perspective: true
          }
        }
      rescue => e
        { success: false, error: "Camera setup failed: #{e.message}" }
      end
    end

    # ── Tool 5: 添加尺寸标注线 ──
    def self.add_dimension(params)
      model = Sketchup.active_model
      unless model
        return { success: false, error: 'No active SketchUp model is open.' }
      end

      # 参数: point1, point2 (各含 x/y/z), offset_vector (含 x/y/z, 可选)
      pt1_data = params['point1']
      pt2_data = params['point2']
      offset_data = params['offset_vector'] || { 'x' => 0, 'y' => 0, 'z' => 1 }

      unless pt1_data && pt2_data
        return { success: false, error: "Missing required params 'point1' and 'point2' (each with x/y/z)." }
      end

      begin
        pt1 = Geom::Point3d.new(pt1_data['x'].to_f, pt1_data['y'].to_f, pt1_data['z'].to_f)
        pt2 = Geom::Point3d.new(pt2_data['x'].to_f, pt2_data['y'].to_f, pt2_data['z'].to_f)
        offset_vec = Geom::Vector3d.new(offset_data['x'].to_f, offset_data['y'].to_f, offset_data['z'].to_f)

        # 校验: 两点不能重合
        if pt1.distance(pt2) < 0.001
          return { success: false, error: "'point1' and 'point2' must not be the same point." }
        end

        # 校验: offset 不能为零向量
        if offset_vec.length < 0.001
          return { success: false, error: "'offset_vector' must not be a zero vector." }
        end

        result = nil

        model.start_operation('MCP Add Dimension', true)
        begin
          entities = model.active_entities

          # 创建线性尺寸标注
          dim = entities.add_dimension_linear(pt1, pt2, offset_vec)

          # 可选: 自定义标注文字
          custom_text = params['text']
          if custom_text && !custom_text.empty?
            dim.text = custom_text
          end

          model.commit_operation

          # 返回标注信息
          result = {
            success: true,
            data: {
              entity_type: 'DimensionLinear',
              entity_id: dim.entityID,
              point1: { x: pt1.x.to_f, y: pt1.y.to_f, z: pt1.z.to_f },
              point2: { x: pt2.x.to_f, y: pt2.y.to_f, z: pt2.z.to_f },
              offset_vector: { x: offset_vec.x.to_f, y: offset_vec.y.to_f, z: offset_vec.z.to_f },
              measured_length: pt1.distance(pt2).to_f,
              text: dim.text
            }
          }
        rescue => e
          model.abort_operation
          return { success: false, error: "Dimension creation failed: #{e.message}" }
        end

        result
      rescue => e
        { success: false, error: "Dimension setup error: #{e.message}" }
      end
    end

    # ── Tool 6: 批量标注组件/群组内所有子实体 ──
    def self.annotate_component(params)
      model = Sketchup.active_model
      unless model
        return { success: false, error: 'No active SketchUp model is open.' }
      end

      name_or_id = params['name']
      unless name_or_id
        return { success: false, error: "Missing required param 'name' (component/group name or entity ID)." }
      end

      # 偏移距离 (英寸), 控制标注线离物体的距离
      offset_dist = (params['offset'] || 3.0).to_f

      entities = model.active_entities
      target = nil

      # 按 entityID 查找
      if name_or_id.to_s =~ /\A\d+\z/
        target = entities.find { |e| e.entityID == name_or_id.to_i }
      end

      # 按名称查找
      unless target
        target = entities.find do |e|
          next false unless e.is_a?(Sketchup::Group) || e.is_a?(Sketchup::ComponentInstance)
          if e.is_a?(Sketchup::Group)
            e.name == name_or_id
          else
            e.definition.name == name_or_id || e.name == name_or_id
          end
        end
      end

      unless target
        return { success: false, error: "Entity '#{name_or_id}' not found in active entities." }
      end

      # 获取组件/群组内部实体
      inner_entities = if target.is_a?(Sketchup::Group)
                         target.entities
                       else
                         target.definition.entities
                       end

      # 收集需要标注的子实体 (Group, ComponentInstance, Face)
      children = inner_entities.grep(Sketchup::Group) +
                 inner_entities.grep(Sketchup::ComponentInstance) +
                 inner_entities.grep(Sketchup::Face)

      if children.empty?
        return { success: false, error: "No annotatable sub-entities found inside '#{name_or_id}'." }
      end

      results = []
      dim_count = 0

      model.start_operation('MCP Annotate Component', true)
      begin
        # 在模型顶层 active_entities 上添加标注 (世界坐标)
        # 获取组件的世界变换
        world_transform = target.transformation

        children.each_with_index do |child, idx|
          # 计算子实体的世界坐标包围盒
          local_bb = child.bounds
          world_bb = Geom::BoundingBox.new
          # 变换包围盒的 8 个角点
          corners = [
            Geom::Point3d.new(local_bb.min.x, local_bb.min.y, local_bb.min.z),
            Geom::Point3d.new(local_bb.max.x, local_bb.min.y, local_bb.min.z),
            Geom::Point3d.new(local_bb.min.x, local_bb.max.y, local_bb.min.z),
            Geom::Point3d.new(local_bb.max.x, local_bb.max.y, local_bb.min.z),
            Geom::Point3d.new(local_bb.min.x, local_bb.min.y, local_bb.max.z),
            Geom::Point3d.new(local_bb.max.x, local_bb.min.y, local_bb.max.z),
            Geom::Point3d.new(local_bb.min.x, local_bb.max.y, local_bb.max.z),
            Geom::Point3d.new(local_bb.max.x, local_bb.max.y, local_bb.max.z)
          ]
          corners.each { |pt| world_bb.add(pt.transform(world_transform)) }

          wmin = world_bb.min
          wmax = world_bb.max

          width  = (wmax.x - wmin.x).to_f
          depth  = (wmax.y - wmin.y).to_f
          height = (wmax.z - wmin.z).to_f

          # 跳过退化实体 (某维度为 0)
          next if width < 0.01 && depth < 0.01 && height < 0.01

          child_name = if child.respond_to?(:name) && !child.name.to_s.empty?
                         child.name
                       elsif child.is_a?(Sketchup::ComponentInstance)
                         child.definition.name
                       else
                         "#{child.typename}_#{idx}"
                       end

          child_dims = []

          # 宽度标注 (X 方向, 沿前缘, 向 -Y 偏移)
          if width > 0.01
            pt1 = Geom::Point3d.new(wmin.x, wmin.y, wmin.z)
            pt2 = Geom::Point3d.new(wmax.x, wmin.y, wmin.z)
            off = Geom::Vector3d.new(0, -offset_dist, 0)
            dim = entities.add_dimension_linear(pt1, pt2, off)
            child_dims << { axis: 'width', text: dim.text, entity_id: dim.entityID }
            dim_count += 1
          end

          # 进深标注 (Y 方向, 沿左缘, 向 -X 偏移)
          if depth > 0.01
            pt1 = Geom::Point3d.new(wmin.x, wmin.y, wmin.z)
            pt2 = Geom::Point3d.new(wmin.x, wmax.y, wmin.z)
            off = Geom::Vector3d.new(-offset_dist, 0, 0)
            dim = entities.add_dimension_linear(pt1, pt2, off)
            child_dims << { axis: 'depth', text: dim.text, entity_id: dim.entityID }
            dim_count += 1
          end

          # 高度标注 (Z 方向, 沿右后角, 向 +X 偏移)
          if height > 0.01
            pt1 = Geom::Point3d.new(wmax.x, wmax.y, wmin.z)
            pt2 = Geom::Point3d.new(wmax.x, wmax.y, wmax.z)
            off = Geom::Vector3d.new(offset_dist, 0, 0)
            dim = entities.add_dimension_linear(pt1, pt2, off)
            child_dims << { axis: 'height', text: dim.text, entity_id: dim.entityID }
            dim_count += 1
          end

          results << {
            name: child_name,
            type: child.typename,
            entity_id: child.entityID,
            dimensions: child_dims
          }
        end

        model.commit_operation
      rescue => e
        model.abort_operation
        return { success: false, error: "Batch annotation failed: #{e.message}" }
      end

      {
        success: true,
        data: {
          parent: name_or_id,
          children_annotated: results.length,
          total_dimension_lines: dim_count,
          details: results
        }
      }
    end

    # ── Tool 7: 缺角(凹口)检测与标注 ──
    # 对组件内每块板材的顶面轮廓进行分析: 矩形(4顶点)无缺角跳过;
    # 非矩形轮廓中, 不落在包围盒边界上的边即为缺角边, 逐条生成尺寸标注。
    def self.annotate_notches(params)
      model = Sketchup.active_model
      unless model
        return { success: false, error: 'No active SketchUp model is open.' }
      end

      name_or_id = params['name']
      unless name_or_id
        return { success: false, error: "Missing required param 'name' (component/group name or entity ID)." }
      end

      # 标注线偏移距离 (英寸), 指向缺角内部空腔, 保证读数不压在实体上
      offset_dist = (params['offset'] || 1.5).to_f

      entities = model.active_entities
      target = nil

      if name_or_id.to_s =~ /\A\d+\z/
        target = entities.find { |e| e.entityID == name_or_id.to_i }
      end
      unless target
        target = entities.find do |e|
          next false unless e.is_a?(Sketchup::Group) || e.is_a?(Sketchup::ComponentInstance)
          if e.is_a?(Sketchup::Group)
            e.name == name_or_id
          else
            e.definition.name == name_or_id || e.name == name_or_id
          end
        end
      end

      unless target
        return { success: false, error: "Entity '#{name_or_id}' not found in active entities." }
      end

      inner_entities = target.is_a?(Sketchup::Group) ? target.entities : target.definition.entities
      children = inner_entities.grep(Sketchup::Group) + inner_entities.grep(Sketchup::ComponentInstance)

      if children.empty?
        return { success: false, error: "No board sub-entities found inside '#{name_or_id}'." }
      end

      results = []
      dim_count = 0

      model.start_operation('MCP Annotate Notches', true)
      begin
        world_tf = target.transformation

        children.each_with_index do |child, idx|
          child_ents = child.is_a?(Sketchup::Group) ? child.entities : child.definition.entities
          faces = child_ents.grep(Sketchup::Face)
          next if faces.empty?

          # 选取顶面: 法线接近本地 +Z 且面积最大的面; 找不到则退化为最大面
          top_faces = faces.select { |f| f.normal.z > 0.9 }
          face = top_faces.max_by(&:area) || faces.max_by(&:area)
          next unless face

          loop_verts = face.outer_loop.vertices.map(&:position)
          # 矩形只有 4 顶点, 无缺角; 至少 5 顶点才可能是缺角轮廓
          next if loop_verts.length < 5

          # 根据面法线确定平面主轴 (板材平放, 法线指向厚度方向)
          n = face.normal
          ax = n.x.abs; ay = n.y.abs; az = n.z.abs
          if az >= ax && az >= ay
            u_axis = 0; v_axis = 1   # 法线≈Z, 平面为 XY
          elsif ay >= ax && ay >= az
            u_axis = 0; v_axis = 2   # 法线≈Y, 平面为 XZ
          else
            u_axis = 1; v_axis = 2   # 法线≈X, 平面为 YZ
          end

          # 投影到二维
          pts2d = loop_verts.map { |p| a = p.to_a; [a[u_axis], a[v_axis]] }

          # 用有向面积保证轮廓为逆时针 (CCW), 便于统一判定缺角内侧方向
          area2 = 0.0
          (0...pts2d.length).each do |i|
            x1, y1 = pts2d[i]
            x2, y2 = pts2d[(i + 1) % pts2d.length]
            area2 += (x1 * y2 - x2 * y1)
          end
          if area2 < 0
            loop_verts = loop_verts.reverse
            pts2d = pts2d.reverse
          end

          # 二维包围盒
          us = pts2d.map { |p| p[0] }
          vs = pts2d.map { |p| p[1] }
          umin, umax = us.min, us.max
          vmin, vmax = vs.min, vs.max

          eps = 0.001
          # 边的两个端点若都落在同一条包围盒边上, 则属于外轮廓, 不是缺角边
          on_bbox = lambda do |a, b|
            ((a[0] - umin).abs < eps && (b[0] - umin).abs < eps) ||
            ((a[0] - umax).abs < eps && (b[0] - umax).abs < eps) ||
            ((a[1] - vmin).abs < eps && (b[1] - vmin).abs < eps) ||
            ((a[1] - vmax).abs < eps && (b[1] - vmax).abs < eps)
          end

          child_tf = child.transformation
          combined_tf = world_tf * child_tf

          # 收集缺角边
          notch_edges = []
          (0...pts2d.length).each do |i|
            a2 = pts2d[i]
            b2 = pts2d[(i + 1) % pts2d.length]
            next if on_bbox.call(a2, b2)
            notch_edges << [loop_verts[i], loop_verts[(i + 1) % pts2d.length], a2, b2]
          end

          next if notch_edges.empty?

          child_name = if child.respond_to?(:name) && !child.name.to_s.empty?
                         child.name
                       elsif child.is_a?(Sketchup::ComponentInstance)
                         child.definition.name
                       else
                         "board_#{idx}"
                       end

          edge_dims = []
          notch_edges.each do |p1_3d, p2_3d, a2, b2|
            dx = b2[0] - a2[0]
            dy = b2[1] - a2[1]
            len = Math.sqrt(dx * dx + dy * dy)
            next if len < eps

            # CCW 轮廓中, 缺角空腔位于边的右侧, 右法线 = (dy, -dx)
            off_u =  dy / len * offset_dist
            off_v = -dx / len * offset_dist

            off3 = [0.0, 0.0, 0.0]
            off3[u_axis] = off_u
            off3[v_axis] = off_v
            off_vec_local = Geom::Vector3d.new(off3[0], off3[1], off3[2])

            w1 = p1_3d.transform(combined_tf)
            w2 = p2_3d.transform(combined_tf)
            w_off = off_vec_local.transform(combined_tf)

            dim = entities.add_dimension_linear(w1, w2, w_off)
            dim_count += 1
            edge_dims << {
              length_text: dim.text,
              entity_id: dim.entityID,
              from: { u: a2[0], v: a2[1] },
              to:   { u: b2[0], v: b2[1] }
            }
          end

          results << {
            name: child_name,
            type: child.typename,
            entity_id: child.entityID,
            outline_vertices: loop_verts.length,
            notch_dimensions: edge_dims
          }
        end

        model.commit_operation
      rescue => e
        model.abort_operation
        return { success: false, error: "Notch annotation failed: #{e.message}" }
      end

      {
        success: true,
        data: {
          parent: name_or_id,
          boards_with_notches: results.length,
          total_notch_dimensions: dim_count,
          details: results
        }
      }
    end
  end

  # ─────────────────────────────────────────────
  # 日志工具
  # ─────────────────────────────────────────────
  def self.log_info(msg)
    puts "[MCP-Bridge] #{msg}"
  end

  def self.log_error(msg)
    puts "[MCP-Bridge ERROR] #{msg}"
  end

  # ─────────────────────────────────────────────
  # 生命周期管理
  # ─────────────────────────────────────────────
  def self.start_bridge
    return if @running
    Server.start
    Dispatcher.start
    log_info("Bridge started. Port=#{PORT}")
  end

  def self.stop_bridge
    Dispatcher.stop
    Server.stop
    log_info("Bridge stopped.")
  end

  # ─────────────────────────────────────────────
  # 自动启动 (模型打开后)
  # ─────────────────────────────────────────────
  # 使用 AppObserver 确保在 SketchUp 完全就绪后启动
  class AppObserver
    def onNewModel(model)
      MCPBridge.start_bridge
    end

    def onOpenModel(model)
      MCPBridge.start_bridge
    end
  end

  # 注册观察者; 如果已有模型打开则直接启动
  Sketchup.add_observer(AppObserver.new)
  if Sketchup.active_model
    start_bridge
  end

  # ─────────────────────────────────────────────
  # 菜单项 (便于手动控制)
  # ─────────────────────────────────────────────
  unless @menu_created
    submenu = UI.menu('Plugins').add_submenu('MCP Bridge')
    submenu.add_item('Start Server') { MCPBridge.start_bridge }
    submenu.add_item('Stop Server')  { MCPBridge.stop_bridge }
    submenu.add_item('Status') do
      status = MCPBridge.running ? "Running on #{HOST}:#{PORT}" : 'Stopped'
      UI.messagebox("MCP Bridge: #{status}")
    end
    @menu_created = true
  end

end # module MCPBridge
