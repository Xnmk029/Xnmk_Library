--Class
Back = Object:extend()

--Class Methods
function Back:init(selected_back)
    if not selected_back then selected_back = G.P_CENTERS.b_red end
    self.name = selected_back.name or 'Red Deck'
    
    self.effect = {
        center = selected_back,
        text_UI = '',
        config = copy_table(selected_back.config)
    }
    self.loc_name = localize{type = 'name_text', set = 'Back', key = self.effect.center.key}

    local pos = (self.effect.center.unlocked and self.effect.center.pos) or {x = 4, y = 0}
    self.pos = self.pos or {}
    self.pos.x = pos.x
    self.pos.y = pos.y
end

function Back:get_name()
    if self.effect.center.unlocked then return self.loc_name else return localize('k_locked') end
end

function Back:generate_UI(other, ui_scale, min_dims, challenge)
    min_dims = min_dims or 0.7
    ui_scale = ui_scale or 0.9
    local back_config = other or self.effect.center
    local name_to_check = other and other.name or self.name
    local effect_config = other and other.config  or self.effect.config
    challenge = G.CHALLENGES[get_challenge_int_from_id(challenge or '') or ''] or {name = 'ERROR'}

    local loc_args, loc_nodes = nil, {}

    if not back_config.unlocked then
        if not back_config.unlock_condition then 
            localize{type = 'descriptions', key = 'demo_locked', set = "Other", nodes = loc_nodes, vars = loc_args}
        elseif back_config.unlock_condition.type == 'win_deck' then
            local other_name = localize('k_unknown')
            if G.P_CENTERS[back_config.unlock_condition.deck].unlocked then 
                other_name = localize{type = 'name_text', set = 'Back', key = back_config.unlock_condition.deck}
            end
            loc_args = {other_name}
            localize{type = 'descriptions', key = 'deck_locked_win', set = "Other", nodes = loc_nodes, vars = loc_args}
        elseif back_config.unlock_condition.type == 'discover_amount' then 
            loc_args = {tostring(back_config.unlock_condition.amount)}
            localize{type = 'descriptions', key = 'deck_locked_discover', set = "Other", nodes = loc_nodes, vars = loc_args}
        elseif back_config.unlock_condition.type == 'win_stake' then 
            local other_name = localize{type = 'name_text', set = 'Stake', key = G.P_CENTER_POOLS.Stake[back_config.unlock_condition.stake].key}
            loc_args = {other_name, colours = {get_stake_col(back_config.unlock_condition.stake)}}
            localize{type = 'descriptions', key = 'deck_locked_stake', set = "Other", nodes = loc_nodes, vars = loc_args}
        end
    else
        if name_to_check == 'Blue Deck' then loc_args = {effect_config.hands}
        elseif name_to_check == 'Red Deck' then loc_args = {effect_config.discards}
        elseif name_to_check == 'Yellow Deck' then loc_args = {effect_config.dollars}
        elseif name_to_check == 'Green Deck' then loc_args = {effect_config.extra_hand_bonus, effect_config.extra_discard_bonus}
        elseif name_to_check == 'Black Deck' then loc_args = {effect_config.joker_slot, -effect_config.hands}
        elseif name_to_check == 'Magic Deck' then loc_args = {localize{type = 'name_text', key = 'v_crystal_ball', set = 'Voucher'}, localize{type = 'name_text', key = 'c_fool', set = 'Tarot'}}
        elseif name_to_check == 'Nebula Deck' then loc_args = {localize{type = 'name_text', key = 'v_telescope', set = 'Voucher'}, -1}
        elseif name_to_check == 'Ghost Deck' then
        elseif name_to_check == 'Abandoned Deck' then 
        elseif name_to_check == 'Checkered Deck' then
        elseif name_to_check == 'Zodiac Deck' then loc_args = {localize{type = 'name_text', key = 'v_tarot_merchant', set = 'Voucher'}, 
                            localize{type = 'name_text', key = 'v_planet_merchant', set = 'Voucher'},
                            localize{type = 'name_text', key = 'v_overstock_norm', set = 'Voucher'}}
        elseif name_to_check == 'Painted Deck' then loc_args = {effect_config.hand_size,effect_config.joker_slot}
        elseif name_to_check == 'Anaglyph Deck' then loc_args = {localize{type = 'name_text', key = 'tag_double', set = 'Tag'}}
        elseif name_to_check == 'Plasma Deck' then loc_args = {effect_config.ante_scaling}
        elseif name_to_check == 'Erratic Deck' then
        end
        localize{type = 'descriptions', key = back_config.key, set = 'Back', nodes = loc_nodes, vars = loc_args}
    end

    return 
    {n=G.UIT.ROOT, config={align = "cm", minw = min_dims*5, minh = min_dims*2.5, id = self.name, colour = G.C.CLEAR}, nodes={
        name_to_check == 'Challenge Deck' and UIBox_button({button = 'deck_view_challenge', label = {localize(challenge.id, 'challenge_names')},  minw = 2.2, minh = 1, scale = 0.6, id = challenge})
        or desc_from_rows(loc_nodes, true, min_dims*5)
    }}
