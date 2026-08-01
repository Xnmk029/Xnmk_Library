---@class Node
Node = Object:extend()

--Node represent any game object that needs to have some transform available in the game itself.\
--Everything that you see in the game is a Node, and some invisible things like the G.ROOM are also\
--represented here.
--
---@param args {T: table, container: Node}
--**T** The transform ititializer, with keys of x|1, y|2, w|3, h|4, r|5\
--**container** optional container for this Node, defaults to G.ROOM
function Node:init(args)
    --From args, set the values of self transform
    args = args or {}
    args.T = args.T or {}

    --Store all argument and return tables here for reuse, because Lua likes to generate garbage
    self.ARGS = self.ARGS or {}
    self.RETS = {}
    
    --Config table used for any metadata about this node
    self.config = self.config or {}

    --For transform init, accept params in the form x|1, y|2, w|3, h|4, r|5
    self.T = {
        x = args.T.x or args.T[1] or 0,
        y = args.T.y or args.T[2] or 0,
        w = args.T.w or args.T[3] or 1,
        h = args.T.h or args.T[4] or 1,
        r = args.T.r or args.T[5] or 0,
        scale = args.T.scale or args.T[6] or 1,
    }
    --Transform to use for collision detection
    self.CT = self.T

    --Create the offset tables, used to determine things like drag offset and 3d shader effects
    self.click_offset = {x = 0, y = 0}
    self.hover_offset = {x = 0, y = 0}

    --To keep track of all nodes created on pause. If true, this node moves normally even when the G.TIMERS.TOTAL doesn't increment
    self.created_on_pause = G.SETTINGS.paused
    
    --ID tracker, every Node has a unique ID
    G.ID = G.ID or 1
    self.ID = G.ID
    G.ID = G.ID + 1

    --Frame tracker to aid in not doing too many extra calculations
    self.FRAME = {
        DRAW = -1,
        MOVE = -1
    }

    --The states for this Node and all derived nodes. This is how we control the visibility and interactibility of any object
    --All nodes do not collide by default. This reduces the size of n for the O(n^2) collision detection
    self.states = {
        visible = true,
        collide = {can = false, is = false},
        focus = {can = false, is = false},
        hover = {can = true, is = false},
        click = {can = true, is = false},
        drag = {can = true, is = false},
        release_on = {can = true, is = false}
    }

    --If we provide a container, all nodes within that container are translated with that container as the reference frame.
    --For example, if G.ROOM is set at x = 5 and y = 5, and we create a new game object at 0, 0, it will actually be drawn at
    --5, 5. This allows us to control things like screen shake, room positioning, rotation, padding, etc. without needing to modify
    --every game object that we need to draw
    self.container = args.container or G.ROOM

    --The list of children give Node a treelike structure. This can be used for things like drawing, deterministice movement and parallax
    --calculations when child nodes rely on updated information from parents, and inherited attributes like button click functions
    if not self.children then
        self.children = {}
    end

    --Add this object to the appropriate instance table only if the metatable matches with NODE
    if getmetatable(self) == Node then 
        table.insert(G.I.NODE, self)
    end

    --Unless node was created during a stage transition (when G.STAGE_OBJECT_INTERRUPT is true), add all nodes to their appropriate
    --stage object table so they can be easily deleted on stage transition
    if not G.STAGE_OBJECT_INTERRUPT then
        table.insert(G.STAGE_OBJECTS[G.STAGE], self)
    end
end


--Draw a bounding rectangle representing the transform of this node. Used in debugging.
function Node:draw_boundingrect()
    self.under_overlay = G.under_overlay

    if G.DEBUG then
        local transform = self.VT or self.T
        love.graphics.push()
        love.graphics.scale(G.TILESCALE, G.TILESCALE)
        love.graphics.translate(transform.x*G.TILESIZE+transform.w*G.TILESIZE*0.5,
                                transform.y*G.TILESIZE+transform.h*G.TILESIZE*0.5)
        love.graphics.rotate(transform.r)
        love.graphics.translate(-transform.w*G.TILESIZE*0.5,
                                -transform.h*G.TILESIZE*0.5)
        if self.DEBUG_VALUE then
            love.graphics.setColor(1, 1, 0, 1)
            love.graphics.print((self.DEBUG_VALUE or ''), transform.w*G.TILESIZE,transform.h*G.TILESIZE, nil, 1/G.TILESCALE)
        end
        love.graphics.setLineWidth(1 + (self.states.focus.is and 1 or 0))
        if self.states.collide.is then 
            love.graphics.setColor(0, 1, 0, 0.3)
        else
            love.graphics.setColor(1, 0, 0, 0.3) 
        end
        if self.states.focus.can then 
            love.graphics.setColor(G.C.GOLD) 
            love.graphics.setLineWidth(1)
        end
        if self.CALCING then 
            love.graphics.setColor({0,0,1,1}) 
            love.graphics.setLineWidth(3)
        end
        love.graphics.rectangle('line', 0, 0, transform.w*G.TILESIZE,transform.h*G.TILESIZE, 3)
        love.graphics.pop() 
    end
