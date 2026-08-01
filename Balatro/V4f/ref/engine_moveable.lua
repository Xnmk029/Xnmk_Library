---@class Moveable: Node
Moveable = Node:extend()

--Moveable represents any game object that has the ability to move about the gamespace.\
--All Moveables have a T (transform) that describes their desired transform in game units, as\
--well as a VT (Visible Transform) that eases to T over time. This allows for simplified movement where\
--we only need to set T.x, T.y, etc. to their final position and the engine will ensure the Moveable\
--VT eases to that final location, regargless of any events or timing.
--
---@param args {T: table, container: Node}
--**T** The transform ititializer, with keys of x|1, y|2, w|3, h|4, r|5\
--**container** optional container for this Node, defaults to G.ROOM
function Moveable:init(X,Y,W,H)
    local args = (type(X) == 'table') and X or {T ={X or 0,Y or 0,W or 0,H or 0}}
    Node.init(self, args)

    --The Visible transform is initally set to the same values as the transform T.
    --Note that the VT has an extra 'scale' factor, this is used to manipulate the center-adjusted
    --scale of any objects that need to be drawn larger or smaller
    self.VT = {
        x = self.T.x,
        y = self.T.y,
        w = self.T.w,
        h = self.T.h,
        r = self.T.r,
        scale = self.T.scale
    }

    --To determine location of VT, we need to keep track of the velocity of VT as it approaches T for the next frame
    self.velocity = {x = 0, y = 0, r = 0, scale = 0, mag = 0}

    --For more robust drawing, attaching, movement and fewer redundant movement calculations, Moveables each have a 'role'
    --that describes a heirarchy of move() calls. Any Moveables with 'Major' role type behave normally, essentially recalculating their
    --VT every frame to ensure smooth movement. Moveables can be set to 'Minor' role and attached to some 'Major' moveable
    --to weld the Minor moveable to the Major moveable. This makes the dependent moveable set their T and VT to be equal to 
    --the corresponding 'Major' T and VT, plus some defined offset.
    --For finer control over what parts of T and VT are inherited, xy_bond, wh_bond, and r_bond can be set to one of
    --'Strong' or 'Weak'. Strong simply copies the values, Weak allows the 'Minor' moveable to calculate their own.
    self.role = {
        role_type = 'Major', --Major dictates movement, Minor is welded to some major
        offset = {x = 0, y = 0}, --Offset from Minor to Major
        major = nil,
        draw_major = self,
        xy_bond = 'Strong',
        wh_bond = 'Strong',
        r_bond = 'Strong',
        scale_bond = 'Strong'
    }

    self.alignment = {
        type = 'a',
        offset = {x = 0, y = 0},
        prev_type = '',
        prev_offset = {x = 0, y = 0},
    }

    --the pinch table is used to modify the VT.w and VT.h compared to T.w and T.h. If either x or y pinch is
    --set to true, the VT width and or height will ease to 0. If pinch is false, they ease to T.w or T.h
    self.pinch = {x = false, y = false}

    --Keep track of the last time this Moveable was moved via :move(dt). When it is successfully moved, set to equal
    --the current G.TIMERS.REAL, and if it is called again this frame, doesn't recalculate move(dt)
    self.last_moved = -1
    self.last_aligned = -1

    self.static_rotation = false

    self.offset = {x=0, y=0}
    self.Mid = self

    self.shadow_parrallax = {x = 0, y = -1.5}
    self.layered_parallax = {x = 0, y = 0}
    self.shadow_height = 0.2

    self:calculate_parrallax()

    table.insert(G.MOVEABLES, self)
    if getmetatable(self) == Moveable then 
        table.insert(G.I.MOVEABLE, self)
    end
end
function Moveable:draw()
    Node.draw(self)
    self:draw_boundingrect()
end

--Sets the alignment of moveable using roles
--
---@param args {major: Moveable, bond: string, offset: table, type: string}
--**major** The moveable this moveable will attach to\
--**bond** The bond type, either 'Strong' or 'Weak'. Strong instantly adjusts VT, Weak manually calculates VT changes\
--**offset** {x , y} offset from the alignment\
--**type** the alignment type. Vertical options: c - center, t - top, b - bottom. Horizontal options: l - left, m - middle, r - right. i for inner
function Moveable:set_alignment(args)
    args = args or {}
    if args.major then 
        self:set_role({
            role_type = 'Minor',
            major = args.major,
            xy_bond = args.bond or args.xy_bond or 'Weak',
            wh_bond = args.wh_bond or self.role.wh_bond,
            r_bond = args.r_bond or self.role.r_bond,
            scale_bond = args.scale_bond or self.role.scale_bond,
        })
    end
    self.alignment.type = args.type or self.alignment.type
    if args.offset and (type(args.offset)=='table' and not (args.offset.y and args.offset.x)) or type(args.offset) ~= 'table' then
        args.offset = nil
    end
    self.alignment.offset = args.offset or self.alignment.offset
    self.alignment.lr_clamp = args.lr_clamp
