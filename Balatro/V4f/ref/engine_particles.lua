---@class Particles: Moveable
Particles = Moveable:extend()

--Class Methods
function Particles:init(X, Y, W, H, config)
    config = config or {}

    Moveable.init(self,X, Y, W, H)

    self.fill = config.fill
    self.padding = config.padding or 0

    if config.attach then
        self:set_alignment{
            major = config.attach,
            type = 'cm',
            bond = 'Strong'
        }
        table.insert(self.role.major.children,self)
        self.parent = self.role.major
        self.T.x = self.role.major.T.x + self.padding
        self.T.y = self.role.major.T.y + self.padding
        if self.fill then
            self.T.w = self.role.major.T.w - self.padding
            self.T.h = self.role.major.T.h - self.padding
        end
    end

    self.states.hover.can = false
    self.states.click.can = false
    self.states.collide.can = false
    self.states.drag.can = false
    self.states.release_on.can = false

    self.timer = config.timer or 0.5
    self.timer_type = (self.created_on_pause and 'REAL') or config.timer_type or 'REAL'
    self.last_real_time = G.TIMERS[self.timer_type] - self.timer
    self.last_drawn = 0
    self.lifespan = config.lifespan or 1
    self.fade_alpha = 0
    self.speed = config.speed or 1
    self.max = config.max or 1000000000000000
    self.pulse_max = math.min(20, config.pulse_max or 0)
    self.pulsed = 0
    self.vel_variation = config.vel_variation or 1
    self.particles = {}
    self.scale = config.scale or 1
    self.colours = config.colours or {G.C.BACKGROUND.D}

    if config.initialize then
        for i = 1, 60 do
            self.last_real_time = self.last_real_time - 15/60
            self:update(15/60)
            self:move(15/60)
        end
    end

    if getmetatable(self) == Particles then 
        table.insert(G.I.MOVEABLE, self)
    end
end

function Particles:update(dt)
    if G.SETTINGS.paused and not self.created_on_pause then self.last_real_time = G.TIMERS[self.timer_type] ; return end
    local added_this_frame = 0
    while G.TIMERS[self.timer_type]  > self.last_real_time + self.timer and (#self.particles < self.max or self.pulsed < self.pulse_max) and added_this_frame < 20 do
        self.last_real_time = self.last_real_time + self.timer
        local new_offset = { 
            x=self.fill and (0.5-math.random())*self.T.w or 0,
            y=self.fill and (0.5-math.random())*self.T.h or 0
        }
        if self.fill and self.T.r < 0.1 and self.T.r > -0.1 then 
            local newer_offset = {
                x = math.sin(self.T.r)*new_offset.y + math.cos(self.T.r)*new_offset.x,
                y = math.sin(self.T.r)*new_offset.x + math.cos(self.T.r)*new_offset.y,
            }
            new_offset = newer_offset
        end
        table.insert(self.particles, {
            draw = false,
            dir = math.random()*2*math.pi,
            facing = math.random()*2*math.pi,
            size = math.random()*0.5+0.1,
            age = 0,
            velocity = self.speed*(self.vel_variation*math.random() + (1-self.vel_variation))*0.7,
            r_vel = 0.2*(0.5 - math.random()),
            e_prev = 0,
            e_curr = 0,
            scale = 0,
            visible_scale = 0,
            time = G.TIMERS[self.timer_type],
            colour = pseudorandom_element(self.colours),
            offset = new_offset
        })
        added_this_frame = added_this_frame + 1
        if self.pulsed <= self.pulse_max then self.pulsed = self.pulsed + 1 end
    end
end

function Particles:move(dt)
    if G.SETTINGS.paused and not self.created_on_pause then return end

    Moveable.move(self, dt)

    if self.timer_type ~= 'REAL' then dt = dt*G.SPEEDFACTOR end

    for i=#self.particles,1,-1 do
        self.particles[i].draw = true
        self.particles[i].e_vel = self.particles[i].e_vel or dt*self.scale
        self.particles[i].e_prev = self.particles[i].e_curr
        self.particles[i].age = self.particles[i].age + dt
        
        self.particles[i].e_curr = math.min(2*math.min((self.particles[i].age/self.lifespan)*self.scale, self.scale*((self.lifespan - self.particles[i].age)/self.lifespan)), self.scale)

        self.particles[i].e_vel =  (self.particles[i].e_curr - self.particles[i].e_prev)*self.scale*dt + (1-self.scale*dt)*self.particles[i].e_vel

        self.particles[i].scale = self.particles[i].scale + self.particles[i].e_vel
        self.particles[i].scale = math.min(2*math.min((self.particles[i].age/self.lifespan)*self.scale, self.scale*((self.lifespan - self.particles[i].age)/self.lifespan)), self.scale)

        if self.particles[i].scale < 0 then
            table.remove(self.particles, i)
        else
            self.particles[i].offset.x = self.particles[i].offset.x + self.particles[i].velocity*math.sin(self.particles[i].dir)*dt
            self.particles[i].offset.y = self.particles[i].offset.y + self.particles[i].velocity*math.cos(self.particles[i].dir)*dt
            self.particles[i].facing = self.particles[i].facing + self.particles[i].r_vel*dt
            self.particles[i].velocity = math.max(0, self.particles[i].velocity - self.particles[i].velocity*0.07*dt)
        end
    end
end

function Particles:fade(delay, to)
    G.E_MANAGER:add_event(Event({
        trigger = 'ease',
        timer = self.timer_type, 
        blockable = false, 
        blocking = false,
        ref_value = 'fade_alpha',
        ref_table = self,
        ease_to = to or 1,
        delay = delay
    }))
end

function Particles:draw(alpha)
    alpha = alpha or 1
        prep_draw(self, 1)
        love.graphics.translate(self.T.w/2, self.T.h/2)
        for k, v in pairs(self.particles) do
            if v.draw then 
                love.graphics.push()
                love.graphics.setColor(v.colour[1], v.colour[2], v.colour[3], v.colour[4]*alpha*(1-self.fade_alpha))                
                love.graphics.translate(v.offset.x, v.offset.y)
                love.graphics.rotate(v.facing)
                
                love.graphics.rectangle('fill', -v.scale/2, -v.scale/2, v.scale, v.scale) -- origin in the middle
                love.graphics.pop()
            end
        end
        love.graphics.pop()

        add_to_drawhash(self)
        self:draw_boundingrect()
end

function Particles:remove()
    if self.role.major then 
        for k, v in pairs(self.role.major.children) do
            if v == self and type(k) == 'number' then
                table.remove(self.role.major.children, k)
            end
        end
    end

    remove_all(self.children)

    Moveable.remove(self)
end
