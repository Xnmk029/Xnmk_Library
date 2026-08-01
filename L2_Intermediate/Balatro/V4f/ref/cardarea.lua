--Class
CardArea = Moveable:extend()

--Class Methods
function CardArea:init(X, Y, W, H, config)
    Moveable.init(self, X, Y, W, H)

    self.states.drag.can = false
    self.states.hover.can = false
    self.states.click.can = false


    self.config = config or {}
    self.card_w = config.card_w or G.CARD_W
    self.cards = {}
    self.children = {}
    self.highlighted = {}
    self.config.highlighted_limit = config.highlight_limit or 5
    self.config.card_limit = config.card_limit or 52
    self.config.temp_limit = self.config.card_limit
    self.config.card_count = 0
    self.config.type = config.type or 'deck'
    self.config.sort = config.sort or 'desc'
    self.config.lr_padding = config.lr_padding or 0.1
    self.shuffle_amt = 0

    if getmetatable(self) == CardArea then 
        table.insert(G.I.CARDAREA, self)
    end
end

function CardArea:emplace(card, location, stay_flipped)
    if location == 'front' or self.config.type == 'deck' then 
        table.insert(self.cards, 1, card)
    else
        self.cards[#self.cards+1] = card
    end
    if card.facing == 'back' and self.config.type ~= 'discard' and self.config.type ~= 'deck' and not stay_flipped then
        card:flip()
    end
    if self == G.hand and stay_flipped then 
        card.ability.wheel_flipped = true
    end

    if #self.cards > self.config.card_limit then
        if self == G.deck then
            self.config.card_limit = #self.cards
        end
    end
    
    card:set_card_area(self)
    self:set_ranks()
    self:align_cards()

    if self == G.jokers then
        local joker_tally = 0
        for i = 1, #G.jokers.cards do
          if G.jokers.cards[i].ability.set == 'Joker' then joker_tally = joker_tally + 1 end
        end
        if joker_tally > G.GAME.max_jokers then G.GAME.max_jokers = joker_tally end
        check_for_unlock({type = 'modify_jokers'}) 
    end
    if self == G.deck then check_for_unlock({type = 'modify_deck', deck = self}) end
end

function CardArea:remove_card(card, discarded_only)
    if not self.cards then return end
    local _cards = discarded_only and {} or self.cards
    if discarded_only then 
        for k, v in ipairs(self.cards) do
            if v.ability and v.ability.discarded then 
                _cards[#_cards+1] = v
            end
        end
    end
    if self.config.type == 'discard' or self.config.type == 'deck' then
        card = card or _cards[#_cards]
    else
        card = card or _cards[1]
    end
    for i = #self.cards,1,-1 do
        if self.cards[i] == card then
            card:remove_from_area()
            table.remove(self.cards, i)
            self:remove_from_highlighted(card, true)
            break
        end
    end
    self:set_ranks()
    if self == G.deck then check_for_unlock({type = 'modify_deck', deck = self}) end
    return card
end

function CardArea:change_size(delta)
    if delta ~= 0 then 
        G.E_MANAGER:add_event(Event({
            func = function() 
                self.config.real_card_limit = (self.config.real_card_limit or self.config.card_limit) + delta
                self.config.card_limit = math.max(0, self.config.real_card_limit)
                if delta > 0 and self.config.real_card_limit > 1 and self == G.hand and self.cards[1] and (G.STATE == G.STATES.DRAW_TO_HAND or G.STATE == G.STATES.SELECTING_HAND) then 
                    local card_count = math.abs(delta)
                    for i=1, card_count do
                        draw_card(G.deck,G.hand, i*100/card_count,nil, nil , nil, 0.07)
                        G.E_MANAGER:add_event(Event({func = function() self:sort() return true end}))
                    end
                end
                if self == G.hand then check_for_unlock({type = 'min_hand_size'}) end
        return true
        end}))
    end
end

function CardArea:can_highlight(card)
    if G.CONTROLLER.HID.controller then 
        if  self.config.type == 'hand'
        then
                return true
        end
    else
        if  self.config.type == 'hand' or
            self.config.type == 'joker' or
            self.config.type == 'consumeable' or
            (self.config.type == 'shop' and self.config.highlighted_limit > 0)
        then
                return true
        end
    end
    return false
end

function CardArea:add_to_highlighted(card, silent)
    --if self.config.highlighted_limit <= #self.highlighted then return end
    if self.config.type == 'shop' then
        if self.highlighted[1] then
            self:remove_from_highlighted(self.highlighted[1])
        end
        --if not G.FUNCS.check_for_buy_space(card) then return false end
        self.highlighted[#self.highlighted+1] = card
        card:highlight(true)
        if not silent then play_sound('cardSlide1') end
    elseif self.config.type == 'joker' or self.config.type == 'consumeable' then
        if #self.highlighted >= self.config.highlighted_limit then 
            self:remove_from_highlighted(self.highlighted[1])
        end
        self.highlighted[#self.highlighted+1] = card
        card:highlight(true)
        if not silent then play_sound('cardSlide1') end
    else
        if #self.highlighted >= self.config.highlighted_limit then
            card:highlight(false)
        else
            self.highlighted[#self.highlighted+1] = card
            card:highlight(true)
            if not silent then play_sound('cardSlide1') end
        end
        if self == G.hand and G.STATE == G.STATES.SELECTING_HAND then
            self:parse_highlighted()
        end
    end
end

function CardArea:parse_highlighted()
    G.boss_throw_hand = nil
    local text,disp_text,poker_hands = G.FUNCS.get_poker_hand_info(self.highlighted)
    if text == 'NULL' then
        update_hand_text({immediate = true, nopulse = true, delay = 0}, {mult = 0, chips = 0, level = '', handname = ''})
    else
        if G.GAME.blind and G.GAME.blind:debuff_hand(self.highlighted, poker_hands, text, true) then
            G.boss_throw_hand = true
        else
            
        end
        local backwards = nil
        for k, v in pairs(self.highlighted) do
            if v.facing == 'back' then
                backwards = true
            end
        end
        if backwards then
            update_hand_text({immediate = true, nopulse = nil, delay = 0}, {handname='????', level='?', mult = '?', chips = '?'})
        else
            update_hand_text({immediate = true, nopulse = nil, delay = 0}, {handname=disp_text, level=G.GAME.hands[text].level, mult = G.GAME.hands[text].mult, chips = G.GAME.hands[text].chips})
        end
    end
end

function CardArea:remove_from_highlighted(card, force)
    if (not force) and  card and card.ability.forced_selection and self == G.hand then return end
    for i = #self.highlighted,1,-1 do
        if self.highlighted[i] == card then
            table.remove(self.highlighted, i)
            break
        end
    end
    card:highlight(false)
    if self == G.hand and G.STATE == G.STATES.SELECTING_HAND then
        self:parse_highlighted()
    end
end

function CardArea:unhighlight_all()
    for i = #self.highlighted,1,-1 do
        if self.highlighted[i].ability.forced_selection and self == G.hand then
        else
            self.highlighted[i]:highlight(false)
            table.remove(self.highlighted, i)
        end
    end 
    if self == G.hand and G.STATE == G.STATES.SELECTING_HAND then
        self:parse_highlighted()
    end
end

function CardArea:set_ranks()
    for k, card in ipairs(self.cards) do
        card.rank = k
        card.states.collide.can = true
        if k > 1 and self.config.type == 'deck' then 
            card.states.drag.can = false 
            card.states.collide.can = false 
        elseif self.config.type == 'play' or self.config.type == 'shop' or self.config.type == 'consumeable' then 
            card.states.drag.can = false
        else
            card.states.drag.can = true
        end
    end
end

function CardArea:move(dt)
    --Set sliding up/down for the hand area
    if self == G.hand then 
        local desired_y = G.TILE_H - G.hand.T.h - 1.9*((not G.deck_preview and (G.STATE == G.STATES.SELECTING_HAND or G.STATE == G.STATES.DRAW_TO_HAND)) and 1 or 0)
        G.hand.T.y = 15*G.real_dt*desired_y + (1-15*G.real_dt)*G.hand.T.y
        if math.abs(desired_y - G.hand.T.y) < 0.01 then G.hand.T.y = desired_y end
        if G.STATE == G.STATES.TUTORIAL then 
            G.play.T.y = G.hand.T.y - (3 + 0.6)
        end
    end
    Moveable.move(self, dt)
    self:align_cards()
end

function CardArea:update(dt)
    if self == G.hand then
        if G.GAME.modifiers.minus_hand_size_per_X_dollar then
            self.config.last_poll_size = self.config.last_poll_size or 0
            if math.floor(G.GAME.dollars/G.GAME.modifiers.minus_hand_size_per_X_dollar) ~= self.config.last_poll_size then
                 self:change_size(self.config.last_poll_size - math.floor(G.GAME.dollars/G.GAME.modifiers.minus_hand_size_per_X_dollar))
                 self.config.last_poll_size = math.floor(G.GAME.dollars/G.GAME.modifiers.minus_hand_size_per_X_dollar)
            end
        end
        for k, v in pairs(self.cards) do
            if v.ability.forced_selection and not self.highlighted[1] then 
                self:add_to_highlighted(v)
            end
        end
    end
    if self == G.deck then 
        self.states.collide.can = true
        self.states.hover.can = true
        self.states.click.can = true
    end
    --Check and see if controller is being used
    if G.CONTROLLER.HID.controller and self ~= G.hand then self:unhighlight_all() end
    if self == G.deck and self.config.card_limit > #G.playing_cards then self.config.card_limit = #G.playing_cards end
    self.config.temp_limit = math.max(#self.cards, self.config.card_limit)
    self.config.card_count = #self.cards
end

function CardArea:draw()
    if not self.states.visible then return end 
    if G.VIEWING_DECK and (self==G.deck or self==G.hand or self==G.play) then return end

    local state = G.TAROT_INTERRUPT or G.STATE

    self.ARGS.invisible_area_types = self.ARGS.invisible_area_types or {discard=1, voucher=1, play=1, consumeable=1, title = 1, title_2 = 1}
    if self.ARGS.invisible_area_types[self.config.type] or
        (self.config.type == 'hand' and ({[G.STATES.SHOP]=1, [G.STATES.TAROT_PACK]=1, [G.STATES.SPECTRAL_PACK]=1, [G.STATES.STANDARD_PACK]=1,[G.STATES.BUFFOON_PACK]=1,[G.STATES.PLANET_PACK]=1, [G.STATES.ROUND_EVAL]=1, [G.STATES.BLIND_SELECT]=1})[state]) or
        (self.config.type == 'deck' and self ~= G.deck) or
        (self.config.type == 'shop' and self ~= G.shop_vouchers) then
    else
        if not self.children.area_uibox then 
                local card_count = self ~= G.shop_vouchers and {n=G.UIT.R, config={align = self == G.jokers and 'cl' or self == G.hand and 'cm' or 'cr', padding = 0.03, no_fill = true}, nodes={
                    {n=G.UIT.B, config={w = 0.1,h=0.1}},
                    {n=G.UIT.T, config={ref_table = self.config, ref_value = 'card_count', scale = 0.3, colour = G.C.WHITE}},
                    {n=G.UIT.T, config={text = '/', scale = 0.3, colour = G.C.WHITE}},
                    {n=G.UIT.T, config={ref_table = self.config, ref_value = 'card_limit', scale = 0.3, colour = G.C.WHITE}},
                    {n=G.UIT.B, config={w = 0.1,h=0.1}}
                }} or nil

                self.children.area_uibox = UIBox{
                    definition = 
                        {n=G.UIT.ROOT, config = {align = 'cm', colour = G.C.CLEAR}, nodes={
                            {n=G.UIT.R, config={minw = self.T.w,minh = self.T.h,align = "cm", padding = 0.1, mid = true, r = 0.1, colour = self ~= G.shop_vouchers and {0,0,0,0.1} or nil, ref_table = self}, nodes={
                                self == G.shop_vouchers and 
                                {n=G.UIT.C, config={align = "cm", paddin = 0.1, func = 'shop_voucher_empty', visible = false}, nodes={
                                    {n=G.UIT.R, config={align = "cm"}, nodes={
                                        {n=G.UIT.T, config={text = 'DEFEAT', scale = 0.6, colour = G.C.WHITE}}
                                    }},
                                    {n=G.UIT.R, config={align = "cm"}, nodes={
                                        {n=G.UIT.T, config={text = 'BOSS BLIND', scale = 0.4, colour = G.C.WHITE}}
                                    }},
                                    {n=G.UIT.R, config={align = "cm"}, nodes={
                                        {n=G.UIT.T, config={text = 'TO RESTOCK', scale = 0.4, colour = G.C.WHITE}}
                                    }},
                                }} or nil,
                            }},
                            card_count
                        }},
                    config = { align = 'cm', offset = {x=0,y=0}, major = self, parent = self}
                }
            end
        self.children.area_uibox:draw()
    end

    self:draw_boundingrect()
    add_to_drawhash(self)

    self.ARGS.draw_layers = self.ARGS.draw_layers or self.config.draw_layers or {'shadow', 'card'}
    for k, v in ipairs(self.ARGS.draw_layers) do
        if self.config.type == 'deck' then 
            for i = #self.cards, 1, -1 do 
                if self.cards[i] ~= G.CONTROLLER.focused.target then
                    if i == 1 or i%(self.config.thin_draw or 9) == 0 or i == #self.cards or math.abs(self.cards[i].VT.x - self.T.x) > 1 or math.abs(self.cards[i].VT.y - self.T.y) > 1  then
                        if G.CONTROLLER.dragging.target ~= self.cards[i] then self.cards[i]:draw(v) end
                    end
                end
            end
        end

        if self.config.type == 'joker' or self.config.type == 'consumeable' or self.config.type == 'shop' or self.config.type == 'title_2' then 
            for i = 1, #self.cards do 
                if self.cards[i] ~= G.CONTROLLER.focused.target then
                    if not self.cards[i].highlighted then
                        if G.CONTROLLER.dragging.target ~= self.cards[i] then self.cards[i]:draw(v) end
                    end
                end
            end
            for i = 1, #self.cards do  
                if self.cards[i] ~= G.CONTROLLER.focused.target then
                    if self.cards[i].highlighted then
                        if G.CONTROLLER.dragging.target ~= self.cards[i] then self.cards[i]:draw(v) end
                    end
                end
            end
        end

        if self.config.type == 'discard' then 
            for i = 1, #self.cards do 
                if self.cards[i] ~= G.CONTROLLER.focused.target then
                    if math.abs(self.cards[i].VT.x - self.T.x) > 1 then 
                        if G.CONTROLLER.dragging.target ~= self.cards[i] then self.cards[i]:draw(v) end
                    end
                end
            end
        end

        if self.config.type == 'hand' or self.config.type == 'play' or self.config.type == 'title' or self.config.type == 'voucher' then 
            for i = 1, #self.cards do 
                if self.cards[i] ~= G.CONTROLLER.focused.target or self == G.hand then
                    if G.CONTROLLER.dragging.target ~= self.cards[i] then self.cards[i]:draw(v) end
                end
            end
        end
    end

    if self == G.deck then
        if G.CONTROLLER.HID.controller and G.STATE == G.STATES.SELECTING_HAND and not self.children.peek_deck then
            self.children.peek_deck = UIBox{
                definition = 
                    {n=G.UIT.ROOT, config = {align = 'cm', padding = 0.1, r =0.1, colour = G.C.CLEAR}, nodes={
                        {n=G.UIT.R, config={align = "cm", r =0.1, colour = adjust_alpha(G.C.L_BLACK, 0.5),func = 'set_button_pip', focus_args = {button = 'triggerleft', orientation = 'bm', scale = 0.6, type = 'none'}}, nodes={
                            {n=G.UIT.R, config={align = "cm"}, nodes={
                                {n=G.UIT.T, config={text = 'PEEK', scale = 0.48, colour = G.C.WHITE, shadow = true}}
                            }},
                            {n=G.UIT.R, config={align = "cm"}, nodes={
                                {n=G.UIT.T, config={text = 'DECK', scale = 0.38, colour = G.C.WHITE, shadow = true}}
                            }},
                        }},
                    }},
                config = { align = 'cl', offset = {x=-0.5,y=0.1}, major = self, parent = self}
            }
            self.children.peek_deck.states.collide.can = false
        elseif (not G.CONTROLLER.HID.controller or G.STATE ~= G.STATES.SELECTING_HAND) and self.children.peek_deck then
            self.children.peek_deck:remove()
            self.children.peek_deck = nil
        end
        if not self.children.view_deck then 
            self.children.view_deck = UIBox{
                definition = 
                    {n=G.UIT.ROOT, config = {align = 'cm', padding = 0.1, r =0.1, colour = G.C.CLEAR}, nodes={
                        {n=G.UIT.R, config={align = "cm", padding = 0.05, r =0.1, colour = adjust_alpha(G.C.BLACK, 0.5),func = 'set_button_pip', focus_args = {button = 'triggerright', orientation = 'bm', scale = 0.6}, button = 'deck_info'}, nodes={
                            {n=G.UIT.R, config={align = "cm", maxw = 2}, nodes={
                                {n=G.UIT.T, config={text = localize('k_view'), scale = 0.48, colour = G.C.WHITE, shadow = true}}
                            }},
                            {n=G.UIT.R, config={align = "cm", maxw = 2}, nodes={
                                {n=G.UIT.T, config={text = localize('k_deck'), scale = 0.38, colour = G.C.WHITE, shadow = true}}
                            }},
                        }},
                    }},
                config = { align = 'cm', offset = {x=0,y=0}, major = self.cards[1] or self, parent = self}
            }
            self.children.view_deck.states.collide.can = false
        end
    if G.deck_preview or self.states.collide.is or (G.buttons and G.buttons.states.collide.is and G.CONTROLLER.HID.controller) then self.children.view_deck:draw() end
    if self.children.peek_deck then self.children.peek_deck:draw() end
    end
end

function CardArea:align_cards()
    if (self == G.hand or self == G.deck or self == G.discard or self == G.play) and G.view_deck and G.view_deck[1] and G.view_deck[1].cards then return end
    if self.config.type == 'deck' then
            local deck_height = (self.config.deck_height or 0.15)/52
            for k, card in ipairs(self.cards) do
                if card.facing == 'front' then card:flip() end

                if not card.states.drag.is then
                    card.T.x = self.T.x + 0.5*(self.T.w - card.T.w) + self.shadow_parrallax.x*deck_height*(#self.cards/(self == G.deck and 1 or 2) - k) + 0.9*self.shuffle_amt*(1 - k*0.01)*(k%2 == 1 and 1 or -0)
                    card.T.y = self.T.y + 0.5*(self.T.h - card.T.h) + self.shadow_parrallax.y*deck_height*(#self.cards/(self == G.deck and 1 or 2) - k)
                    card.T.r = 0 + 0.3*self.shuffle_amt*(1 + k*0.05)*(k%2 == 1 and 1 or -0)
                    card.T.x = card.T.x + card.shadow_parrallax.x/30
                end
            end
    end
    if self.config.type == 'discard' then
        for k, card in ipairs(self.cards) do
            if card.facing == 'front' then card:flip() end

            if not card.states.drag.is then 
                card.T.x = self.T.x + (self.T.w - card.T.w)*card.discard_pos.x
                card.T.y = self.T.y + (self.T.h - card.T.h)* card.discard_pos.y
                card.T.r = card.discard_pos.r
            end
        end
    end
    if self.config.type == 'hand' and (G.STATE == G.STATES.TAROT_PACK or G.STATE == G.STATES.SPECTRAL_PACK  or G.STATE == G.STATES.PLANET_PACK) then
        for k, card in ipairs(self.cards) do
            if not card.states.drag.is then 
                card.T.r = 0.4*(-#self.cards/2 - 0.5 + k)/(#self.cards)+ (G.SETTINGS.reduced_motion and 0 or 1)*0.02*math.sin(2*G.TIMERS.REAL+card.T.x)
                local max_cards = math.max(#self.cards, self.config.temp_limit)
                card.T.x = self.T.x + (self.T.w-self.card_w)*((k-1)/math.max(max_cards-1, 1) - 0.5*(#self.cards-max_cards)/math.max(max_cards-1, 1)) + 0.5*(self.card_w - card.T.w)
                local highlight_height = G.HIGHLIGHT_H
                if not card.highlighted then highlight_height = 0 end
                card.T.y = G.hand.T.y - 1.8*card.T.h - highlight_height + (G.SETTINGS.reduced_motion and 0 or 1)*0.1*math.sin(0.666*G.TIMERS.REAL+card.T.x) + math.abs(1.3*(-#self.cards/2 + k-0.5)/(#self.cards))^2-0.3
                card.T.x = card.T.x + card.shadow_parrallax.x/30
            end
        end
        table.sort(self.cards, function (a, b) return a.T.x + a.T.w/2 < b.T.x + b.T.w/2 end)
    end  
    if self.config.type == 'hand' and not (G.STATE == G.STATES.TAROT_PACK or G.STATE == G.STATES.SPECTRAL_PACK or G.STATE == G.STATES.PLANET_PACK) then

        for k, card in ipairs(self.cards) do
            if not card.states.drag.is then 
                card.T.r = 0.2*(-#self.cards/2 - 0.5 + k)/(#self.cards)+ (G.SETTINGS.reduced_motion and 0 or 1)*0.02*math.sin(2*G.TIMERS.REAL+card.T.x)
                local max_cards = math.max(#self.cards, self.config.temp_limit)
                card.T.x = self.T.x + (self.T.w-self.card_w)*((k-1)/math.max(max_cards-1, 1) - 0.5*(#self.cards-max_cards)/math.max(max_cards-1, 1)) + 0.5*(self.card_w - card.T.w)

                local highlight_height = G.HIGHLIGHT_H
                if not card.highlighted then highlight_height = 0 end
                card.T.y = self.T.y + self.T.h/2 - card.T.h/2 - highlight_height + (G.SETTINGS.reduced_motion and 0 or 1)*0.03*math.sin(0.666*G.TIMERS.REAL+card.T.x) + math.abs(0.5*(-#self.cards/2 + k-0.5)/(#self.cards))-0.2
                card.T.x = card.T.x + card.shadow_parrallax.x/30
            end
        end
        table.sort(self.cards, function (a, b) return a.T.x + a.T.w/2 < b.T.x + b.T.w/2 end)
    end  
    if self.config.type == 'title' or (self.config.type == 'voucher' and #self.cards == 1) then
        for k, card in ipairs(self.cards) do
            if not card.states.drag.is then 
                card.T.r = 0.2*(-#self.cards/2 - 0.5 + k)/(#self.cards)+ (G.SETTINGS.reduced_motion and 0 or 1)*0.02*math.sin(2*G.TIMERS.REAL+card.T.x)
                local max_cards = math.max(#self.cards, self.config.temp_limit)
                card.T.x = self.T.x + (self.T.w-self.card_w)*((k-1)/math.max(max_cards-1, 1) - 0.5*(#self.cards-max_cards)/math.max(max_cards-1, 1)) + 0.5*(self.card_w - card.T.w)
                local highlight_height = G.HIGHLIGHT_H
                if not card.highlighted then highlight_height = 0 end
                card.T.y = self.T.y + self.T.h/2 - card.T.h/2 - highlight_height + (G.SETTINGS.reduced_motion and 0 or 1)*0.03*math.sin(0.666*G.TIMERS.REAL+card.T.x) + math.abs(0.5*(-#self.cards/2 + k-0.5)/(#self.cards))-(#self.cards>1 and 0.2 or 0)
                card.T.x = card.T.x + card.shadow_parrallax.x/30
            end
        end
        table.sort(self.cards, function (a, b) return a.T.x + a.T.w/2 < b.T.x + b.T.w/2 end)
    end  
    if self.config.type == 'voucher' and #self.cards > 1 then
        local self_w = math.max(self.T.w, 3.2)
        for k, card in ipairs(self.cards) do
            if not card.states.drag.is then 
                card.T.r = 0.2*(-#self.cards/2 - 0.5 + k)/(#self.cards)+ (G.SETTINGS.reduced_motion and 0 or 1)*0.02*math.sin(2*G.TIMERS.REAL+card.T.x+card.T.y) + (k%2 == 0 and 1 or -1)*0.08
                local max_cards = math.max(#self.cards, self.config.temp_limit)
                card.T.x = self.T.x + (self_w-self.card_w)*((k-1)/math.max(max_cards-1, 1) - 0.5*(#self.cards-max_cards)/math.max(max_cards-1, 1)) + 0.5*(self.card_w - card.T.w) + (k%2 == 1 and 1 or -1)*0.27 + (self.T.w-self_w)/2
                local highlight_height = G.HIGHLIGHT_H
                if not card.highlighted then highlight_height = 0 end
                card.T.y = self.T.y + self.T.h/2 - card.T.h/2 - highlight_height + (G.SETTINGS.reduced_motion and 0 or 1)*0.03*math.sin(0.666*G.TIMERS.REAL+card.T.x) + math.abs(0.5*(-#self.cards/2 + k-0.5)/(#self.cards))-(#self.cards>1 and 0.2 or 0)
                card.T.x = card.T.x + card.shadow_parrallax.x/30
            end
        end
        table.sort(self.cards, function (a, b) return a.ability.order < b.ability.order end)
    end 
    if self.config.type == 'play' or self.config.type == 'shop' then
        for k, card in ipairs(self.cards) do
            if not card.states.drag.is then 
                card.T.r = 0
                local max_cards = math.max(#self.cards, self.config.temp_limit)
                card.T.x = self.T.x + (self.T.w-self.card_w)*((k-1)/math.max(max_cards-1, 1) - 0.5*(#self.cards-max_cards)/math.max(max_cards-1, 1)) + 0.5*(self.card_w - card.T.w) + (self.config.card_limit == 1 and 0.5*(self.T.w - card.T.w) or 0)
                local highlight_height = G.HIGHLIGHT_H
                if not card.highlighted then highlight_height = 0 end
                card.T.y = self.T.y + self.T.h/2 - card.T.h/2 - highlight_height
                card.T.x = card.T.x + card.shadow_parrallax.x/30
            end
        end
        table.sort(self.cards, function (a, b) return a.T.x + a.T.w/2 < b.T.x + b.T.w/2 end)
    end 
    if self.config.type == 'joker' or self.config.type == 'title_2' then
        for k, card in ipairs(self.cards) do
            if not card.states.drag.is then 
                card.T.r = 0.1*(-#self.cards/2 - 0.5 + k)/(#self.cards)+ (G.SETTINGS.reduced_motion and 0 or 1)*0.02*math.sin(2*G.TIMERS.REAL+card.T.x)
                local max_cards = math.max(#self.cards, self.config.temp_limit)
                card.T.x = self.T.x + (self.T.w-self.card_w)*((k-1)/math.max(max_cards-1, 1) - 0.5*(#self.cards-max_cards)/math.max(max_cards-1, 1)) + 0.5*(self.card_w - card.T.w)
                if #self.cards > 2 or (#self.cards > 1 and self == G.consumeables) or (#self.cards > 1 and self.config.spread) then
                    card.T.x = self.T.x + (self.T.w-self.card_w)*((k-1)/(#self.cards-1)) + 0.5*(self.card_w - card.T.w)
                elseif #self.cards > 1 and self ~= G.consumeables then
                    card.T.x = self.T.x + (self.T.w-self.card_w)*((k - 0.5)/(#self.cards)) + 0.5*(self.card_w - card.T.w)
                else
                    card.T.x = self.T.x + self.T.w/2 - self.card_w/2 + 0.5*(self.card_w - card.T.w)
                end
                local highlight_height = G.HIGHLIGHT_H/2
                if not card.highlighted then highlight_height = 0 end
                card.T.y = self.T.y + self.T.h/2 - card.T.h/2 - highlight_height+ (G.SETTINGS.reduced_motion and 0 or 1)*0.03*math.sin(0.666*G.TIMERS.REAL+card.T.x)
                card.T.x = card.T.x + card.shadow_parrallax.x/30
            end
        end
        table.sort(self.cards, function (a, b) return a.T.x + a.T.w/2 - 100*(a.pinned and a.sort_id or 0) < b.T.x + b.T.w/2 - 100*(b.pinned and b.sort_id or 0) end)
    end   
    if self.config.type == 'consumeable'then
        for k, card in ipairs(self.cards) do
            if not card.states.drag.is then 
                if #self.cards > 1 then
                    card.T.x = self.T.x + (self.T.w-self.card_w)*((k-1)/(#self.cards-1)) + 0.5*(self.card_w - card.T.w)
                else
                    card.T.x = self.T.x + self.T.w/2 - self.card_w/2 + 0.5*(self.card_w - card.T.w)
                end
                local highlight_height = G.HIGHLIGHT_H
                if not card.highlighted then highlight_height = 0 end
                card.T.y = self.T.y + self.T.h/2 - card.T.h/2 - highlight_height + (not card.highlighted and (G.SETTINGS.reduced_motion and 0 or 1)*0.05*math.sin(2*1.666*G.TIMERS.REAL+card.T.x) or 0)
                card.T.x = card.T.x + card.shadow_parrallax.x/30
            end
        end
        table.sort(self.cards, function (a, b) return a.T.x + a.T.w/2 < b.T.x + b.T.w/2 end)
    end   
    for k, card in ipairs(self.cards) do
        card.rank = k
    end
    if self.children.view_deck then
        self.children.view_deck:set_role{major = self.cards[1] or self}
    end
end

function CardArea:hard_set_T(X, Y, W, H)
    local x = (X or self.T.x)
    local y = (Y or self.T.y)
    local w = (W or self.T.w)
    local h = (H or self.T.h)
    Moveable.hard_set_T(self,x, y, w, h)
    self:calculate_parrallax()
    self:align_cards()
    self:hard_set_cards()
end

function CardArea:hard_set_cards()
    for k, card in pairs(self.cards) do
        card:hard_set_T()
        card:calculate_parrallax()
    end
end

function CardArea:shuffle(_seed)
    pseudoshuffle(self.cards, pseudoseed(_seed or 'shuffle'))
    self:set_ranks()
end

function CardArea:sort(method)
    self.config.sort = method or self.config.sort
    if self.config.sort == 'desc' then
        table.sort(self.cards, function (a, b) return a:get_nominal() > b:get_nominal() end )
    elseif self.config.sort == 'asc' then 
        table.sort(self.cards, function (a, b) return a:get_nominal() < b:get_nominal() end )
    elseif self.config.sort == 'suit desc' then 
        table.sort(self.cards, function (a, b) return a:get_nominal('suit') > b:get_nominal('suit') end )
    elseif self.config.sort == 'suit asc' then 
        table.sort(self.cards, function (a, b) return a:get_nominal('suit') < b:get_nominal('suit') end )
    elseif self.config.sort == 'order' then 
        table.sort(self.cards, function (a, b) return (a.config.card.order or a.config.center.order) < (b.config.card.order or b.config.center.order) end )
    end
end

function CardArea:draw_card_from(area, stay_flipped, discarded_only)
    if area:is(CardArea) then
        if #self.cards < self.config.card_limit or self == G.deck or self == G.hand then
            local card = area:remove_card(nil, discarded_only)
            if card then
                if area == G.discard then
                    card.T.r = 0
                end
                local stay_flipped = G.GAME and G.GAME.blind and G.GAME.blind:stay_flipped(self, card)
                if (self == G.hand) and G.GAME.modifiers.flipped_cards then
                    if pseudorandom(pseudoseed('flipped_card')) < 1/G.GAME.modifiers.flipped_cards then
                        stay_flipped = true
                    end
                end
                self:emplace(card, nil, stay_flipped)
                return true
            end
        end
    end
end

function CardArea:click() 
    if self == G.deck then 
        G.FUNCS.deck_info()
    end
end

function CardArea:save()
    if not self.cards then return end
    local cardAreaTable = {
        cards = {},
        config = self.config,
    }
    for i = 1, #self.cards do
        cardAreaTable.cards[#cardAreaTable.cards + 1] = self.cards[i]:save()
    end

    return cardAreaTable
end

function CardArea:load(cardAreaTable)

    if self.cards then remove_all(self.cards) end
    self.cards = {}
    if self.children then remove_all(self.children) end
    self.children = {}

    self.config = cardAreaTable.config

    for i = 1, #cardAreaTable.cards do
        loading = true
        local card = Card(0, 0, G.CARD_W, G.CARD_H, G.P_CENTERS.j_joker, G.P_CENTERS.c_base)
        loading = nil
        card:load(cardAreaTable.cards[i])
        self.cards[#self.cards + 1] = card
        if card.highlighted then 
            self.highlighted[#self.highlighted + 1] = card
        end
        card:set_card_area(self)
    end
    self:set_ranks()
    self:align_cards()
    self:hard_set_cards()
end

function CardArea:remove()
    if self.cards then remove_all(self.cards) end
    self.cards = nil
    if self.children then remove_all(self.children) end
    self.children = nil
    for k, v in pairs(G.I.CARDAREA) do
        if v == self then
            table.remove(G.I.CARDAREA, k)
        end
    end
    Moveable.remove(self)
end