end

function Moveable:align_to_major()
    if self.alignment.type ~= self.alignment.prev_type then 
        self.alignment.type_list = {
            a = self.alignment.type == 'a',
            m = string.find(self.alignment.type, "m"),
            c = string.find(self.alignment.type, "c"),
            b = string.find(self.alignment.type, "b"),
            t = string.find(self.alignment.type, "t"),
            l = string.find(self.alignment.type, "l"),
            r = string.find(self.alignment.type, "r"),
            i = string.find(self.alignment.type, "i"),
        }
    end
    
    if  self.alignment.prev_offset.x == self.alignment.offset.x and
    self.alignment.prev_offset.y == self.alignment.offset.y and 
    self.alignment.prev_type == self.alignment.type then return end

    self.NEW_ALIGNMENT = true

    if self.alignment.type ~= self.alignment.prev_type then 
        self.alignment.prev_type = self.alignment.type
    end

    if self.alignment.type_list.a or not self.role.major then return end
    
    if self.alignment.type_list.m then
        self.role.offset.x = 0.5*self.role.major.T.w - (self.Mid.T.w)/2 + self.alignment.offset.x - self.Mid.T.x + self.T.x
    end

    if self.alignment.type_list.c then
        self.role.offset.y = 0.5*self.role.major.T.h - (self.Mid.T.h)/2 + self.alignment.offset.y - self.Mid.T.y + self.T.y
    end

    if self.alignment.type_list.b then
        if self.alignment.type_list.i then
            self.role.offset.y = self.alignment.offset.y + self.role.major.T.h - self.T.h
        else
            self.role.offset.y = self.alignment.offset.y + self.role.major.T.h
        end
    end

    if self.alignment.type_list.r then
        if self.alignment.type_list.i then
            self.role.offset.x = self.alignment.offset.x + self.role.major.T.w - self.T.w
        else
            self.role.offset.x = self.alignment.offset.x + self.role.major.T.w
        end
    end

    if self.alignment.type_list.t then
        if self.alignment.type_list.i then
            self.role.offset.y = self.alignment.offset.y
        else
            self.role.offset.y = self.alignment.offset.y - self.T.h
        end
    end

    if self.alignment.type_list.l then
        if self.alignment.type_list.i then
            self.role.offset.x = self.alignment.offset.x
        else
            self.role.offset.x = self.alignment.offset.x - self.T.w
        end
    end
    
    self.role.offset.x = self.role.offset.x or 0
    self.role.offset.y = self.role.offset.y or 0

    self.T.x = self.role.major.T.x + self.role.offset.x
    self.T.y = self.role.major.T.y + self.role.offset.y

    self.alignment.prev_offset = self.alignment.prev_offset or {}
    self.alignment.prev_offset.x, self.alignment.prev_offset.y = self.alignment.offset.x, self.alignment.offset.y
end

function Moveable:hard_set_T(X, Y, W, H)
    self.T.x = X
    self.T.y = Y
    self.T.w = W
    self.T.h = H

    self.velocity.x = 0
    self.velocity.y = 0
    self.velocity.r = 0
    self.velocity.scale = 0

    self.VT.x = X
    self.VT.y = Y
    self.VT.w = W
    self.VT.h = H
    self.VT.r = self.T.r
    self.VT.scale = self.T.scale
    self:calculate_parrallax()
end

function Moveable:hard_set_VT()
    self.VT.x = self.T.x
    self.VT.y = self.T.y
    self.VT.w = self.T.w
    self.VT.h = self.T.h
end

function Moveable:drag(offset)
    if self.states.drag.can or offset then
        self.ARGS.drag_cursor_trans = self.ARGS.drag_cursor_trans or {}
        self.ARGS.drag_translation = self.ARGS.drag_translation or {}
        local _p = self.ARGS.drag_cursor_trans
        local _t = self.ARGS.drag_translation
        _p.x = G.CONTROLLER.cursor_position.x/(G.TILESCALE*G.TILESIZE)
        _p.y = G.CONTROLLER.cursor_position.y/(G.TILESCALE*G.TILESIZE)

        _t.x, _t.y = -self.container.T.w/2, -self.container.T.h/2
        point_translate(_p, _t)

        point_rotate(_p, self.container.T.r)

        _t.x, _t.y = self.container.T.w/2-self.container.T.x, self.container.T.h/2-self.container.T.y
        point_translate(_p, _t)
        
        if not offset then 
            offset = self.click_offset
        end

        self.T.x = _p.x - offset.x
        self.T.y = _p.y - offset.y
        self.NEW_ALIGNMENT = true
        for k, v in pairs(self.children) do
            v:drag(offset)
        end
    end
    if self.states.drag.can then
        Node.drag(self)
    end
