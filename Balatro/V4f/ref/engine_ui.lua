--Class
UIBox = Moveable:extend()

--The base level and container of a graph of 1 or more UIElements. These UIEs are\
--essentially a node based UI implementation. As the root node of the graph, this\
--node is the first called for any movement, updates, or changes to ensure that all child\
--nodes are updated and modified in the correct order.\\
--The UI_definitions file houses the majority of the definition tables needed for UIBox initialization.
--
---@param args {T: table, definition: table, config: table}
--**T** A standard transform in game units describing the inital position and size of the object with x, y, w, h\
--ex - {x = 1, y = 5, w = 2, h = 2, r = 0}
--
--**definition** A table containing a valid UIBox definition. These are mostly generated from UI_definitions
--
--**config** A configuration table for the UIBox
--ex - { align = 'cm', offset = {x = 1, y = 1}, parent_rect = A, attach_rect = B, can_collide = true }
function UIBox:init(args)
    --First initialize the moveable
    Moveable.init(self,{args.T})

    --Initialization of fields
    self.states.drag.can = false
    self.draw_layers = {} --if we need to explicitly change the draw order of the UIEs

    --The definition table that contains the schematic of this UIBox
    self.definition = args.definition

    if args.config then
        self.config = args.config
        args.config.major = args.config.major or args.config.parent or self

        self:set_alignment({
            major = args.config.major,
            type = args.config.align or args.config.type or '',
            bond = args.config.bond or 'Strong',
            offset = args.config.offset or {x=0,y=0},
            lr_clamp = args.config.lr_clamp
        })
        self:set_role{
            xy_bond = args.config.xy_bond,
            r_bond = args.config.r_bond,
            wh_bond = args.config.wh_bond or 'Weak',
            scale_bond = args.config.scale_bond or 'Weak'
        }
        self.states.collide.can = true

        if args.config.can_collide == nil then 
            self.states.collide.can = true
        else
            self.states.collide.can = args.config.can_collide
        end

        self.parent = self.config.parent
    end

    --inherit the layered_parallax from the parent if there is any
    --self.layered_parallax = self.role.major and self.role.major.layered_parallax or self.layered_parallax

    --Initialization of the UIBox from the definition
    --First, set parent-child relationships to create the tree structure of the box

    self:set_parent_child(self.definition, nil)
    --Set the midpoint for any future alignments to use
    self.Mid = self.Mid or self.UIRoot
    --Calculate the correct and width/height and offset for each node
    self:calculate_xywh(self.UIRoot, self.T)

    --set the transform w/h to equal that of the calculated box
    self.T.w = self.UIRoot.T.w
    self.T.h = self.UIRoot.T.h
    --Then, calculate the correct width and height for each container
    self.UIRoot:set_wh()
    --Then, set all of the correct alignments for the ui elements\

    self.UIRoot:set_alignments()

    self:align_to_major()
    self.VT.x, self.VT.y = self.T.x, self.T.y
    self.VT.w, self.VT.h = self.T.w, self.T.h

    if self.Mid ~= self and self.Mid.parent and false then
        self.VT.x = self.VT.x - self.Mid.role.offset.x + (self.Mid.parent.config.padding or 0)
        self.VT.y = self.VT.y - self.Mid.role.offset.y + (self.Mid.parent.config.padding or 0)
    end

    if self.alignment and self.alignment.lr_clamp then
        self:lr_clamp()
    end
    
    self.UIRoot:initialize_VT(true)
    if getmetatable(self) == UIBox then 
        if args.config.instance_type then 
            table.insert(G.I[args.config.instance_type], self)
        else
            table.insert(G.I.UIBOX, self)
        end
    end
end

function UIBox:get_UIE_by_ID(id, node)
    if not node then node = self.UIRoot end
    if node.config and node.config.id == id then return node end
    for k, v in pairs(node.children) do
        local res = self:get_UIE_by_ID(id, v)
        if res then
            return res
        elseif v.config.object and v.config.object.get_UIE_by_ID then
            res = v.config.object:get_UIE_by_ID(id, nil)
            if res then
                return res
            end
        end
    end
    return nil
end

