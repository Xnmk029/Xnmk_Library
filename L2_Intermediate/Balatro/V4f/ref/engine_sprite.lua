--Class
Sprite = Moveable:extend()

--Class Methods
function Sprite:init(X, Y, W, H, new_sprite_atlas, sprite_pos)
    Moveable.init(self,X, Y, W, H)
    self.CT = self.VT
    self.atlas = new_sprite_atlas
    self.scale = {x=self.atlas.px, y=self.atlas.py}
    self.scale_mag = math.min(self.scale.x/W,self.scale.y/H)
    self.zoom = true

    self:set_sprite_pos(sprite_pos)

    if getmetatable(self) == Sprite then 
        table.insert(G.I.SPRITE, self)
    end
end

function Sprite:reset()
    self.atlas = G.ASSET_ATLAS[self.atlas.name]
    self:set_sprite_pos(self.sprite_pos)
end

function Sprite:set_sprite_pos(sprite_pos)
    if sprite_pos and sprite_pos.v then 
        self.sprite_pos = {x = (math.random(sprite_pos.v)-1), y = sprite_pos.y}
    else
        self.sprite_pos = sprite_pos or {x=0,y=0}
    end
    self.sprite_pos_copy = {x = self.sprite_pos.x, y = self.sprite_pos.y}

    self.sprite = love.graphics.newQuad( 
        self.sprite_pos.x*self.atlas.px,
        self.sprite_pos.y*self.atlas.py,
        self.scale.x,
        self.scale.y, self.atlas.image:getDimensions())

    self.image_dims = {}
    self.image_dims[1], self.image_dims[2] = self.atlas.image:getDimensions()
end

function Sprite:get_pos_pixel()
    self.RETS.get_pos_pixel = self.RETS.get_pos_pixel or {}
    self.RETS.get_pos_pixel[1] = self.sprite_pos.x
    self.RETS.get_pos_pixel[2] = self.sprite_pos.y
    self.RETS.get_pos_pixel[3] = self.atlas.px --self.scale.x
    self.RETS.get_pos_pixel[4] = self.atlas.py --self.scale.y
    return self.RETS.get_pos_pixel
end

function Sprite:get_image_dims()
    return self.image_dims
end

function Sprite:define_draw_steps(draw_step_definitions)
    self.draw_steps = EMPTY(self.draw_steps)
    for k, v in ipairs(draw_step_definitions) do
        self.draw_steps[#self.draw_steps+1] = {
            shader = v.shader or 'dissolve',
            shadow_height = v.shadow_height or nil,
            send = v.send or nil,
            no_tilt = v.no_tilt or nil,
            other_obj = v.other_obj or nil,
            ms = v.ms or nil,
            mr = v.mr or nil,
            mx = v.mx or nil,
            my = v.my or nil
        }
    end
end

function Sprite:draw_shader(_shader, _shadow_height, _send, _no_tilt, other_obj, ms, mr, mx, my, custom_shader, tilt_shadow)
    if G.SETTINGS.reduced_motion then _no_tilt = true end
    local _draw_major = self.role.draw_major or self
    if _shadow_height then 
        self.VT.y = self.VT.y - _draw_major.shadow_parrallax.y*_shadow_height
        self.VT.x = self.VT.x - _draw_major.shadow_parrallax.x*_shadow_height
        self.VT.scale = self.VT.scale*(1-0.2*_shadow_height)
    end

    if custom_shader then 
        if _send then 
            for k, v in ipairs(_send) do
                G.SHADERS[_shader]:send(v.name, v.val or (v.func and v.func()) or v.ref_table[v.ref_value])
            end
        end
    elseif _shader == 'vortex' then 
        G.SHADERS['vortex']:send('vortex_amt', G.TIMERS.REAL - (G.vortex_time or 0))
    else
        self.ARGS.prep_shader = self.ARGS.prep_shader or {}
        self.ARGS.prep_shader.cursor_pos = self.ARGS.prep_shader.cursor_pos or {}
        self.ARGS.prep_shader.cursor_pos[1] = _draw_major.tilt_var and _draw_major.tilt_var.mx*G.CANV_SCALE or G.CONTROLLER.cursor_position.x*G.CANV_SCALE
        self.ARGS.prep_shader.cursor_pos[2] = _draw_major.tilt_var and _draw_major.tilt_var.my*G.CANV_SCALE or G.CONTROLLER.cursor_position.y*G.CANV_SCALE

        G.SHADERS[_shader or 'dissolve']:send('mouse_screen_pos', self.ARGS.prep_shader.cursor_pos)
        G.SHADERS[_shader or 'dissolve']:send('screen_scale', G.TILESCALE*G.TILESIZE*(_draw_major.mouse_damping or 1)*G.CANV_SCALE)
        G.SHADERS[_shader or 'dissolve']:send('hovering',((_shadow_height  and not tilt_shadow) or _no_tilt) and 0 or (_draw_major.hover_tilt or 0)*(tilt_shadow or 1))
        G.SHADERS[_shader or 'dissolve']:send("dissolve",math.abs(_draw_major.dissolve or 0))
        G.SHADERS[_shader or 'dissolve']:send("time",123.33412*(_draw_major.ID/1.14212 or 12.5123152)%3000)
        G.SHADERS[_shader or 'dissolve']:send("texture_details",self:get_pos_pixel())
        G.SHADERS[_shader or 'dissolve']:send("image_details",self:get_image_dims())
        G.SHADERS[_shader or 'dissolve']:send("burn_colour_1",_draw_major.dissolve_colours and _draw_major.dissolve_colours[1] or G.C.CLEAR)
        G.SHADERS[_shader or 'dissolve']:send("burn_colour_2",_draw_major.dissolve_colours and _draw_major.dissolve_colours[2] or G.C.CLEAR)
        G.SHADERS[_shader or 'dissolve']:send("shadow",(not not _shadow_height))
        if _send then G.SHADERS[_shader or 'dissolve']:send(_shader,_send) end
    end

    love.graphics.setShader( G.SHADERS[_shader or 'dissolve'],  G.SHADERS[_shader or 'dissolve'])

    if other_obj then 
        self:draw_from(other_obj, ms, mr, mx, my)
    else 
        self:draw_self()
    end

    love.graphics.setShader()

    if _shadow_height then 
        self.VT.y = self.VT.y + _draw_major.shadow_parrallax.y*_shadow_height
        self.VT.x = self.VT.x + _draw_major.shadow_parrallax.x*_shadow_height
        self.VT.scale = self.VT.scale/(1-0.2*_shadow_height)
    end