end

function Moveable:juice_up(amount, rot_amt)
    if G.SETTINGS.reduced_motion then return end
    local amount = amount or 0.4

    local end_time = G.TIMERS.REAL + 0.4
    local start_time = G.TIMERS.REAL
    self.juice = {
        scale = 0,
        scale_amt = amount,
        r = 0,
        r_amt = ((rot_amt or pseudorandom_element({0.6*amount, -0.6*amount})) or 0),
        start_time = start_time, 
        end_time = end_time
    }
    self.VT.scale = 1-0.6*amount
end

function Moveable:move_juice(dt)
    if self.juice and not self.juice.handled_elsewhere then
        if self.juice.end_time < G.TIMERS.REAL then
            self.juice = nil
        else
            self.juice.scale =  self.juice.scale_amt*math.sin(50.8*(G.TIMERS.REAL-self.juice.start_time))*math.max(0, ((self.juice.end_time - G.TIMERS.REAL)/(self.juice.end_time - self.juice.start_time))^3)
            self.juice.r = self.juice.r_amt*math.sin(40.8*(G.TIMERS.REAL-self.juice.start_time))*math.max(0, ((self.juice.end_time - G.TIMERS.REAL)/(self.juice.end_time - self.juice.start_time))^2)
        end
    end
end

function Moveable:move(dt)
    if self.FRAME.MOVE >= G.FRAMES.MOVE then return end
    self.FRAME.OLD_MAJOR = self.FRAME.MAJOR
    self.FRAME.MAJOR = nil
    self.FRAME.MOVE = G.FRAMES.MOVE
    if not self.created_on_pause and G.SETTINGS.paused then return end

    --WHY ON EARTH DOES THIS LINE MAKE IT RUN 2X AS FAST???
    -------------------------------------------------------
    --local timestart = love.timer.getTime()
    -------------------------------------------------------
    
    self:align_to_major()

    self.CALCING = nil
    if self.role.role_type == 'Glued' then
        if self.role.major then self:glue_to_major(self.role.major) end
    elseif self.role.role_type == 'Minor' and self.role.major then
        if self.role.major.FRAME.MOVE < G.FRAMES.MOVE then self.role.major:move(dt) end
        self.STATIONARY = self.role.major.STATIONARY
        if (not self.STATIONARY) or self.NEW_ALIGNMENT or
            self.config.refresh_movement or
            self.juice or
            self.role.xy_bond == 'Weak' or 
            self.role.r_bond == 'Weak' then  
                self.CALCING = true
                self:move_with_major(dt) 
        end
    elseif self.role.role_type == 'Major' then 
        self.STATIONARY = true
        self:move_juice(dt)
        self:move_xy(dt)
        self:move_r(dt, self.velocity)
        self:move_scale(dt)
        self:move_wh(dt)
        self:calculate_parrallax()
    end
    if self.alignment and self.alignment.lr_clamp then
        self:lr_clamp()
    end

    self.NEW_ALIGNMENT = false
end

function Moveable:lr_clamp()
    if self.T.x < 0 then self.T.x = 0 end
    if self.VT.x < 0 then self.VT.x = 0 end
    if (self.T.x + self.T.w) > G.ROOM.T.w then self.T.x = G.ROOM.T.w - self.T.w end
    if (self.VT.x + self.VT.w) > G.ROOM.T.w  then self.VT.x = G.ROOM.T.w - self.VT.w end
end

function Moveable:glue_to_major(major_tab)
    self.T = major_tab.T

    self.VT.x = major_tab.VT.x + (0.5*(1 - major_tab.VT.w/(major_tab.T.w))*self.T.w)
    self.VT.y = major_tab.VT.y
    self.VT.w = major_tab.VT.w
    self.VT.h = major_tab.VT.h
    self.VT.r = major_tab.VT.r
    self.VT.scale = major_tab.VT.scale

    self.pinch = major_tab.pinch
    self.shadow_parrallax = major_tab.shadow_parrallax
end

MWM = {
    rotated_offset = {},
    angles = {},
    WH = {},
    offs = {},
}