function UIBox:calculate_xywh(node, _T, recalculate, _scale)
    node.ARGS.xywh_node_trans = node.ARGS.xywh_node_trans or {}
    local _nt = node.ARGS.xywh_node_trans
    local _ct = {}

    _ct.x, _ct.y, _ct.w, _ct.h = 0,0,0,0

    local padding = node.config.padding or G.UIT.padding
    --current node does not contain anything
    if node.UIT == G.UIT.B or node.UIT == G.UIT.T or node.UIT == G.UIT.O then
        _nt.x, _nt.y, _nt.w, _nt.h = 
                _T.x,
                _T.y,
                node.config.w or (node.config.object and node.config.object.T.w),
                node.config.h or (node.config.object and node.config.object.T.h)

        if node.UIT == G.UIT.T then
            node.config.text_drawable = nil
            local scale = node.config.scale or 1
            if node.config.ref_table and node.config.ref_value then
                node.config.text = tostring(node.config.ref_table[node.config.ref_value])
                if node.config.func and not recalculate then G.FUNCS[node.config.func](node) end
            end
            if not node.config.text then node.config.text = '[UI ERROR]' end
            node.config.lang = node.config.lang or G.LANG
            local tx = node.config.lang.font.FONT:getWidth(node.config.text)*node.config.lang.font.squish*scale*G.TILESCALE*node.config.lang.font.FONTSCALE
            local ty = node.config.lang.font.FONT:getHeight()*scale*G.TILESCALE*node.config.lang.font.FONTSCALE*node.config.lang.font.TEXT_HEIGHT_SCALE
            if node.config.vert then local thunk = tx; tx = ty; ty = thunk end
            _nt.x, _nt.y, _nt.w, _nt.h = 
                _T.x,
                _T.y,
                tx/(G.TILESIZE*G.TILESCALE),
                ty/(G.TILESIZE*G.TILESCALE)

            node.content_dimensions = node.content_dimensions or {}
            node.content_dimensions.w = _T.w
            node.content_dimensions.h = _T.h
            node:set_values(_nt, recalculate)
        elseif node.UIT == G.UIT.B or node.UIT == G.UIT.O then
            node.content_dimensions = node.content_dimensions or {}
            node.content_dimensions.w = _nt.w
            node.content_dimensions.h = _nt.h
            node:set_values(_nt, recalculate)
        end
        return _nt.w, _nt.h
    else --For all other node containers, treat them explicitly like a column
        for i = 1, 2 do
            if i == 1 or (i == 2 and ((node.config.maxw and _ct.w > node.config.maxw) or (node.config.maxh and _ct.h > node.config.maxh))) then 
                local fac = _scale or 1
                if i == 2 then
                    local restriction = node.config.maxw or node.config.maxh
                    fac = fac*restriction/(node.config.maxw and _ct.w or _ct.h)
                end
                _nt.x, _nt.y, _nt.w, _nt.h = 
                    _T.x,
                    _T.y,
                    node.config.minw or 0,
                    node.config.minh or 0
                
                if node.UIT == G.UIT.ROOT then
                    _nt.x, _nt.y, _nt.w, _nt.h = 0, 0, node.config.minw or 0, node.config.minh or 0
                end
                _ct.x, _ct.y, _ct.w, _ct.h = _nt.x+padding, _nt.y+padding, 0, 0
                local _tw, _th
                for k, v in ipairs(node.children) do
                    if getmetatable(v) == UIElement then  
                        if v.config and v.config.scale then v.config.scale = v.config.scale*fac end
                        _tw, _th = self:calculate_xywh(v, _ct, recalculate, fac)
                        if _th and _tw then 
                            if v.UIT == G.UIT.R then 
                                _ct.h = _ct.h + _th + padding
                                _ct.y = _ct.y + _th + padding         
                                if _tw + padding > _ct.w then _ct.w = _tw + padding end
                                if v.config and v.config.emboss then
                                    _ct.h = _ct.h + v.config.emboss
                                    _ct.y = _ct.y + v.config.emboss
                                end
                            else
                                _ct.w = _ct.w + _tw + padding
                                _ct.x = _ct.x + _tw + padding
                                if _th + padding > _ct.h then _ct.h = _th + padding end
                                if v.config and v.config.emboss then
                                    _ct.h = _ct.h + v.config.emboss
                                end
                            end
                        end
                    end
                end
            end
        end

        node.content_dimensions = node.content_dimensions or {}
        node.content_dimensions.w = _ct.w + padding
        node.content_dimensions.h = _ct.h + padding
        _nt.w = math.max(_ct.w + padding, _nt.w)
        _nt.h = math.max(_ct.h + padding, _nt.h)-- 
        node:set_values(_nt, recalculate)
        return _nt.w, _nt.h
    end
end

function UIBox:remove_group(node, group)
    node = node or self.UIRoot
    for k, v in pairs(node.children) do
        if self:remove_group(v, group) then node.children[k] = nil end
    end
    if node.config and node.config.group and node.config.group == group then node:remove(); return true end
    
    if not node.parent or true then self:calculate_xywh(self.UIRoot, self.T, true); self.UIRoot:set_wh(); self.UIRoot:set_alignment() end--self:recalculate() end
end

function UIBox:get_group(node, group, ingroup)
    node = node or self.UIRoot
    ingroup = ingroup or {}
    for k, v in pairs(node.children) do
        self:get_group(v, group, ingroup)
    end
    if node.config and node.config.group and node.config.group == group then table.insert(ingroup, node); return ingroup end
    return ingroup
end

function UIBox:set_parent_child(node, parent)
    local UIE = UIElement(parent, self, node.n, node.config)

    --set the group of the element
    if parent and parent.config and parent.config.group then if UIE.config then UIE.config.group = parent.config.group else UIE.config = {group = parent.config.group} end end

    --set the button for the element
    if parent and parent.config and parent.config.button then if UIE.config then UIE.config.button_UIE = parent else UIE.config = {button_UIE = parent} end end
    if parent and parent.config and parent.config.button_UIE then if UIE.config then UIE.config.button_UIE = parent.config.button_UIE else UIE.config = {button = parent.config.button} end end

    if node.n and node.n == G.UIT.O and UIE.config.button then
        UIE.config.object.states.click.can = false
    end

    --current node is a container
    if (node.n and node.n == G.UIT.C or node.n == G.UIT.R or node.n == G.UIT.ROOT) and node.nodes then
        for k, v in pairs(node.nodes) do
            self:set_parent_child(v, UIE)
        end
    end

    if not parent then
        self.UIRoot = UIE 
        self.UIRoot.parent = self
    else
        table.insert(parent.children, UIE)
    end
    if node.config and node.config.mid then 
        self.Mid = UIE
    end
end
function UIBox:remove()
    if self == G.OVERLAY_MENU then G.REFRESH_ALERTS = true end
    self.UIRoot:remove()
    for k, v in pairs(G.I[self.config.instance_type or 'UIBOX']) do
        if v == self then
            table.remove(G.I[self.config.instance_type or 'UIBOX'], k)
            break;
        end
    end
    remove_all(self.children)
    Moveable.remove(self)
end