end

function Sprite:draw_self(overlay)
    if not self.states.visible then return end
    if self.sprite_pos.x ~= self.sprite_pos_copy.x or self.sprite_pos.y ~= self.sprite_pos_copy.y then
        self:set_sprite_pos(self.sprite_pos)
    end
    prep_draw(self, 1)
    love.graphics.scale(1/(self.scale.x/self.VT.w), 1/(self.scale.y/self.VT.h))
    love.graphics.setColor(overlay or G.BRUTE_OVERLAY or G.C.WHITE)
    if self.video then 
        self.video_dims = self.video_dims or {
            w = self.video:getWidth(),
            h = self.video:getHeight(),
        }
        love.graphics.draw(
            self.video,
            0 ,0,
            0,
            self.VT.w/(self.T.w)/(self.video_dims.w/self.scale.x),
            self.VT.h/(self.T.h)/(self.video_dims.h/self.scale.y)
        )
    else
        love.graphics.draw(
            self.atlas.image,
            self.sprite,
            0 ,0,
            0,
            self.VT.w/(self.T.w),
            self.VT.h/(self.T.h)
        )
    end
    love.graphics.pop()
    add_to_drawhash(self)
    self:draw_boundingrect()
    if self.shader_tab then love.graphics.setShader() end
end

function Sprite:draw(overlay)
    if not self.states.visible then return end
    if self.draw_steps then 
        for k, v in ipairs(self.draw_steps) do
            self:draw_shader(v.shader, v.shadow_height, v.send, v.no_tilt, v.other_obj, v.ms, v.mr, v.mx, v.my, not not v.send)
        end
    else
        self:draw_self(overlay)
    end
    
    add_to_drawhash(self)
    for k, v in pairs(self.children) do
        if k ~= 'h_popup' then v:draw() end
    end
    add_to_drawhash(self)
    self:draw_boundingrect()
end

function Sprite:draw_from(other_obj, ms, mr, mx, my)
    self.ARGS.draw_from_offset = self.ARGS.draw_from_offset or {}
    self.ARGS.draw_from_offset.x = mx or 0
    self.ARGS.draw_from_offset.y = my or 0
    prep_draw(other_obj, (1 + (ms or 0)), (mr or 0), self.ARGS.draw_from_offset, true)
    love.graphics.scale(1/(other_obj.scale_mag or other_obj.VT.scale))
    love.graphics.setColor(G.BRUTE_OVERLAY or G.C.WHITE)
    love.graphics.draw(
        self.atlas.image,
        self.sprite,
        -(other_obj.T.w/2 -other_obj.VT.w/2)*10,
        0,
        0,
        other_obj.VT.w/(other_obj.T.w),
        other_obj.VT.h/(other_obj.T.h)
    )
    self:draw_boundingrect()
    love.graphics.pop()
end

function Sprite:remove()
    if self.video then 
        self.video:release()
    end
    for k, v in pairs(G.ANIMATIONS) do
        if v == self then
            table.remove(G.ANIMATIONS, k)
        end
    end
    for k, v in pairs(G.I.SPRITE) do
        if v == self then
            table.remove(G.I.SPRITE, k)
        end
    end
    
    Moveable.remove(self)
end