function Moveable:move_with_major(dt)
    if self.role.role_type ~= 'Minor' then return end
    local major_tab = self.role.major:get_major()

    self:move_juice(dt)

    if self.role.r_bond == 'Weak' then 
        MWM.rotated_offset.x, MWM.rotated_offset.y = self.role.offset.x + major_tab.offset.x,self.role.offset.y+major_tab.offset.y
    else
        if major_tab.major.VT.r < 0.0001 and major_tab.major.VT.r > -0.0001 then 
            MWM.rotated_offset.x = self.role.offset.x + major_tab.offset.x
            MWM.rotated_offset.y = self.role.offset.y + major_tab.offset.y
        else
            MWM.angles.cos, MWM.angles.sin = math.cos(major_tab.major.VT.r),math.sin(major_tab.major.VT.r)
            MWM.WH.w, MWM.WH.h = -self.T.w/2 + major_tab.major.T.w/2,-self.T.h/2 + major_tab.major.T.h/2
            MWM.offs.x, MWM.offs.y = self.role.offset.x + major_tab.offset.x - MWM.WH.w,self.role.offset.y + major_tab.offset.y - MWM.WH.h

            MWM.rotated_offset.x = MWM.offs.x*MWM.angles.cos - MWM.offs.y*MWM.angles.sin + MWM.WH.w
            MWM.rotated_offset.y = MWM.offs.x*MWM.angles.sin + MWM.offs.y*MWM.angles.cos + MWM.WH.h
        end
    end

    self.T.x = major_tab.major.T.x + MWM.rotated_offset.x
    self.T.y = major_tab.major.T.y + MWM.rotated_offset.y

    if self.role.xy_bond == 'Strong' then
        self.VT.x = major_tab.major.VT.x + MWM.rotated_offset.x
        self.VT.y = major_tab.major.VT.y + MWM.rotated_offset.y
    elseif self.role.xy_bond == 'Weak' then
        self:move_xy(dt)
    end

    if self.role.r_bond == 'Strong' then
        self.VT.r = self.T.r + major_tab.major.VT.r + (self.juice and self.juice.r or 0)
    elseif self.role.r_bond == 'Weak' then 
        self:move_r(dt, self.velocity)
    end

    if self.role.scale_bond == 'Strong' then
        self.VT.scale = self.T.scale*(major_tab.major.VT.scale/major_tab.major.T.scale) + (self.juice and self.juice.scale or 0)
    elseif self.role.scale_bond == 'Weak' then 
        self:move_scale(dt)
    end

    if self.role.wh_bond == 'Strong' then
        self.VT.x = self.VT.x + (0.5*(1 - major_tab.major.VT.w/(major_tab.major.T.w))*self.T.w)
        self.VT.w = (self.T.w)*(major_tab.major.VT.w/major_tab.major.T.w)
        self.VT.h = (self.T.h)*(major_tab.major.VT.h/major_tab.major.T.h)
    elseif self.role.wh_bond == 'Weak' then
        self:move_wh(dt)
    end

    self:calculate_parrallax()
end

function Moveable:move_xy(dt)
    if  (self.T.x ~= self.VT.x or math.abs(self.velocity.x) > 0.01) or 
        (self.T.y ~= self.VT.y or math.abs(self.velocity.y) > 0.01) then
        self.velocity.x = G.exp_times.xy*self.velocity.x + (1-G.exp_times.xy)*(self.T.x - self.VT.x)*35*dt
        self.velocity.y = G.exp_times.xy*self.velocity.y + (1-G.exp_times.xy)*(self.T.y - self.VT.y)*35*dt
        if self.velocity.x*self.velocity.x + self.velocity.y*self.velocity.y > G.exp_times.max_vel*G.exp_times.max_vel then 
            local actual_vel = math.sqrt(self.velocity.x*self.velocity.x + self.velocity.y*self.velocity.y)
            self.velocity.x = G.exp_times.max_vel*self.velocity.x/actual_vel
            self.velocity.y = G.exp_times.max_vel*self.velocity.y/actual_vel
        end
        self.STATIONARY = false
        self.VT.x = self.VT.x + self.velocity.x
        self.VT.y = self.VT.y + self.velocity.y
        if math.abs(self.VT.x - self.T.x) < 0.01 and math.abs(self.velocity.x) < 0.01 then self.VT.x = self.T.x; self.velocity.x = 0 end
        if math.abs(self.VT.y - self.T.y) < 0.01 and math.abs(self.velocity.y) < 0.01 then self.VT.y = self.T.y; self.velocity.y = 0 end
    end
end