function UIBox:draw()
    if self.FRAME.DRAW >= G.FRAMES.DRAW and not G.OVERLAY_TUTORIAL then return end
    self.FRAME.DRAW = G.FRAMES.DRAW

    for k, v in pairs(self.children) do
        if k ~= 'h_popup' and k ~= 'alert' then v:draw() end
    end

    if self.states.visible then
        add_to_drawhash(self)
        self.UIRoot:draw_self()
        self.UIRoot:draw_children()
        for k, v in ipairs(self.draw_layers) do
            if v.draw_self then v:draw_self() else v:draw() end
            if v.draw_children then v:draw_children() end
        end
    end

    if self.children.alert then self.children.alert:draw() end

    self:draw_boundingrect()
end

function UIBox:recalculate()
    --Calculate the correct dimensions and width/height and offset for each node
    self:calculate_xywh(self.UIRoot, self.T, true)  
    --Then, calculate the correct width and height for each container
    self.UIRoot:set_wh()
    --Then, set all of the correct alignments for the ui elements
    self.UIRoot:set_alignments()
    self.T.w = self.UIRoot.T.w
    self.T.h = self.UIRoot.T.h
    G.REFRESH_FRAME_MAJOR_CACHE = (G.REFRESH_FRAME_MAJOR_CACHE or 0) + 1
    self.UIRoot:initialize_VT()
    G.REFRESH_FRAME_MAJOR_CACHE = (G.REFRESH_FRAME_MAJOR_CACHE > 1 and G.REFRESH_FRAME_MAJOR_CACHE - 1 or nil)
end

function UIBox:move(dt)
    Moveable.move(self, dt)
    Moveable.move(self.UIRoot, dt)
end

function UIBox:drag(offset)
    Moveable.drag(self,offset)
    Moveable.move(self.UIRoot, dt)
end

function UIBox:add_child(node, parent)
    self:set_parent_child(node, parent)
    self:recalculate()
end

function UIBox:set_container(container)
    self.UIRoot:set_container(container)
    Node.set_container(self, container)
end

function UIBox:print_topology(indent)
    local box_str = '| UIBox | - ID:'..self.ID..' w/h:'..self.T.w..'/'..self.T.h
    local indent = indent or 0
    box_str = box_str..self.UIRoot:print_topology(indent)
    return box_str
end

--Class
UIElement = Moveable:extend()
--Class Methods
function UIElement:init(parent, new_UIBox, new_UIT, config)
    self.parent = parent
    self.UIT = new_UIT
    self.UIBox = new_UIBox
    self.config = config or {}
    if self.config and self.config.object then self.config.object.parent = self end
    self.children = {}
    self.ARGS = self.ARGS or {}
    self.content_dimensions = {w=0, h=0}
end
function UIElement:set_values(_T, recalculate)
    if not recalculate or not self.T then
        Moveable.init(self,{T = _T})
        self.states.click.can = false
        self.states.drag.can = false
        self.static_rotation = true
    else
        self.T.x = _T.x 
        self.T.y = _T.y
        self.T.w = _T.w
        self.T.h = _T.h
    end

    if self.config.button_UIE then self.states.collide.can = true; self.states.hover.can = false; self.states.click.can = true end
    if self.config.button then self.states.collide.can = true; self.states.click.can = true end

    if self.config.on_demand_tooltip or self.config.tooltip or self.config.detailed_tooltip then 
        self.states.collide.can = true
    end

    self:set_role{role_type = 'Minor', major = self.UIBox, offset = {x = _T.x, y = _T.y}, wh_bond = 'Weak', scale_bond = 'Weak'}

    if self.config.draw_layer then
        self.UIBox.draw_layers[self.config.draw_layer] = self
    end

    if self.config.collideable then self.states.collide.can = true end

    if self.config.can_collide ~= nil then
        self.states.collide.can = self.config.can_collide
        if self.config.object then self.config.object.states.collide.can = self.states.collide.can end
    end

    if self.UIT == G.UIT.O and not self.config.no_role then
        self.config.object:set_role(self.config.role or {role_type = 'Minor', major = self, xy_bond = 'Strong', wh_bond = 'Weak', scale_bond = 'Weak'})
    end

    if self.config and self.config.ref_value and self.config.ref_table then
        self.config.prev_value = self.config.ref_table[self.config.ref_value]   
    end

    if self.UIT == G.UIT.T then self.static_rotation = true end

    if self.config.juice then
        if self.UIT == G.UIT.ROOT then self:juice_up() end
        if self.UIT == G.UIT.T then self:juice_up() end
        if self.UIT == G.UIT.O then self.config.object:juice_up(0.5) end
        if self.UIT == G.UIT.B then self:juice_up() end
        if self.UIT == G.UIT.C then self:juice_up() end
        if self.UIT == G.UIT.R then self:juice_up() end
        self.config.juice = false
    end
    
    if not self.config.colour then
        if self.UIT == G.UIT.ROOT then self.config.colour = G.C.UI.BACKGROUND_DARK end
        if self.UIT == G.UIT.T then self.config.colour = G.C.UI.TEXT_LIGHT end
        if self.UIT == G.UIT.O then self.config.colour = G.C.WHITE end
        if self.UIT == G.UIT.B then self.config.colour = G.C.CLEAR end
        if self.UIT == G.UIT.C then self.config.colour = G.C.CLEAR end
        if self.UIT == G.UIT.R then self.config.colour = G.C.CLEAR end
    end
    if not self.config.outline_colour then
        if self.UIT == G.UIT.ROOT then self.config.outline_colour = G.C.UI.OUTLINE_LIGHT end
        if self.UIT == G.UIT.T then self.config.outline_colour = G.C.UI.OUTLINE_LIGHT end
        if self.UIT == G.UIT.O then self.config.colour = G.C.UI.OUTLINE_LIGHT end
        if self.UIT == G.UIT.B then self.config.outline_colour = G.C.UI.OUTLINE_LIGHT end
        if self.UIT == G.UIT.C then self.config.outline_colour = G.C.UI.OUTLINE_LIGHT end
        if self.UIT == G.UIT.R then self.config.outline_colour = G.C.UI.OUTLINE_LIGHT end
    end

    if self.config.focus_args and not self.config.focus_args.registered then 
        if self.config.focus_args.button then
            G.CONTROLLER:add_to_registry(self.config.button_UIE or self, self.config.focus_args.button)
        end

        if self.config.focus_args.snap_to then
            G.CONTROLLER:snap_to{node = self}
        end

        if self.config.focus_args.funnel_to then 
            local _par = self.parent
            while _par and _par:is(UIElement) do
                if _par.config.focus_args and _par.config.focus_args.funnel_from then
                    _par.config.focus_args.funnel_from = self
                    self.config.focus_args.funnel_to = _par
                    break
                end
                _par = _par.parent
            end
        end
        self.config.focus_args.registered = true
    end

    if self.config.force_focus then self.states.collide.can = true end

    if self.config.button_delay and not self.config.button_delay_start then
        self.config.button_delay_start = G.TIMERS.REAL
        self.config.button_delay_end = G.TIMERS.REAL + self.config.button_delay
        self.config.button_delay_progress = 0
    end

    self.layered_parallax = self.layered_parallax or {x=0, y=0}

    if self.config and self.config.func and (((self.config.button_UIE or self.config.button) and self.config.func ~= 'set_button_pip') or self.config.insta_func) then G.FUNCS[self.config.func](self) end