end

function Back:change_to(new_back)
    if not new_back then new_back = G.P_CENTERS.b_red end
    self.name = new_back.name or 'Red Deck'
    self.effect = {
        center = new_back,
        text_UI = '',
        config = copy_table(new_back.config)
    }
    self.loc_name = localize{type = 'name_text', set = 'Back', key = self.effect.center.key}
    local pos = self.effect.center.unlocked and copy_table(new_back.pos) or {x = 4, y = 0}
    self.pos.x = pos.x
    self.pos.y = pos.y
end

function Back:save()
    local backTable = {
        name = self.name,
        pos = self.pos,
        effect = self.effect,
        key = self.effect.center.key or 'b_red'
    }

    return backTable
end

function Back:trigger_effect(args)
    if not args then return end
    
    if self.name == 'Anaglyph Deck' and args.context == 'eval' and G.GAME.last_blind and G.GAME.last_blind.boss then
        G.E_MANAGER:add_event(Event({
            func = (function()
                add_tag(Tag('tag_double'))
                play_sound('generic1', 0.9 + math.random()*0.1, 0.8)
                play_sound('holo1', 1.2 + math.random()*0.1, 0.4)
                return true
            end)
        }))
    end
    if self.name == 'Plasma Deck' and args.context == 'blind_amount' then
        return 
    end

    if self.name == 'Plasma Deck' and args.context == 'final_scoring_step' then
        local tot = args.chips + args.mult
        args.chips = math.floor(tot/2)
        args.mult = math.floor(tot/2)
        update_hand_text({delay = 0}, {mult = args.mult, chips = args.chips})

        G.E_MANAGER:add_event(Event({
            func = (function()
                local text = localize('k_balanced')
                play_sound('gong', 0.94, 0.3)
                play_sound('gong', 0.94*1.5, 0.2)
                play_sound('tarot1', 1.5)
                ease_colour(G.C.UI_CHIPS, {0.8, 0.45, 0.85, 1})
                ease_colour(G.C.UI_MULT, {0.8, 0.45, 0.85, 1})
                attention_text({
                    scale = 1.4, text = text, hold = 2, align = 'cm', offset = {x = 0,y = -2.7},major = G.play
                })
                G.E_MANAGER:add_event(Event({
                    trigger = 'after',
                    blockable = false,
                    blocking = false,
                    delay =  4.3,
                    func = (function() 
                            ease_colour(G.C.UI_CHIPS, G.C.BLUE, 2)
                            ease_colour(G.C.UI_MULT, G.C.RED, 2)
                        return true
                    end)
                }))
                G.E_MANAGER:add_event(Event({
                    trigger = 'after',
                    blockable = false,
                    blocking = false,
                    no_delete = true,
                    delay =  6.3,
                    func = (function() 
                        G.C.UI_CHIPS[1], G.C.UI_CHIPS[2], G.C.UI_CHIPS[3], G.C.UI_CHIPS[4] = G.C.BLUE[1], G.C.BLUE[2], G.C.BLUE[3], G.C.BLUE[4]
                        G.C.UI_MULT[1], G.C.UI_MULT[2], G.C.UI_MULT[3], G.C.UI_MULT[4] = G.C.RED[1], G.C.RED[2], G.C.RED[3], G.C.RED[4]
                        return true
                    end)
                }))
                return true
            end)
        }))

        delay(0.6)
        return args.chips, args.mult
    end
