--class
Card_Character = Moveable:extend()

--class methods
function Card_Character:init(args)
    Moveable.init(self,args.x or 1, args.y or 1, args.w or G.CARD_W*1.1, args.h or G.CARD_H*1.1)

    self.states.collide.can = false

    self.children = {}
    self.config = {args = args}
    self.children.card = Card(self.T.x, self.T.y, G.CARD_W, G.CARD_H, G.P_CARDS.empty, args.center or G.P_CENTERS.j_joker, {bypass_discovery_center = true})
    self.children.card.states.visible = false
    self.children.card:start_materialize({G.C.BLUE, G.C.WHITE, G.C.RED})
    self.children.card:set_alignment{
        major = self, type = 'cm', offset = {x=0, y=0}
    }
    self.children.card.jimbo = self
    self.children.card.states.collide.can = true
    self.children.card.states.focus.can = false
    self.children.card.states.hover.can = true
    self.children.card.states.drag.can = false
    self.children.card.hover = Node.hover

    self.children.particles = Particles(0, 0, 0,0, {
        timer = 0.03,
        scale = 0.3,
        speed = 1.2,
        lifespan = 2,
        attach = self,
        colours = {G.C.RED, G.C.BLUE, G.C.ORANGE},
        fill = true
    })
    self.children.particles.static_rotation = true
    self.children.particles:set_role{
        role_type = 'Minor',
        xy_bond = 'Weak',
        r_bond = 'Strong',
        major = self,
    }

    if getmetatable(self) == Card_Character then 
        table.insert(G.I.CARD, self)
    end
end

function Card_Character:move(dt)
    Moveable.move(self, dt)
end

function Card_Character:hard_set_VT()
    self:align_to_major()
    Moveable.hard_set_VT(self)
    self:align()
    self.children.card:hard_set_VT()
end

function Card_Character:align()
    if self.children.card then
        self.children.card.T.x = self.T.x + (self.T.w - self.children.card.T.w)/2
        self.children.card.T.y = self.T.y + (self.T.h - self.children.card.T.h)/2
    end    
end

function Card_Character:add_button(button, func, colour, update_func, snap_to, yoff)
    if self.children.button then self.children.button:remove() end
    self.config.button_align = {align="bm", offset = {x=0,y=yoff or 0.3},major = self, parent = self}
    self.children.button = UIBox{
        definition = create_UIBox_character_button({button = button, func = func, colour = colour, update_func = update_func, maxw = 3}),
        config = self.config.button_align 
    }
    if snap_to then G.CONTROLLER:snap_to{node = self.children.button} end
end

function Card_Character:add_speech_bubble(text_key, align, loc_vars)
    if self.children.speech_bubble then self.children.speech_bubble:remove() end
    self.config.speech_bubble_align = {align=align or 'bm', offset = {x=0,y=0},parent = self}
    self.children.speech_bubble = 
    UIBox{
        definition = G.UIDEF.speech_bubble(text_key, loc_vars),
        config = self.config.speech_bubble_align
    }
    self.children.speech_bubble:set_role{
        role_type = 'Minor',
        xy_bond = 'Weak',
        r_bond = 'Strong',
        major = self,
    }
    self.children.speech_bubble.states.visible = false
end

function Card_Character:remove_button()
    if self.children.button then self.children.button:remove(); self.children.button = nil end
end

function Card_Character:remove_speech_bubble()
    if self.children.speech_bubble then self.children.speech_bubble:remove(); self.children.speech_bubble = nil end
end

function Card_Character:say_stuff(n, not_first)
    self.talking = true
    if not not_first then 
        G.E_MANAGER:add_event(Event({
            trigger = 'after',
            delay = 0.1,
            func = function()
                if self.children.speech_bubble then self.children.speech_bubble.states.visible = true end
                self:say_stuff(n, true)
              return true
            end
        }))
    else
        if n <= 0 then self.talking = false; return end
        local new_said = math.random(1, 11)
        while new_said == self.last_said do 
            new_said = math.random(1, 11)
        end
        self.last_said = new_said
        play_sound('voice'..math.random(1, 11), G.SPEEDFACTOR*(math.random()*0.2+1), 0.5)
        self.children.card:juice_up()
        G.E_MANAGER:add_event(Event({
            trigger = 'after',
            blockable = false, blocking = false,
            delay = 0.13,
            func = function()
                self:say_stuff(n-1, true)
            return true
            end
        }), 'tutorial')
    end
end

function Card_Character:draw(dt)
    if self.highlight then
        self.children.highlight:draw()
        self.highlight:draw()
        if self.highlight.draw_children then self.highlight:draw_children() end
    end 
    if self.children.particles then
        self.children.particles:draw()
    end
    if self.children.speech_bubble then
        self.children.speech_bubble:draw()
    end
    if self.children.button and not self.talking then
        self.children.button:draw()
    end
    if self.children.card then
        self.children.card:draw()
    end
    add_to_drawhash(self)
    self:draw_boundingrect()
end

function Card_Character:remove()
    G.jimboed = nil
    remove_all(self.children)
    for k, v in pairs(G.I.CARD) do
        if v == self then
            table.remove(G.I.CARD, k)
        end
    end
    Moveable.remove(self)
end