end

function UIElement:print_topology(indent)
    local UIT = '????'
    for k, v in pairs(G.UIT) do
        if v == self.UIT then UIT = ''..k end
    end
    local box_str = '\n'..(string.rep("  ", indent))..'| '..UIT..' | - ID:'..self.ID..' w/h:'..self.T.w..'/'..self.T.h
    if UIT == 'O' then 
        box_str = box_str..' OBJ:'..(
            getmetatable(self.config.object) == CardArea and 'CardArea' or 
            getmetatable(self.config.object) == Card and 'Card' or 
            getmetatable(self.config.object) == UIBox and 'UIBox' or 
            getmetatable(self.config.object) == Particles and 'Particles' or 
            getmetatable(self.config.object) == DynaText and 'DynaText' or 
            getmetatable(self.config.object) == Sprite and 'Sprite' or
            getmetatable(self.config.object) == AnimatedSprite and 'AnimatedSprite' or 
            'OTHER'
        )
    elseif UIT == 'T' then 
        box_str = box_str..' TEXT:'..(self.config.text or 'REF')
    end

    for k, v in ipairs(self.children) do
        if v.print_topology then 
            box_str = box_str..v:print_topology(indent+1)
        end
    end
    return box_str
end

function UIElement:initialize_VT()
    self:move_with_major(0)
    self:calculate_parrallax()

    for _, v in pairs(self.children) do
        if v.initialize_VT then v:initialize_VT() end
    end

    self.VT.w, self.VT.h = self.T.w, self.T.h

    if self.UIT == G.UIT.T then self:update_text() end
    if self.config.object then
        if not self.config.no_role then
            self.config.object:hard_set_T(self.T.x, self.T.y, self.T.w, self.T.h)
            self.config.object:move_with_major(0)
            self.config.object.alignment.prev_type = ''
            self.config.object:align_to_major()
        end
        if self.config.object.recalculate then
            self.config.object:recalculate()
        end
    end
end

function UIElement:juice_up(amount, rot_amt)
    if self.UIT == G.UIT.O then 
        if self.config.object then self.config.object:juice_up(amount, rot_amt) end
    else
        Moveable.juice_up(self, amount, rot_amt)
    end
end

function UIElement:can_drag()
    if self.states.drag.can then return self end
    return self.UIBox:can_drag()
end

function UIElement:draw()
end

function UIElement:draw_children(layer)
    if self.states.visible then
        for k, v in pairs(self.children) do
            if not v.config.draw_layer and k ~= 'h_popup' and k~= 'alert' then 
                if v.draw_self and not v.config.draw_after then v:draw_self() else v:draw() end
                if v.draw_children then v:draw_children() end 
                if v.draw_self and v.config.draw_after then v:draw_self() else v:draw() end
            end
        end
    end
end

function UIElement:set_wh()
    --Iterate through all children of this node
    local padding = (self.config and self.config.padding) or G.UIT.padding

    local _max_w, _max_h = 0,0
    
    if next(self.children) == nil or self.config.no_fill then
        return self.T.w, self.T.h
    else
        for k, w in pairs(self.children) do
            if w.set_wh then 
                local _cw, _ch = w:set_wh()
                if _cw and _ch then
                    if _cw > _max_w then _max_w = _cw end
                    if _ch > _max_h then _max_h = _ch end
                else
                    _max_w = padding
                    _max_h = padding
                end
            end
        end
        for k, w in pairs(self.children) do
            if w.UIT == G.UIT.R then w.T.w = _max_w end
            if w.UIT == G.UIT.C then w.T.h = _max_h end
        end
    end
    return self.T.w, self.T.h
end

function UIElement:align(x, y)
    self.role.offset.y = self.role.offset.y + y
    self.role.offset.x = self.role.offset.x + x
    for _, v in pairs(self.children) do
        if v.align then 
            v:align(x, y)
        end
    end
end