end

function Back:apply_to_run()

    if self.effect.config.voucher then
        G.GAME.used_vouchers[self.effect.config.voucher] = true
        G.GAME.starting_voucher_count = (G.GAME.starting_voucher_count or 0) + 1
        Card.apply_to_run(nil, G.P_CENTERS[self.effect.config.voucher])
    end
    if self.effect.config.hands then 
        G.GAME.starting_params.hands = G.GAME.starting_params.hands + self.effect.config.hands
    end
    if self.effect.config.consumables then
        delay(0.4)
        G.E_MANAGER:add_event(Event({
            func = function()
                for k, v in ipairs(self.effect.config.consumables) do
                    local card = create_card('Tarot', G.consumeables, nil, nil, nil, nil, v, 'deck')
                    card:add_to_deck()
                    G.consumeables:emplace(card)
                end
            return true
            end
        }))
    end


    if self.effect.config.dollars then
        G.GAME.starting_params.dollars = G.GAME.starting_params.dollars + self.effect.config.dollars
    end
    if self.effect.config.remove_faces then
        G.GAME.starting_params.no_faces = true
    end

    if self.effect.config.spectral_rate then
        G.GAME.spectral_rate = self.effect.config.spectral_rate
    end
    if self.effect.config.discards then 
        G.GAME.starting_params.discards = G.GAME.starting_params.discards + self.effect.config.discards
    end
    if self.effect.config.reroll_discount then
        G.GAME.starting_params.reroll_cost = G.GAME.starting_params.reroll_cost - self.effect.config.reroll_discount
    end


    if self.effect.config.edition then
        G.E_MANAGER:add_event(Event({
            func = function()
                local i = 0
                while i < self.effect.config.edition_count do
                    local card = pseudorandom_element(G.playing_cards, pseudoseed('edition_deck'))
                    if not card.edition then
                        i = i + 1
                        card:set_edition({[self.effect.config.edition] = true}, nil, true)
                    end
                end
            return true
            end
        }))
    end
    if self.effect.config.vouchers then
        for k, v in pairs(self.effect.config.vouchers) do
            G.GAME.used_vouchers[v ] = true
            G.GAME.starting_voucher_count = (G.GAME.starting_voucher_count or 0) + 1
            Card.apply_to_run(nil, G.P_CENTERS[v])
        end
    end
    if self.name == 'Checkered Deck' then
        G.E_MANAGER:add_event(Event({
            func = function()
                for k, v in pairs(G.playing_cards) do
                    if v.base.suit == 'Clubs' then 
                        v:change_suit('Spades')
                    end
                    if v.base.suit == 'Diamonds' then 
                        v:change_suit('Hearts')
                    end
                end
            return true
            end
        }))
    end
    if self.effect.config.randomize_rank_suit then
        G.GAME.starting_params.erratic_suits_and_ranks = true
    end
    if self.effect.config.joker_slot then
        G.GAME.starting_params.joker_slots = G.GAME.starting_params.joker_slots + self.effect.config.joker_slot
    end
    if self.effect.config.hand_size then
        G.GAME.starting_params.hand_size = G.GAME.starting_params.hand_size + self.effect.config.hand_size
    end
    if self.effect.config.ante_scaling then
        G.GAME.starting_params.ante_scaling = self.effect.config.ante_scaling
    end
    if self.effect.config.consumable_slot then
        G.GAME.starting_params.consumable_slots = G.GAME.starting_params.consumable_slots + self.effect.config.consumable_slot
    end
    if self.effect.config.no_interest then
        G.GAME.modifiers.no_interest = true
    end
    if self.effect.config.extra_hand_bonus then 
        G.GAME.modifiers.money_per_hand = self.effect.config.extra_hand_bonus
    end
    if self.effect.config.extra_discard_bonus then 
        G.GAME.modifiers.money_per_discard = self.effect.config.extra_discard_bonus
    end
end

function Back:load(backTable)
    self.name = backTable.name
    self.pos = backTable.pos
    self.effect = backTable.effect
    self.effect.center = G.P_CENTERS[backTable.key] or G.P_CENTERS.b_red


    self.loc_name = localize{type = 'name_text', set = 'Back', key = self.effect.center.key}
end