end

--Draws self, then adds self the the draw hash, then draws all children
function Node:draw()
    self:draw_boundingrect()
    if self.states.visible then
        add_to_drawhash(self)
        for _, v in pairs(self.children) do
            v:draw()
        end
    end
end

--Determines if this node collides with some point. Applies any container translations and rotations, then\
--applies translations and rotations specific to this node. This means the collision detection effectively\
--determines if some point intersects this node regargless of rotation.
--
---@param point {x: number, y: number}
--**x and y** The coordinates of the cursor transformed into game units
function Node:collides_with_point(point)
    --First reset the collision state to false
    if self.container then
        local T = self.CT or self.T
        self.ARGS.collides_with_point_point = self.ARGS.collides_with_point_point or {}
        self.ARGS.collides_with_point_translation = self.ARGS.collides_with_point_translation or {}
        self.ARGS.collides_with_point_rotation = self.ARGS.collides_with_point_rotation or {}
        local _p = self.ARGS.collides_with_point_point
        local _t = self.ARGS.collides_with_point_translation
        local _r = self.ARGS.collides_with_point_rotation

        local _b = self.states.hover.is and G.COLLISION_BUFFER or 0

        _p.x, _p.y = point.x, point.y

        if self.container ~= self then --if there is some valid container, we need to apply all translations and rotations for the container first
            if math.abs(self.container.T.r) < 0.1 then
                --Translate to normalize this Node to the center of the container
                _t.x, _t.y = -self.container.T.w/2, -self.container.T.h/2
                point_translate(_p, _t)

                --Rotate node about the center of the container
                point_rotate(_p, self.container.T.r)
                
                --Translate node to undo the container translation, essentially reframing it in 'container' space
                _t.x, _t.y = self.container.T.w/2-self.container.T.x, self.container.T.h/2-self.container.T.y
                point_translate(_p, _t)
            else
                --Translate node to undo the container translation, essentially reframing it in 'container' space
                _t.x, _t.y = -self.container.T.x, -self.container.T.y
                point_translate(_p, _t)
            end
        end
        if math.abs(T.r) < 0.1 then
            --If we can essentially disregard transform rotation, just treat it like a normal rectangle
            if _p.x >= T.x - _b and _p.y >= T.y - _b and _p.x <= T.x + T.w + _b and _p.y <= T.y + T.h + _b then 
                return true
            end
        else
            --Otherwise we need to do some silly point rotation garbage to determine if the point intersects the rotated rectangle
            _r.cos, _r.sin = math.cos(T.r+math.pi/2), math.sin(T.r+math.pi/2)
            _p.x, _p.y = _p.x - (T.x + 0.5*(T.w)), _p.y - (T.y + 0.5*(T.h))
            _t.x, _t.y = _p.y*_r.cos - _p.x*_r.sin, _p.y*_r.sin + _p.x*_r.cos
            _p.x, _p.y = _t.x + (T.x + 0.5*(T.w)), _t.y + (T.y + 0.5*(T.h))

            if _p.x >= T.x - _b and _p.y >= T.y - _b
            and _p.x <= T.x + T.w + _b and _p.y <= T.y + T.h + _b then 
                return true
            end
        end
    end
end

--Sets the offset of passed point in terms of this nodes T.x and T.y
--
---@param point {x: number, y: number}
---@param type string
--**x and y** The coordinates of the cursor transformed into game units
--**type** the type of offset to set for this Node, either 'Click' or 'Hover'
function Node:set_offset(point, type)
    self.ARGS.set_offset_point = self.ARGS.set_offset_point or {}
    self.ARGS.set_offset_translation = self.ARGS.set_offset_translation or {}
    local _p = self.ARGS.set_offset_point
    local _t = self.ARGS.set_offset_translation

    _p.x, _p.y = point.x, point.y

    --Translate to middle of the container
    _t.x = -self.container.T.w/2
    _t.y = -self.container.T.h/2
    point_translate(_p, _t)

    --Rotate about the container midpoint according to node rotation
    point_rotate(_p, self.container.T.r)

    --Translate node to undo the container translation, essentially reframing it in 'container' space
    _t.x = self.container.T.w/2-self.container.T.x
    _t.y = self.container.T.h/2-self.container.T.y
    point_translate(_p, _t)

    if type == 'Click' then
        self.click_offset.x = (_p.x - self.T.x)
        self.click_offset.y = (_p.y - self.T.y)
    elseif type == 'Hover' then
        self.hover_offset.x = (_p.x - self.T.x)
        self.hover_offset.y = (_p.y - self.T.y)
    end
end

--If the current container is being 'Dragged', usually by a cursor, determine if any drag popups need to be generated and do so
function Node:drag()
    if self.config and self.config.d_popup then
        if not self.children.d_popup then 
            self.children.d_popup = UIBox{
                definition = self.config.d_popup,
                config = self.config.d_popup_config
            }
            self.children.h_popup.states.collide.can = false
            table.insert(G.I.POPUP, self.children.d_popup)
            self.children.d_popup.states.drag.can = true
        end
    end