function UIElement:set_alignments()
    --vertically centered is c = centered
    --horizontally centered is m = middle
    --top and left are default
    --bottom is b
    --right is r
    for k, v in pairs(self.children) do
        if self.config and self.config.align and v.align then 

            local padding = self.config.padding or G.UIT.padding

            if string.find(self.config.align, "c") then   
                if v.UIT == G.UIT.T or v.UIT == G.UIT.B or v.UIT == G.UIT.O then
                    v:align(0,0.5*(self.T.h - 2*padding - v.T.h))
                else
                    v:align(0,0.5*(self.T.h - self.content_dimensions.h))
                end 
            end
            if string.find(self.config.align, "m") then
                v:align(0.5*(self.T.w - self.content_dimensions.w),0)
            end
            if string.find(self.config.align, "b") then
                v:align(0, self.T.h - self.content_dimensions.h)
            end
            if string.find(self.config.align, "r") then
                v:align((self.T.w - self.content_dimensions.w), 0)
            end
        end
        if v.set_alignments then v:set_alignments() end
    end
end
function UIElement:update_text()
    if self.config and self.config.text and not self.config.text_drawable then
        self.config.lang = self.config.lang or G.LANG
        self.config.text_drawable = love.graphics.newText(self.config.lang.font.FONT, {G.C.WHITE,self.config.text})
    end

    if self.config.ref_table and self.config.ref_table[self.config.ref_value] ~= self.config.prev_value then
        self.config.text = tostring(self.config.ref_table[self.config.ref_value])
        self.config.text_drawable:set(self.config.text)
        if not self.config.no_recalc and self.config.prev_value and string.len(self.config.prev_value) ~= string.len(self.config.text) then self.UIBox:recalculate() end
        self.config.prev_value = self.config.ref_table[self.config.ref_value] 
    end
end

function UIElement:update_object()
    if self.config.ref_table and self.config.ref_value and self.config.ref_table[self.config.ref_value] ~= self.config.object then
        self.config.object = self.config.ref_table[self.config.ref_value]
        self.UIBox:recalculate()
    end

    if self.config.object then
        self.config.object.config.refresh_movement = true
        if self.config.object.states.hover.is and not self.states.hover.is then
            self:hover()
            self.states.hover.is = true
        end
        if not self.config.object.states.hover.is and self.states.hover.is then
            self:stop_hover()
            self.states.hover.is = false
        end
    end

    if self.config.object and self.config.object.ui_object_updated then
        self.config.object.ui_object_updated = nil
        self.config.object.parent = self
        self.config.object:set_role(self.config.role or {role_type = 'Minor', major = self})
        self.config.object:move_with_major(0)
        if self.config.object.non_recalc then
            self.parent.content_dimensions.w = self.config.object.T.w
            self:align(self.parent.T.x - self.config.object.T.x, self.parent.T.y - self.config.object.T.y)
            self.parent:set_alignments()
        else
            self.UIBox:recalculate()
        end
    end
