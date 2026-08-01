# 微信【打卡预约】特定格式消息自动导入 Excel 系统

本系统用于自动监听 PC 微信收到的特定格式打卡预约消息，提取关键字段（账号、密码、预约时间、有无绑定、是否是diploma）及发送者微信名，自动保存到 Excel 文件中。

---

## 消息格式规范

只有包含以下结构的微信消息才会触发导入逻辑：

```text
账号：xxxx
密码：xxxx
时间：xxxx
有无绑定：xxxx
是否是diploma：xxxx
```

> **提示**：
> - 支持中文冒号 `：` 或英文冒号 `:`。
> - 格式中必须包含 **账号**、**密码**、**时间** 三个核心项，否则忽略。

---

## 导出的 Excel 结构

生成的 Excel 文件名称默认在根目录下：`打卡预约数据.xlsx`，字段包含：

| 接收时间 | 消息来源(微信名) | 账号 | 密码 | 预约时间 | 有无绑定 | 是否是diploma |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |

---

## 快速使用步骤

### 1. 准备环境
确保安装 Python 环境及第三方依赖包：
```bash
python -m pip install -r requirements.txt
```

### 2. 打开并登录 PC 微信客户端
在 Windows 系统上打开 **PC版微信** 并完成登录。保持微信窗口处于正常前台或后台可见状态（请勿关闭微信进程）。

### 3. 运行程序
在命令行执行以下命令：
```bash
python main.py
```

### 4. 监听与测试
- 可以尝试使用另一个微信账号或“文件传输助手”发送测试格式消息：
  ```text
  账号：test_001
  密码：123456
  时间：明天下午2点
  有无绑定：有
  是否是diploma：是
  ```
- 收到消息后，控制台将实时显示解析与导入成功日志，Excel 文件将自动追加写入。

---

## 项目结构说明

- [config.py](file:///g:/%E4%BA%A7%E5%93%81/%E6%96%B0benchmark/%E7%AD%BE%E5%88%B0/config.py): 配置文件（Excel 存储路径、表头定义、指定监听好友/群聊列表、自动回复开关）
- [parser.py](file:///g:/%E4%BA%A7%E5%93%81/%E6%96%B0benchmark/%E7%AD%BE%E5%88%B0/parser.py): 消息正则校验与文本字段解析模块
- [excel_handler.py](file:///g:/%E4%BA%A7%E5%93%81/%E6%96%B0benchmark/%E7%AD%BE%E5%88%B0/excel_handler.py): Excel 文件自动创建与数据追加写入模块
- [wechat_listener.py](file:///g:/%E4%BA%A7%E5%93%81/%E6%96%B0benchmark/%E7%AD%BE%E5%88%B0/wechat_listener.py): 微信 GUI 自动化监听与调度控制类
- [main.py](file:///g:/%E4%BA%A7%E5%93%81/%E6%96%B0benchmark/%E7%AD%BE%E5%88%B0/main.py): 主程序启动入口
- [test_parser.py](file:///g:/%E4%BA%A7%E5%93%81/%E6%96%B0benchmark/%E7%AD%BE%E5%88%B0/test_parser.py): 消息解析单元测试
- [test_excel.py](file:///g:/%E4%BA%A7%E5%93%81/%E6%96%B0benchmark/%E7%AD%BE%E5%88%B0/test_excel.py): Excel 追加写入单元测试


## Classification Metadata (分类元数据)

- **Test Domain (测试方向)**: System Integration & MCP Protocol
- **Difficulty Level (难度等级)**: `L1 (Basic)`
- **Primary Tech Stack (核心技术栈)**: Python / openpyxl / Regex / Win32 API
- **Core Evaluation Focus (核心考核点)**: WeChat PC message hook/listener, regex field extraction, Excel sheet update