function Moveable:move_scale(dt)
    local des_scale = self.T.scale + (self.zoom and ((self.states.drag.is and 0.1 or 0) + (self.states.hover.is and 0.05 or 0)) or 0) + (self.juice and self.juice.scale or 0)

    if  des_scale ~= self.VT.scale or
        math.abs(self.velocity.scale) > 0.001 then
            self.STATIONARY = false
        self.velocity.scale = G.exp_times.scale*self.velocity.scale + (1-G.exp_times.scale)*(des_scale - self.VT.scale)
        self.VT.scale = self.VT.scale + self.velocity.scale
    end
end

function Moveable:move_wh(dt)
    if (self.T.w ~= self.VT.w and not self.pinch.x) or 
        (self.T.h ~= self.VT.h and not self.pinch.y) or 
        (self.VT.w > 0 and self.pinch.x) or 
        (self.VT.h > 0 and self.pinch.y) then
            self.STATIONARY = false
            self.VT.w = self.VT.w + (8*dt)*(self.pinch.x and -1 or 1)*self.T.w
            self.VT.h = self.VT.h + (8*dt)*(self.pinch.y and -1 or 1)*self.T.h
            self.VT.w = math.max(math.min(self.VT.w, self.T.w), 0)
            self.VT.h = math.max(math.min(self.VT.h, self.T.h), 0)
    end
end

function Moveable:move_r(dt, vel)
    local des_r = self.T.r +0.015*vel.x/dt + (self.juice and self.juice.r*2 or 0) 

    if  des_r ~= self.VT.r or
        math.abs(self.velocity.r) > 0.001 then
            self.STATIONARY = false
        self.velocity.r = G.exp_times.r*self.velocity.r + (1-G.exp_times.r)*(des_r - self.VT.r)
        self.VT.r = self.VT.r + self.velocity.r 
    end
    if math.abs(self.VT.r - self.T.r) < 0.001 and  math.abs(self.velocity.r) < 0.001 then self.VT.r = self.T.r; self.velocity.r = 0 end
end

function Moveable:calculate_parrallax()
    if not G.ROOM then return end
    self.shadow_parrallax.x = (self.T.x + self.T.w/2 - G.ROOM.T.w/2)/(G.ROOM.T.w/2)*1.5
end

function Moveable:set_role(args)
    if args.major and not args.major.set_role then return end
    if args.offset and (type(args.offset)=='table' and not (args.offset.y and args.offset.x)) or type(args.offset) ~= 'table' then
        args.offset = nil
    end
    self.role = {
        role_type = args.role_type or self.role.role_type,
        offset = args.offset or self.role.offset,
        major = args.major or self.role.major,
        xy_bond = args.xy_bond or self.role.xy_bond,
        wh_bond = args.wh_bond or self.role.wh_bond,
        r_bond = args.r_bond or self.role.r_bond,
        scale_bond = args.scale_bond or self.role.scale_bond,
        draw_major = args.draw_major or self.role.draw_major,
    }
    if self.role.role_type == 'Major' then self.role.major = nil end
end

function Moveable:get_major()
    if ( self.role.role_type ~= 'Major' and self.role.major ~= self) and (self.role.xy_bond ~= 'Weak' and self.role.r_bond ~= 'Weak') then
        --First, does the major already have their offset precalculated for this frame?
        if not self.FRAME.MAJOR or (G.REFRESH_FRAME_MAJOR_CACHE) then
            self.FRAME.MAJOR = self.FRAME.MAJOR or EMPTY(self.FRAME.OLD_MAJOR)
            self.temp_offs = EMPTY(self.temp_offs)
            local major = self.role.major:get_major()
            self.FRAME.MAJOR.major = major.major
            self.FRAME.MAJOR.offset = self.FRAME.MAJOR.offset or self.temp_offs
            self.FRAME.MAJOR.offset.x, self.FRAME.MAJOR.offset.y = major.offset.x + self.role.offset.x + self.layered_parallax.x, major.offset.y + self.role.offset.y + self.layered_parallax.y
        end 
        return self.FRAME.MAJOR
    else
        self.ARGS.get_major = self.ARGS.get_major or {}
        self.ARGS.get_major.major = self
        self.ARGS.get_major.offset = self.ARGS.get_major.offset or {}
        self.ARGS.get_major.offset.x, self.ARGS.get_major.offset.y = 0,0
        return self.ARGS.get_major
    end
end

function Moveable:remove()
    for k, v in pairs(G.MOVEABLES) do
        if v == self then
            table.remove(G.MOVEABLES, k)
            break;
        end
    end
    for k, v in pairs(G.I.MOVEABLE) do
        if v == self then
            table.remove(G.I.MOVEABLE, k)
            break;
        end
    end
    Node.remove(self)
end