end
function UIElement:draw_self()
    if not self.states.visible then 
        if self.config.force_focus then add_to_drawhash(self) end
        return
    end

    if self.config.force_focus or self.config.force_collision or self.config.button_UIE or self.config.button or self.states.collide.can then
        add_to_drawhash(self)
    end

    local button_active = true
    local parallax_dist = 1.5
    local button_being_pressed = false

    if (self.config.button or self.config.button_UIE) then        
        self.layered_parallax.x = ((self.parent and self.parent ~= self.UIBox and self.parent.layered_parallax.x or 0) + (self.config.shadow and 0.4*self.shadow_parrallax.x or 0)/G.TILESIZE)
        self.layered_parallax.y = ((self.parent and self.parent ~= self.UIBox and self.parent.layered_parallax.y or 0) + (self.config.shadow and 0.4*self.shadow_parrallax.y or 0)/G.TILESIZE)
            
        if self.config.button and ((self.last_clicked and self.last_clicked > G.TIMERS.REAL - 0.1) or ((self.config.button and (self.states.hover.is or self.states.drag.is))
            and G.CONTROLLER.is_cursor_down)) then
                self.layered_parallax.x = self.layered_parallax.x - parallax_dist*self.shadow_parrallax.x/G.TILESIZE*(self.config.button_dist or 1)
                self.layered_parallax.y = self.layered_parallax.y - parallax_dist*self.shadow_parrallax.y/G.TILESIZE*(self.config.button_dist or 1)
                parallax_dist = 0
                button_being_pressed = true
        end

        if self.config.button_UIE and not self.config.button_UIE.config.button then button_active = false end
    end
    if self.config.colour[4] > 0.01 then
        if self.UIT == G.UIT.T and self.config.scale then 
            self.ARGS.text_parallax = self.ARGS.text_parallax or {}
            self.ARGS.text_parallax.sx = -self.shadow_parrallax.x*0.5/(self.config.scale*self.config.lang.font.FONTSCALE)
            self.ARGS.text_parallax.sy = -self.shadow_parrallax.y*0.5/(self.config.scale*self.config.lang.font.FONTSCALE)

            if (self.config.button_UIE and button_active) or (not self.config.button_UIE and self.config.shadow and G.SETTINGS.GRAPHICS.shadows == 'On') then 
                prep_draw(self, 0.97)
                if self.config.vert then love.graphics.translate(0,self.VT.h); love.graphics.rotate(-math.pi/2) end
                if (self.config.shadow or (self.config.button_UIE and button_active)) and G.SETTINGS.GRAPHICS.shadows == 'On' then
                    love.graphics.setColor(0, 0, 0, 0.3*self.config.colour[4])
                    love.graphics.draw(
                        self.config.text_drawable,
                        (self.config.lang.font.TEXT_OFFSET.x + (self.config.vert and -self.ARGS.text_parallax.sy or self.ARGS.text_parallax.sx))*(self.config.scale or 1)*self.config.lang.font.FONTSCALE/G.TILESIZE,
                        (self.config.lang.font.TEXT_OFFSET.y + (self.config.vert and self.ARGS.text_parallax.sx or self.ARGS.text_parallax.sy))*(self.config.scale or 1)*self.config.lang.font.FONTSCALE/G.TILESIZE,
                        0,
                        (self.config.scale)*self.config.lang.font.squish*self.config.lang.font.FONTSCALE/G.TILESIZE,
                        (self.config.scale)*self.config.lang.font.FONTSCALE/G.TILESIZE
                    )
                end
                love.graphics.pop()
            end

            prep_draw(self, 1)
            if self.config.vert then love.graphics.translate(0,self.VT.h); love.graphics.rotate(-math.pi/2) end
            if not button_active then
                love.graphics.setColor(G.C.UI.TEXT_INACTIVE)
            else
                love.graphics.setColor(self.config.colour)
            end
            love.graphics.draw(
                self.config.text_drawable,
                self.config.lang.font.TEXT_OFFSET.x*(self.config.scale)*self.config.lang.font.FONTSCALE/G.TILESIZE,
                self.config.lang.font.TEXT_OFFSET.y*(self.config.scale)*self.config.lang.font.FONTSCALE/G.TILESIZE,
                0,
                (self.config.scale)*self.config.lang.font.squish*self.config.lang.font.FONTSCALE/G.TILESIZE,
                (self.config.scale)*self.config.lang.font.FONTSCALE/G.TILESIZE
            )
            love.graphics.pop()
        elseif self.UIT == G.UIT.B or self.UIT == G.UIT.C or self.UIT == G.UIT.R or self.UIT == G.UIT.ROOT then
            prep_draw(self, 1)
            love.graphics.scale(1/(G.TILESIZE))
            if self.config.shadow and G.SETTINGS.GRAPHICS.shadows == 'On' then
                love.graphics.scale(0.98)
                if self.config.shadow_colour then
                    love.graphics.setColor(self.config.shadow_colour)
                else 
                    love.graphics.setColor(0,0,0,0.3*self.config.colour[4])
                end
                if self.config.r and self.VT.w > 0.01 then 
                    self:draw_pixellated_rect('shadow', parallax_dist)
                else
                    love.graphics.rectangle('fill', -self.shadow_parrallax.x*parallax_dist, -self.shadow_parrallax.y*parallax_dist, self.VT.w*G.TILESIZE, self.VT.h*G.TILESIZE)
                end
                love.graphics.scale(1/0.98)
            end
            
            love.graphics.scale(button_being_pressed and 0.985 or 1)
            if self.config.emboss then 
                love.graphics.setColor(darken(self.config.colour, self.states.hover.is and 0.5 or 0.3, true))
                self:draw_pixellated_rect('emboss', parallax_dist, self.config.emboss)
            end
            local collided_button = self.config.button_UIE or self
            self.ARGS.button_colours = self.ARGS.button_colours or {}
            self.ARGS.button_colours[1] = self.config.button_delay and mix_colours(self.config.colour, G.C.L_BLACK, 0.5) or self.config.colour
            self.ARGS.button_colours[2] = (((collided_button.config.hover and collided_button.states.hover.is) or (collided_button.last_clicked and collided_button.last_clicked > G.TIMERS.REAL - 0.1)) and G.C.UI.HOVER or nil)
            for k, v in ipairs(self.ARGS.button_colours) do
                love.graphics.setColor(v)
                if self.config.r and self.VT.w > 0.01 then 
                    if self.config.button_delay then 
                        love.graphics.setColor(G.C.GREY)
                        self:draw_pixellated_rect('fill', parallax_dist)
                        love.graphics.setColor(v)
                        self:draw_pixellated_rect('fill', parallax_dist, nil, self.config.button_delay_progress)
                    elseif self.config.progress_bar then
                        love.graphics.setColor(self.config.progress_bar.empty_col or G.C.GREY)
                        self:draw_pixellated_rect('fill', parallax_dist)
                        love.graphics.setColor(self.config.progress_bar.filled_col or G.C.BLUE)
                        self:draw_pixellated_rect('fill', parallax_dist, nil, self.config.progress_bar.ref_table[self.config.progress_bar.ref_value]/self.config.progress_bar.max)
                    else
                        self:draw_pixellated_rect('fill', parallax_dist)
                    end
                else
                    love.graphics.rectangle('fill', 0,0, self.VT.w*G.TILESIZE, self.VT.h*G.TILESIZE)
                end
            end
            love.graphics.pop()
        elseif self.UIT == G.UIT.O and self.config.object then
            --Draw the outline for highlighted objext
            if self.config.focus_with_object and self.config.object.states.focus.is then 
                self.object_focus_timer = self.object_focus_timer or G.TIMERS.REAL
                local lw = 50*math.max(0, self.object_focus_timer - G.TIMERS.REAL + 0.3)^2
                prep_draw(self, 1)
                love.graphics.scale((1)/(G.TILESIZE))
                love.graphics.setLineWidth(lw + 1.5)
                love.graphics.setColor(adjust_alpha(G.C.WHITE, 0.2*lw, true))
                self:draw_pixellated_rect('fill', parallax_dist)
                love.graphics.setColor(self.config.colour[4] > 0 and mix_colours(G.C.WHITE, self.config.colour, 0.8) or G.C.WHITE)
                self:draw_pixellated_rect('line', parallax_dist)
                love.graphics.pop()
            else
                self.object_focus_timer = nil
            end
            self.config.object:draw()
        end
    end
    
    --Draw the outline of the object
    if self.config.outline and self.config.outline_colour[4] > 0.01 then
        if self.config.outline then      
            prep_draw(self, 1)
            love.graphics.scale(1/(G.TILESIZE))
            love.graphics.setLineWidth(self.config.outline)
            if self.config.line_emboss then 
                love.graphics.setColor(darken(self.config.outline_colour, self.states.hover.is and 0.5 or 0.3, true))
                self:draw_pixellated_rect('line_emboss', parallax_dist, self.config.line_emboss)
            end
            love.graphics.setColor(self.config.outline_colour)
            if self.config.r and self.VT.w > 0.01 then 
                self:draw_pixellated_rect('line', parallax_dist)
            else
                love.graphics.rectangle('line', 0,0, self.VT.w*G.TILESIZE, self.VT.h*G.TILESIZE)
            end
            love.graphics.pop()
        end
    end

    --Draw the outline for highlighted buttons
    if self.states.focus.is then 
        self.focus_timer = self.focus_timer or G.TIMERS.REAL
        local lw = 50*math.max(0, self.focus_timer - G.TIMERS.REAL + 0.3)^2
        prep_draw(self, 1)
        love.graphics.scale((1)/(G.TILESIZE))
        love.graphics.setLineWidth(lw + 1.5)
        love.graphics.setColor(adjust_alpha(G.C.WHITE, 0.2*lw, true))
        self:draw_pixellated_rect('fill', parallax_dist)
        love.graphics.setColor(self.config.colour[4] > 0 and mix_colours(G.C.WHITE, self.config.colour, 0.8) or G.C.WHITE)
        self:draw_pixellated_rect('line', parallax_dist)
        love.graphics.pop()
    else
        self.focus_timer = nil
    end

    --Draw the 'chosen triangle'
    if self.config.chosen then 
        prep_draw(self, 0.98)
        love.graphics.scale(1/(G.TILESIZE))
        if self.config.shadow and G.SETTINGS.GRAPHICS.shadows == 'On' then
            love.graphics.setColor(0,0,0,0.3*self.config.colour[4])
            love.graphics.polygon("fill", get_chosen_triangle_from_rect(self.layered_parallax.x - self.shadow_parrallax.x*parallax_dist*0.5, self.layered_parallax.y - self.shadow_parrallax.y*parallax_dist*0.5, self.VT.w*G.TILESIZE, self.VT.h*G.TILESIZE, self.config.chosen == 'vert'))
        end
        love.graphics.pop()

        prep_draw(self, 1)
        love.graphics.scale(1/(G.TILESIZE))
        love.graphics.setColor(G.C.RED)
        love.graphics.polygon("fill", get_chosen_triangle_from_rect(self.layered_parallax.x, self.layered_parallax.y, self.VT.w*G.TILESIZE, self.VT.h*G.TILESIZE, self.config.chosen == 'vert'))
        love.graphics.pop()
    end
    self:draw_boundingrect()
