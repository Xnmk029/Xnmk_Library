--Class
AnimatedSprite = Sprite:extend()

--Class Methods
function AnimatedSprite:init(X, Y, W, H, new_sprite_atlas, sprite_pos)
    Sprite.init(self,X, Y, W, H, new_sprite_atlas, sprite_pos)
    self.offset = {x = 0, y = 0}

    table.insert(G.ANIMATIONS, self)
    if getmetatable(self) == AnimatedSprite then 
        table.insert(G.I.SPRITE, self)
    end
end

function AnimatedSprite:rescale()
    self.scale_mag = math.min(self.scale.x/self.T.w,self.scale.y/self.T.h)
end

function AnimatedSprite:reset()
    self.atlas = G.ANIMATION_ATLAS[self.atlas.name]
    self:set_sprite_pos({x = self.animation.x, y = self.animation.y})
end

function AnimatedSprite:set_sprite_pos(sprite_pos)
    self.animation = {
        x= sprite_pos and sprite_pos.x or 0,
        y=sprite_pos and sprite_pos.y or 0,
        frames=self.atlas.frames,current=0,
        w=self.scale.x, h=self.scale.y}

    self.frame_offset = 0

    self.current_animation = {
        current = 0,
        frames = self.animation.frames,
        w = self.animation.w,
        h = self.animation.h}

    self.image_dims = self.image_dims or {}
    self.image_dims[1], self.image_dims[2] = self.atlas.image:getDimensions()

    self.sprite = love.graphics.newQuad( 
    0,
    self.animation.h*self.animation.y,
    self.animation.w,
    self.animation.h,
    self.image_dims[1], self.image_dims[2])
    self.offset_seconds = G.TIMERS.REAL
end

function AnimatedSprite:get_pos_pixel()
    self.RETS.get_pos_pixel = self.RETS.get_pos_pixel or {}
    self.RETS.get_pos_pixel[1] = self.current_animation.current
    self.RETS.get_pos_pixel[2] = self.animation.y
    self.RETS.get_pos_pixel[3] = self.animation.w
    self.RETS.get_pos_pixel[4] = self.animation.h
    return self.RETS.get_pos_pixel
end

function AnimatedSprite:draw_self()
    if not self.states.visible then return end

    prep_draw(self, 1)
    love.graphics.scale(1/self.scale_mag)
    love.graphics.setColor(G.C.WHITE)
    love.graphics.draw(
        self.atlas.image, 
        self.sprite,
        0 ,0,
        0,
        self.VT.w/(self.T.w),
        self.VT.h/(self.T.h)
    )
    love.graphics.pop()
end

function AnimatedSprite:animate()
    local new_frame = math.floor(G.ANIMATION_FPS*(G.TIMERS.REAL - self.offset_seconds))%self.current_animation.frames
    if new_frame ~= self.current_animation.current then
        self.current_animation.current = new_frame
        self.frame_offset = math.floor(self.animation.w*(self.current_animation.current))
        self.sprite:setViewport( 
            self.frame_offset,
            self.animation.h*self.animation.y,
            self.animation.w,
            self.animation.h)
    end
    if self.float then 
        self.T.r = 0.02*math.sin(2*G.TIMERS.REAL+self.T.x)
        self.offset.y = -(1+0.3*math.sin(0.666*G.TIMERS.REAL+self.T.y))*self.shadow_parrallax.y
        self.offset.x = -(0.7+0.2*math.sin(0.666*G.TIMERS.REAL+self.T.x))*self.shadow_parrallax.x
    end
end

function AnimatedSprite:remove()
    for _, v in pairs(G.ANIMATIONS) do
        if v == self then
            table.remove(G.ANIMATIONS, k)
        end
    end
    for _, v in pairs(G.I.SPRITE) do
        if v == self then
            table.remove(G.I.SPRITE, k)
        end
    end
    Sprite.remove(self)
end