end

--Determines if this Node can be dragged. This is a simple function but more complex objects may redefine this to return a parent\
--if the parent needs to drag other children with it
function Node:can_drag()
    return self.states.drag.can and self or nil
end

--Called by the CONTROLLER when this node is no longer being dragged, removes any d_popups
function Node:stop_drag()
    if self.children.d_popup then
        for k, v in pairs(G.I.POPUP) do
            if v == self.children.d_popup then
                table.remove(G.I.POPUP, k)
            end
        end
        self.children.d_popup:remove()
        self.children.d_popup = nil
    end
end

--If the current container is being 'Hovered', usually by a cursor, determine if any hover popups need to be generated and do so
function Node:hover() 
    if self.config and self.config.h_popup then
        if not self.children.h_popup then 
            self.config.h_popup_config.instance_type = 'POPUP'
            self.children.h_popup = UIBox{
                definition = self.config.h_popup,
                config = self.config.h_popup_config,
            }
            self.children.h_popup.states.collide.can = false
            self.children.h_popup.states.drag.can = true
        end
    end
end

--Called by the CONTROLLER when this node is no longer being hovered, removes any h_popups
function Node:stop_hover()
    if self.children.h_popup then
        self.children.h_popup:remove()
        self.children.h_popup = nil
    end
end

--Called by the CONTROLLER to determine the position the cursor should be set to for this node
function Node:put_focused_cursor()
    return (self.T.x + self.T.w/2 + self.container.T.x)*(G.TILESCALE*G.TILESIZE), (self.T.y + self.T.h/2 + self.container.T.y)*(G.TILESCALE*G.TILESIZE)
end

--Sets the container of this node and all child nodes to be a new container node
--
---@param container Node The new node that will behave as this nodes container
function Node:set_container(container)
    if self.children then
        for _, v in pairs(self.children) do
            v:set_container(container)
        end
    end
    self.container = container
end

--Translation function used before any draw calls, translates this node according to the transform of the container node
function Node:translate_container()
    if self.container and self.container ~= self then
        love.graphics.translate(self.container.T.w*G.TILESCALE*G.TILESIZE*0.5, self.container.T.h*G.TILESCALE*G.TILESIZE*0.5)
        love.graphics.rotate(self.container.T.r)
        love.graphics.translate(
            -self.container.T.w*G.TILESCALE*G.TILESIZE*0.5 + self.container.T.x*G.TILESCALE*G.TILESIZE,
            -self.container.T.h*G.TILESCALE*G.TILESIZE*0.5 + self.container.T.y*G.TILESCALE*G.TILESIZE)
    end
end

--When this Node needs to be deleted, removes self from any tables it may have been added to to destroy any weak references\
--Also calls the remove method of all children to have them do the same
function Node:remove() 

    for k, v in pairs(G.I.POPUP) do
        if v == self then
            table.remove(G.I.POPUP, k)
            break;
        end
    end
    for k, v in pairs(G.I.NODE) do
        if v == self then
            table.remove(G.I.NODE, k)
            break;
        end
    end
    for k, v in pairs(G.STAGE_OBJECTS[G.STAGE]) do
        if v == self then
            table.remove(G.STAGE_OBJECTS[G.STAGE], k)
            break;
        end
    end
    if self.children then 
        for k, v in pairs(self.children) do
            v:remove()
        end 
    end
    if G.CONTROLLER.clicked.target ==self then 
        G.CONTROLLER.clicked.target = nil
    end
    if G.CONTROLLER.focused.target ==self then 
        G.CONTROLLER.focused.target = nil
    end
    if G.CONTROLLER.dragging.target ==self then 
        G.CONTROLLER.dragging.target = nil
    end
    if G.CONTROLLER.hovering.target ==self then 
        G.CONTROLLER.hovering.target = nil
    end
    if G.CONTROLLER.released_on.target ==self then 
        G.CONTROLLER.released_on.target = nil
    end
    if G.CONTROLLER.cursor_down.target ==self then 
        G.CONTROLLER.cursor_down.target = nil
    end
    if G.CONTROLLER.cursor_up.target ==self then 
        G.CONTROLLER.cursor_up.target = nil
    end
    if G.CONTROLLER.cursor_hover.target ==self then 
        G.CONTROLLER.cursor_hover.target = nil
    end
    
    self.REMOVED = true
end

--returns the squared(fast) distance in game units from the center of this node to the center of another node
--
---@param other_node Node to measure the distance from
function Node:fast_mid_dist(other_node)
    return math.sqrt((other_node.T.x + 0.5*other_node.T.w) - (self.T.x + self.T.w))^2 + ((other_node.T.y + 0.5*other_node.T.h) - (self.T.y + self.T.h))^2
end

--Prototype for a click release function, when the cursor is released on this node
function Node:release(dragged) end

--Prototype for a click function
function Node:click() end

--Prototype animation function for any frame manipulation needed 
function Node:animate() end

--Prototype update function for any object specific logic that needs to occur every frame
function Node:update(dt) end