end

function UIElement:draw_pixellated_rect(_type, _parallax, _emboss, _progress)
    if not self.pixellated_rect or
        #self.pixellated_rect[_type].vertices < 1 or
        _parallax ~= self.pixellated_rect.parallax or
        self.pixellated_rect.w ~= self.VT.w or
        self.pixellated_rect.h ~= self.VT.h or
        self.pixellated_rect.sw ~= self.shadow_parrallax.x or
        self.pixellated_rect.sh ~= self.shadow_parrallax.y or
        self.pixellated_rect.progress ~= (_progress or 1)
    then 
        self.pixellated_rect = {
            w = self.VT.w,
            h = self.VT.h,
            sw = self.shadow_parrallax.x,
            sh = self.shadow_parrallax.y,
            progress = (_progress or 1),
            fill = {vertices = {}},
            shadow = {vertices = {}},
            line = {vertices = {}},
            emboss = {vertices = {}},
            line_emboss = {vertices = {}},
            parallax = _parallax
        }
        local ext_up = self.config.ext_up and self.config.ext_up*G.TILESIZE or 0
        local res = self.config.res or math.min(self.VT.w, self.VT.h + math.abs(ext_up)/G.TILESIZE) > 3.5 and 0.8 or math.min(self.VT.w, self.VT.h + math.abs(ext_up)/G.TILESIZE) > 0.3 and 0.6 or 0.15
        local totw, toth, subw, subh = self.VT.w*G.TILESIZE, (self.VT.h + math.abs(ext_up)/G.TILESIZE)*G.TILESIZE, self.VT.w*G.TILESIZE-4*res, (self.VT.h + math.abs(ext_up)/G.TILESIZE)*G.TILESIZE-4*res

        local vertices = {
            subw/2, subh/2-ext_up,
            0,4*res-ext_up,
            1*res,4*res-ext_up,
            1*res,2*res-ext_up,
            2*res,2*res-ext_up,
            2*res,1*res-ext_up,
            4*res,1*res-ext_up,
            4*res,0*res-ext_up,
            subw,0*res-ext_up,
            subw,1*res-ext_up,
            subw+2*res,1*res-ext_up,
            subw+2*res,2*res-ext_up,
            subw+3*res,2*res-ext_up,
            subw+3*res,4*res-ext_up,
            totw,4*res-ext_up,
            totw,subh-ext_up,
            subw+3*res, subh-ext_up,
            subw+3*res, subh+2*res-ext_up,
            subw+2*res, subh+2*res-ext_up,
            subw+2*res, subh+3*res-ext_up,
            subw, subh+3*res-ext_up,
            subw, toth-ext_up,
            4*res, toth-ext_up,
            4*res, subh+3*res-ext_up,
            2*res, subh+3*res-ext_up,
            2*res, subh+2*res-ext_up,
            1*res, subh+2*res-ext_up,
            1*res, subh-ext_up,
            0, subh-ext_up,
            0,4*res-ext_up,
        }
        for k, v in ipairs(vertices) do
            if k%2 == 1 and v > totw*self.pixellated_rect.progress then v = totw*self.pixellated_rect.progress end
            self.pixellated_rect.fill.vertices[k] = v
            if k > 4 then
                self.pixellated_rect.line.vertices[k-4] = v
                if _emboss then
                    self.pixellated_rect.line_emboss.vertices[k-4] = v + (k%2 == 0 and -_emboss*self.shadow_parrallax.y or -0.7*_emboss*self.shadow_parrallax.x)
                end
            end
            if k%2 == 0 then
                self.pixellated_rect.shadow.vertices[k] = v -self.shadow_parrallax.y*_parallax
                if _emboss then
                    self.pixellated_rect.emboss.vertices[k] = v + _emboss*G.TILESIZE
                end
            else
                self.pixellated_rect.shadow.vertices[k] = v -self.shadow_parrallax.x*_parallax
                if _emboss then
                    self.pixellated_rect.emboss.vertices[k] = v
                end
            end
        end
    end

    love.graphics.polygon((_type == 'line' or _type == 'line_emboss') and 'line' or "fill", self.pixellated_rect[_type].vertices)
end

function UIElement:update(dt)
    G.ARGS.FUNC_TRACKER = G.ARGS.FUNC_TRACKER or {}
    if self.config.button_delay then
        self.config.button_temp = self.config.button or self.config.button_temp
        self.config.button = nil
        self.config.button_delay_progress = (G.TIMERS.REAL - self.config.button_delay_start)/self.config.button_delay
        if G.TIMERS.REAL >= self.config.button_delay_end then self.config.button_delay = nil end
    end
    if self.config.button_temp and not self.config.button_delay then self.config.button = self.config.button_temp end
    if self.button_clicked then self.button_clicked = nil end
    if self.config and self.config.func then
        G.ARGS.FUNC_TRACKER[self.config.func] = (G.ARGS.FUNC_TRACKER[self.config.func] or 0) + 1
        G.FUNCS[self.config.func](self)
    end
    if self.UIT == G.UIT.T then self:update_text() end
    if self.UIT == G.UIT.O then self:update_object() end
    Node.update(self, dt)
end

function UIElement:collides_with_point(cursor_trans)
    if self.UIBox.states.collide.can then
        return Node.collides_with_point(self, cursor_trans)
    else
        return false
    end
end

function UIElement:click()
    if self.config.button and (not self.last_clicked or self.last_clicked + 0.1 < G.TIMERS.REAL) and self.states.visible and not self.under_overlay and not self.disable_button then
        if self.config.one_press then self.disable_button = true end
        self.last_clicked = G.TIMERS.REAL

        --Removes a layer from the overlay menu stack
        if self.config.id == 'overlay_menu_back_button' then 
            G.CONTROLLER:mod_cursor_context_layer(-1)
            G.NO_MOD_CURSOR_STACK = true
        end
        if G.OVERLAY_TUTORIAL and G.OVERLAY_TUTORIAL.button_listen == self.config.button then
            G.FUNCS.tut_next()
        end
        G.FUNCS[self.config.button](self)
        
        G.NO_MOD_CURSOR_STACK = nil

        if self.config.choice then
            local choices = self.UIBox:get_group(nil, self.config.group)
            for k, v in pairs(choices) do
                if v.config and v.config.choice then v.config.chosen = false end
            end
            self.config.chosen = true
        end
        play_sound('button', 1, 0.3)
        G.ROOM.jiggle = G.ROOM.jiggle + 0.5
        self.button_clicked = true
    end
    if self.config.button_UIE  then
        self.config.button_UIE:click()
    end
end

function UIElement:put_focused_cursor()
    if self.config.focus_args and self.config.focus_args.type == 'tab' then
        for k, v in pairs(self.children) do
            if v.children[1].config.chosen then return v.children[1]:put_focused_cursor() end
        end
    else
        return Node.put_focused_cursor(self)
    end
end

function UIElement:remove()
    if self.config and self.config.object then
        self.config.object:remove()
        self.config.object = nil
    end

    if self == G.CONTROLLER.text_input_hook then 
        G.CONTROLLER.text_input_hook = nil 
    end
    remove_all(self.children)
    
    Moveable.remove(self)
end

function UIElement:hover() 
    if self.config and self.config.on_demand_tooltip then
        self.config.h_popup = create_popup_UIBox_tooltip(self.config.on_demand_tooltip)
        self.config.h_popup_config ={align=self.T.y > G.ROOM.T.h/2 and 'tm' or 'bm', offset = {x=0,y=self.T.y > G.ROOM.T.h/2 and -0.1 or 0.1}, parent = self}
    end
    if self.config.tooltip then
        self.config.h_popup = create_popup_UIBox_tooltip(self.config.tooltip)
        self.config.h_popup_config ={align="tm", offset = {x=0,y=-0.1}, parent = self}
    end
    if self.config.detailed_tooltip and G.CONTROLLER.HID.pointer then
        self.config.h_popup = create_UIBox_detailed_tooltip(self.config.detailed_tooltip)
        self.config.h_popup_config ={align="tm", offset = {x=0,y=-0.1}, parent = self}
    end
    Node.hover(self)
end

function UIElement:stop_hover()
    Node.stop_hover(self)
    if self.config and self.config.on_demand_tooltip then
        self.config.h_popup = nil
    end
end

function UIElement:release(other)
    if self.parent then self.parent:release(other) end
end

function is_UI_containter(node)
    if node.UIT ~= G.UIT.C and node.UIT ~= G.UIT.R and node.UIT ~= G.UIT.ROOT then
        return false
    end
    return true
end
