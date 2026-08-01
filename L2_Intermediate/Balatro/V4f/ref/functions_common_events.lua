function set_screen_positions()
    if G.STAGE == G.STAGES.RUN then
        G.hand.T.x = G.TILE_W - G.hand.T.w - 2.85
        G.hand.T.y = G.TILE_H - G.hand.T.h

        G.play.T.x = G.hand.T.x + (G.hand.T.w - G.play.T.w)/2
        G.play.T.y = G.hand.T.y - 3.6

        G.jokers.T.x = G.hand.T.x - 0.1
        G.jokers.T.y = 0

        G.consumeables.T.x = G.jokers.T.x + G.jokers.T.w + 0.2
        G.consumeables.T.y = 0

        G.deck.T.x = G.TILE_W - G.deck.T.w - 0.5
        G.deck.T.y = G.TILE_H - G.deck.T.h

        G.discard.T.x = G.jokers.T.x + G.jokers.T.w/2 + 0.3 + 15
        G.discard.T.y = 4.2

        G.hand:hard_set_VT()
        G.play:hard_set_VT()
        G.jokers:hard_set_VT()
        G.consumeables:hard_set_VT()
        G.deck:hard_set_VT()
        G.discard:hard_set_VT()
    end
    if G.STAGE == G.STAGES.MAIN_MENU then
        if G.STATE == G.STATES.DEMO_CTA then
            G.title_top.T.x = G.TILE_W/2 - G.title_top.T.w/2
            G.title_top.T.y = G.TILE_H/2 - G.title_top.T.h/2 - 2
        else
            G.title_top.T.x = G.TILE_W/2 - G.title_top.T.w/2
            G.title_top.T.y = G.TILE_H/2 - G.title_top.T.h/2 -(G.debug_splash_size_toggle and 2 or 1.2)--|||||||||||||||||
        end

        G.title_top:hard_set_VT()
    end
end

function ease_chips(mod)
    G.E_MANAGER:add_event(Event({
        trigger = 'immediate',
        func = function()
            local chip_UI = G.HUD:get_UIE_by_ID('chip_UI_count')

            mod = mod or 0

            --Ease from current chips to the new number of chips
            G.E_MANAGER:add_event(Event({
                trigger = 'ease',
                blockable = false,
                ref_table = G.GAME,
                ref_value = 'chips',
                ease_to = mod,
                delay =  0.3,
                func = (function(t) return math.floor(t) end)
            }))
            --Popup text next to the chips in UI showing number of chips gained/lost
                chip_UI:juice_up()
            --Play a chip sound
            play_sound('chips2')
            return true
        end
      }))
end

function ease_dollars(mod, instant)
    local function _mod(mod)
        local dollar_UI = G.HUD:get_UIE_by_ID('dollar_text_UI')
        mod = mod or 0
        local text = '+'..localize('$')
        local col = G.C.MONEY
        if mod < 0 then
            text = '-'..localize('$')
            col = G.C.RED              
        else
          inc_career_stat('c_dollars_earned', mod)
        end
        --Ease from current chips to the new number of chips
        G.GAME.dollars = G.GAME.dollars + mod
        check_and_set_high_score('most_money', G.GAME.dollars)
        check_for_unlock({type = 'money'})
        dollar_UI.config.object:update()
        G.HUD:recalculate()
        --Popup text next to the chips in UI showing number of chips gained/lost
        attention_text({
          text = text..tostring(math.abs(mod)),
          scale = 0.8, 
          hold = 0.7,
          cover = dollar_UI.parent,
          cover_colour = col,
          align = 'cm',
          })
        --Play a chip sound
        play_sound('coin1')
    end
    if instant then
        _mod(mod)
    else
        G.E_MANAGER:add_event(Event({
        trigger = 'immediate',
        func = function()
            _mod(mod)
            return true
        end
        }))
    end
end

function ease_discard(mod, instant, silent)
    local _mod = function(mod)
        if math.abs(math.max(G.GAME.current_round.discards_left, mod)) == 0 then return end
        local discard_UI = G.HUD:get_UIE_by_ID('discard_UI_count')
        mod = mod or 0
        mod = math.max(-G.GAME.current_round.discards_left, mod)
        local text = '+'
        local col = G.C.GREEN
        if mod < 0 then
            text = ''
            col = G.C.RED
        end
        --Ease from current chips to the new number of chips
        G.GAME.current_round.discards_left = G.GAME.current_round.discards_left + mod
        --Popup text next to the chips in UI showing number of chips gained/lost
        discard_UI.config.object:update()
        G.HUD:recalculate()
        attention_text({
          text = text..mod,
          scale = 0.8, 
          hold = 0.7,
          cover = discard_UI.parent,
          cover_colour = col,
          align = 'cm',
          })
        --Play a chip sound
        if not silent then play_sound('chips2') end
    end
    if instant then
        _mod(mod)
    else
        G.E_MANAGER:add_event(Event({
        trigger = 'immediate',
        func = function()
            _mod(mod)
            return true
        end
        }))
    end
end

function ease_hands_played(mod, instant)
    local _mod = function(mod)
        local hand_UI = G.HUD:get_UIE_by_ID('hand_UI_count')
        mod = mod or 0
        local text = '+'
        local col = G.C.GREEN
        if mod < 0 then
            text = ''
            col = G.C.RED
        end
        --Ease from current chips to the new number of chips
        G.GAME.current_round.hands_left = G.GAME.current_round.hands_left + mod
        hand_UI.config.object:update()
        G.HUD:recalculate()
        --Popup text next to the chips in UI showing number of chips gained/lost
        attention_text({
          text = text..mod,
          scale = 0.8, 
          hold = 0.7,
          cover = hand_UI.parent,
          cover_colour = col,
          align = 'cm',
          })
        --Play a chip sound
        play_sound('chips2')
    end
    if instant then
        _mod(mod)
    else
        G.E_MANAGER:add_event(Event({
        trigger = 'immediate',
        func = function()
            _mod(mod)
            return true
        end
        }))
    end
end

function ease_ante(mod)
    G.E_MANAGER:add_event(Event({
      trigger = 'immediate',
      func = function()
          local ante_UI = G.hand_text_area.ante
          mod = mod or 0
          local text = '+'
          local col = G.C.IMPORTANT
          if mod < 0 then
              text = '-'
              col = G.C.RED
          end
          G.GAME.round_resets.ante = G.GAME.round_resets.ante + mod
          check_and_set_high_score('furthest_ante', G.GAME.round_resets.ante)
          ante_UI.config.object:update()
          G.HUD:recalculate()
          --Popup text next to the chips in UI showing number of chips gained/lost
          attention_text({
            text = text..tostring(math.abs(mod)),
            scale = 1, 
            hold = 0.7,
            cover = ante_UI.parent,
            cover_colour = col,
            align = 'cm',
            })
          --Play a chip sound
          play_sound('highlight2', 0.685, 0.2)
          play_sound('generic1')
          return true
      end
    }))
end

function ease_round(mod)
    G.E_MANAGER:add_event(Event({
      trigger = 'immediate',
      func = function()
          local round_UI = G.hand_text_area.round
          mod = mod or 0
          local text = '+'
          local col = G.C.IMPORTANT
          if mod < 0 then
              text = ''
              col = G.C.RED
          end
          G.GAME.round = G.GAME.round + mod
          check_and_set_high_score('furthest_round', G.GAME.round)
          check_and_set_high_score('furthest_ante', G.GAME.round_resets.ante)
          round_UI.config.object:update()
          G.HUD:recalculate()
          --Popup text next to the chips in UI showing number of chips gained/lost
          attention_text({
            text = text..tostring(math.abs(mod)),
            scale = 1, 
            hold = 0.7,
            cover = round_UI.parent,
            cover_colour = col,
            align = 'cm',
            })
          --Play a chip sound
          play_sound('timpani', 0.8)
          play_sound('generic1')
          return true
      end
    }))
end

function ease_value(ref_table, ref_value, mod, floored, timer_type, not_blockable, delay, ease_type)
    mod = mod or 0

    --Ease from current chips to the new number of chips
    G.E_MANAGER:add_event(Event({
        trigger = 'ease',
        blockable = (not_blockable == false),
        blocking = false,
        ref_table = ref_table,
        ref_value = ref_value,
        ease_to = ref_table[ref_value] + mod,
        timer = timer_type,
        delay =  delay or 0.3,
        type = ease_type or nil,
        func = (function(t) if floored then return math.floor(t) else return t end end)
    }))
end

function ease_background_colour(args)
    for k, v in pairs(G.C.BACKGROUND) do
        if args.new_colour and (k == 'C' or k == 'L' or k == 'D') then 
            if args.special_colour and args.tertiary_colour then 
                local col_key = k == 'L' and 'new_colour' or k == 'C' and 'special_colour' or k == 'D' and 'tertiary_colour'
                ease_value(v, 1, args[col_key][1] - v[1], false, nil, true, 0.6)
                ease_value(v, 2, args[col_key][2] - v[2], false, nil, true, 0.6)
                ease_value(v, 3, args[col_key][3] - v[3], false, nil, true, 0.6)
            else
                local brightness = k == 'L' and 1.3 or k == 'D' and (args.special_colour and 0.4 or 0.7) or 0.9
                if k == 'C' and args.special_colour then
                    ease_value(v, 1, args.special_colour[1] - v[1], false, nil, true, 0.6)
                    ease_value(v, 2, args.special_colour[2] - v[2], false, nil, true, 0.6)
                    ease_value(v, 3, args.special_colour[3] - v[3], false, nil, true, 0.6)
                else
                    ease_value(v, 1, args.new_colour[1]*brightness - v[1], false, nil, true, 0.6)
                    ease_value(v, 2, args.new_colour[2]*brightness - v[2], false, nil, true, 0.6)
                    ease_value(v, 3, args.new_colour[3]*brightness - v[3], false, nil, true, 0.6)
                end
            end
        end
    end
    if args.contrast then 
        ease_value(G.C.BACKGROUND, 'contrast', args.contrast - G.C.BACKGROUND.contrast, false, nil, true, 0.6)
    end
end

function ease_colour(old_colour, new_colour, delay)
    ease_value(old_colour, 1, new_colour[1] - old_colour[1], false, 'REAL', nil, delay)
    ease_value(old_colour, 2, new_colour[2] - old_colour[2], false, 'REAL', nil, delay)
    ease_value(old_colour, 3, new_colour[3] - old_colour[3], false, 'REAL', nil, delay)
    ease_value(old_colour, 4, new_colour[4] - old_colour[4], false, 'REAL', nil, delay)
end


function ease_background_colour_blind(state, blind_override)
    local blindname = ((blind_override or (G.GAME.blind and G.GAME.blind.name ~= '' and G.GAME.blind.name)) or 'Small Blind')
    local blindname = (blindname == '' and 'Small Blind' or blindname)

    --For the blind related colours
    if state == G.STATES.SHOP then 
        ease_colour(G.C.DYN_UI.MAIN, mix_colours(G.C.RED, G.C.BLACK, 0.9))
    elseif state == G.STATES.TAROT_PACK then
        ease_colour(G.C.DYN_UI.MAIN, mix_colours(G.C.WHITE, G.C.BLACK, 0.9))
    elseif state == G.STATES.SPECTRAL_PACK then
        ease_colour(G.C.DYN_UI.MAIN, mix_colours(G.C.SECONDARY_SET.Spectral, G.C.BLACK, 0.9))
    elseif state == G.STATES.STANDARD_PACK then
        ease_colour(G.C.DYN_UI.MAIN, G.C.RED)
    elseif state == G.STATES.BUFFOON_PACK then
        ease_colour(G.C.DYN_UI.MAIN, G.C.FILTER)
    elseif state == G.STATES.PLANET_PACK then
        ease_colour(G.C.DYN_UI.MAIN, mix_colours(G.C.SECONDARY_SET.Planet, G.C.BLACK, 0.9))
    elseif G.GAME.blind then 
        G.GAME.blind:change_colour()
    end
    --For the actual background colour
    if state == G.STATES.TAROT_PACK then
        ease_background_colour{new_colour = G.C.PURPLE, special_colour = darken(G.C.BLACK, 0.2), contrast = 1.5}
    elseif state == G.STATES.SPECTRAL_PACK then
        ease_background_colour{new_colour = G.C.SECONDARY_SET.Spectral, special_colour = darken(G.C.BLACK, 0.2), contrast = 2}
    elseif state == G.STATES.STANDARD_PACK then
        ease_background_colour{new_colour = darken(G.C.BLACK, 0.2), special_colour = G.C.RED, contrast = 3}
    elseif state == G.STATES.BUFFOON_PACK then
        ease_background_colour{new_colour = G.C.FILTER, special_colour = G.C.BLACK, contrast = 2}
    elseif state == G.STATES.PLANET_PACK then
        ease_background_colour{new_colour = G.C.BLACK, contrast = 3}
    elseif G.GAME.won then 
        ease_background_colour{new_colour = G.C.BLIND.won, contrast = 1}
    elseif blindname == 'Small Blind' or blindname == 'Big Blind' or blindname == '' then
        ease_background_colour{new_colour = G.C.BLIND['Small'], contrast = 1}
    else

        local boss_col = G.C.BLACK
        for k, v in pairs(G.P_BLINDS) do
            if v.name == blindname then
                if v.boss.showdown then 
                    ease_background_colour{new_colour = G.C.BLUE, special_colour = G.C.RED, tertiary_colour = darken(G.C.BLACK, 0.4), contrast = 3}
                    return
                end
                boss_col = v.boss_colour or G.C.BLACK
            end
        end
        ease_background_colour{new_colour = lighten(mix_colours(boss_col, G.C.BLACK, 0.3), 0.1), special_colour = boss_col, contrast = 2}
    end
end

function delay(time, queue)
    G.E_MANAGER:add_event(Event({
        trigger = 'after',
        delay = time or 1,
        func = function()
           return true
        end
    }), queue)
end

function add_joker(joker, edition, silent, eternal)
    local _area = G.P_CENTERS[joker].consumeable and G.consumeables or G.jokers
    local _T = _area and _area.T or {x = G.ROOM.T.w/2 - G.CARD_W/2, y = G.ROOM.T.h/2 - G.CARD_H/2}
    local card = Card(_T.x, _T.y, G.CARD_W, G.CARD_H, G.P_CARDS.empty, G.P_CENTERS[joker],{discover = true, bypass_discovery_center = true, bypass_discovery_ui = true, bypass_back = G.GAME.selected_back.pos })
    card:start_materialize(nil, silent)
    if _area then card:add_to_deck() end
    if edition then card:set_edition{[edition] = true} end
    if eternal then card:set_eternal(true) end
    if _area and card.ability.set == 'Joker' then _area:emplace(card)
    elseif G.consumeables then G.consumeables:emplace(card) end
    card.created_on_pause = nil
    return card
end

function draw_card(from, to, percent, dir, sort, card, delay, mute, stay_flipped, vol, discarded_only)
    percent = percent or 50
    delay = delay or 0.1 
    if dir == 'down' then 
        percent = 1-percent
    end
    sort = sort or false
    local drawn = nil

    G.E_MANAGER:add_event(Event({
        trigger = 'before',
        delay = delay,
        func = function()
            if card then 
                if from then card = from:remove_card(card) end
                if card then drawn = true end
                local stay_flipped = G.GAME and G.GAME.blind and G.GAME.blind:stay_flipped(to, card)
                if G.GAME.modifiers.flipped_cards and to == G.hand then
                    if pseudorandom(pseudoseed('flipped_card')) < 1/G.GAME.modifiers.flipped_cards then
                        stay_flipped = true
                    end
                end
                to:emplace(card, nil, stay_flipped)
            else
                if to:draw_card_from(from, stay_flipped, discarded_only) then drawn = true end
            end
            if not mute and drawn then
                if from == G.deck or from == G.hand or from == G.play or from == G.jokers or from == G.consumeables or from == G.discard then
                    G.VIBRATION = G.VIBRATION + 0.6
                end
                play_sound('card1', 0.85 + percent*0.2/100, 0.6*(vol or 1))
            end
            if sort then
                to:sort()
            end
            return true
        end
      }))
end

function highlight_card(card, percent, dir)
    percent = percent or 0.5
    local highlight = true
    if dir == 'down' then 
        percent = 1-percent
        highlight = false
    end

    G.E_MANAGER:add_event(Event({
        trigger = 'before',
        delay = 0.1,
        func = function()
            card:highlight(highlight)
            play_sound('cardSlide1', 0.85 + percent*0.2)
            return true
        end
      }))
end

function play_area_status_text(text, silent, delay)
    local delay = delay or 0.6
    G.E_MANAGER:add_event(Event({
    trigger = (delay==0 and 'immediate' or 'before'),
    delay = delay,
    func = function()
        attention_text({
            scale = 0.9, text = text, hold = 0.9, align = 'tm',
            major = G.play, offset = {x = 0, y = -1}
        })
        if not silent then 
            G.ROOM.jiggle = G.ROOM.jiggle + 2
            play_sound('cardFan2')
        end
      return true
    end
    }))
end

function level_up_hand(card, hand, instant, amount)
    amount = amount or 1
    G.GAME.hands[hand].level = math.max(0, G.GAME.hands[hand].level + amount)
    G.GAME.hands[hand].mult = math.max(G.GAME.hands[hand].s_mult + G.GAME.hands[hand].l_mult*(G.GAME.hands[hand].level - 1), 1)
    G.GAME.hands[hand].chips = math.max(G.GAME.hands[hand].s_chips + G.GAME.hands[hand].l_chips*(G.GAME.hands[hand].level - 1), 0)
    if not instant then 
        G.E_MANAGER:add_event(Event({trigger = 'after', delay = 0.2, func = function()
            play_sound('tarot1')
            if card then card:juice_up(0.8, 0.5) end
            G.TAROT_INTERRUPT_PULSE = true
            return true end }))
        update_hand_text({delay = 0}, {mult = G.GAME.hands[hand].mult, StatusText = true})
        G.E_MANAGER:add_event(Event({trigger = 'after', delay = 0.9, func = function()
            play_sound('tarot1')
            if card then card:juice_up(0.8, 0.5) end
            return true end }))
        update_hand_text({delay = 0}, {chips = G.GAME.hands[hand].chips, StatusText = true})
        G.E_MANAGER:add_event(Event({trigger = 'after', delay = 0.9, func = function()
            play_sound('tarot1')
            if card then card:juice_up(0.8, 0.5) end
            G.TAROT_INTERRUPT_PULSE = nil
            return true end }))
        update_hand_text({sound = 'button', volume = 0.7, pitch = 0.9, delay = 0}, {level=G.GAME.hands[hand].level})
        delay(1.3)
    end
    G.E_MANAGER:add_event(Event({
        trigger = 'immediate',
        func = (function() check_for_unlock{type = 'upgrade_hand', hand = hand, level = G.GAME.hands[hand].level} return true end)
    }))
end

function update_hand_text(config, vals)
    G.E_MANAGER:add_event(Event({--This is the Hand name text for the poker hand
    trigger = 'before',
    blockable = not config.immediate,
    delay = config.delay or 0.8,
    func = function()
        local col = G.C.GREEN
        if vals.chips and G.GAME.current_round.current_hand.chips ~= vals.chips then
            local delta = (type(vals.chips) == 'number' and type(G.GAME.current_round.current_hand.chips) == 'number') and (vals.chips - G.GAME.current_round.current_hand.chips) or 0
            if delta < 0 then delta = ''..delta; col = G.C.RED
            elseif delta > 0 then delta = '+'..delta
            else delta = ''..delta
            end
            if type(vals.chips) == 'string' then delta = vals.chips end
            G.GAME.current_round.current_hand.chips = vals.chips
            G.hand_text_area.chips:update(0)
            if vals.StatusText then 
                attention_text({
                    text =delta,
                    scale = 0.8, 
                    hold = 1,
                    cover = G.hand_text_area.chips.parent,
                    cover_colour = mix_colours(G.C.CHIPS, col, 0.1),
                    emboss = 0.05,
                    align = 'cm',
                    cover_align = 'cr'
                })
            end
        end
        if vals.mult and G.GAME.current_round.current_hand.mult ~= vals.mult then
            local delta = (type(vals.mult) == 'number' and type(G.GAME.current_round.current_hand.mult) == 'number')and (vals.mult - G.GAME.current_round.current_hand.mult) or 0
            if delta < 0 then delta = ''..delta; col = G.C.RED
            elseif delta > 0 then delta = '+'..delta
            else delta = ''..delta
            end
            if type(vals.mult) == 'string' then delta = vals.mult end
            G.GAME.current_round.current_hand.mult = vals.mult
            G.hand_text_area.mult:update(0)
            if vals.StatusText then 
                attention_text({
                    text =delta,
                    scale = 0.8, 
                    hold = 1,
                    cover = G.hand_text_area.mult.parent,
                    cover_colour = mix_colours(G.C.MULT, col, 0.1),
                    emboss = 0.05,
                    align = 'cm',
                    cover_align = 'cl'
                })
            end
            if not G.TAROT_INTERRUPT then G.hand_text_area.mult:juice_up() end
        end
        if vals.handname and G.GAME.current_round.current_hand.handname ~= vals.handname then
            G.GAME.current_round.current_hand.handname = vals.handname
            if not config.nopulse then 
                G.hand_text_area.handname.config.object:pulse(0.2)
            end
        end
        if vals.chip_total then G.GAME.current_round.current_hand.chip_total = vals.chip_total;G.hand_text_area.chip_total.config.object:pulse(0.5) end
        if vals.level and G.GAME.current_round.current_hand.hand_level ~= ' '..localize('k_lvl')..tostring(vals.level) then
            if vals.level == '' then
                G.GAME.current_round.current_hand.hand_level = vals.level
            else
                G.GAME.current_round.current_hand.hand_level = ' '..localize('k_lvl')..tostring(vals.level)
                if type(vals.level) == 'number' then 
                    G.hand_text_area.hand_level.config.colour = G.C.HAND_LEVELS[math.min(vals.level, 7)]
                else
                    G.hand_text_area.hand_level.config.colour = G.C.HAND_LEVELS[1]
                end
                G.hand_text_area.hand_level:juice_up()
            end
        end
        if config.sound and not config.modded then play_sound(config.sound, config.pitch or 1, config.volume or 1) end
        if config.modded then 
            G.HUD_blind:get_UIE_by_ID('HUD_blind_debuff_1'):juice_up(0.3, 0)
            G.HUD_blind:get_UIE_by_ID('HUD_blind_debuff_2'):juice_up(0.3, 0)
            G.GAME.blind:juice_up()
            G.E_MANAGER:add_event(Event({trigger = 'after', delay = 0.06*G.SETTINGS.GAMESPEED, blockable = false, blocking = false, func = function()
                play_sound('tarot2', 0.76, 0.4);return true end}))
            play_sound('tarot2', 1, 0.4)
        end
        return true
    end}))
end

function eval_card(card, context)
    context = context or {}
    local ret = {}

    if context.repetition_only then
        local seals = card:calculate_seal(context)
        if seals then
            ret.seals = seals
        end
        return ret
    end
    
    if context.cardarea == G.play then
        local chips = card:get_chip_bonus()
        if chips > 0 then 
            ret.chips = chips
        end

        local mult = card:get_chip_mult()
        if mult > 0 then 
            ret.mult = mult
        end

        local x_mult = card:get_chip_x_mult(context)
        if x_mult > 0 then 
            ret.x_mult = x_mult
        end

        local p_dollars = card:get_p_dollars()
        if p_dollars > 0 then 
            ret.p_dollars = p_dollars
        end

        local jokers = card:calculate_joker(context)
        if jokers then 
            ret.jokers = jokers
        end

        local edition = card:get_edition(context)
        if edition then 
            ret.edition = edition
        end
    end

    if context.cardarea == G.hand then
        local h_mult = card:get_chip_h_mult()
        if h_mult > 0 then 
            ret.h_mult = h_mult
        end

        local h_x_mult = card:get_chip_h_x_mult()
        if h_x_mult > 0 then 
            ret.x_mult = h_x_mult
        end

        local jokers = card:calculate_joker(context)
        if jokers then 
            ret.jokers = jokers
        end
    end

    if context.cardarea == G.jokers or context.card == G.consumeables then
        local jokers = nil
        if context.edition then
            jokers = card:get_edition(context)
        elseif context.other_joker then
            jokers = context.other_joker:calculate_joker(context)
        else
            jokers = card:calculate_joker(context)
        end
        if jokers then 
            ret.jokers = jokers
        end
    end

    return ret
end

function set_alerts()
    if G.REFRESH_ALERTS then
        G.REFRESH_ALERTS = nil
        local alert_joker, alert_voucher, alert_tarot, alert_planet, alert_spectral, alert_blind, alert_edition, alert_tag, alert_seal, alert_booster = false,false,false,false,false,false,false,false,false,false
        for k, v in pairs(G.P_CENTERS) do
            if v.discovered and not v.alerted then
                if v.set == 'Voucher' then alert_voucher = true end
                if v.set == 'Tarot' then alert_tarot = true end
                if v.set == 'Planet' then alert_planet = true end
                if v.set == 'Spectral' then alert_spectral = true end
                if v.set == 'Joker' then alert_joker = true end
                if v.set == 'Edition' then alert_edition = true end
                if v.set == 'Booster' then alert_booster = true end
            end
        end
        for k, v in pairs(G.P_BLINDS) do
            if v.discovered and not v.alerted then
                alert_blind = true
            end
        end
        for k, v in pairs(G.P_TAGS) do
            if v.discovered and not v.alerted then
                alert_tag = true
            end
        end
        for k, v in pairs(G.P_SEALS) do
            if v.discovered and not v.alerted then
                alert_seal = true
            end
        end

        local alert_any = alert_voucher or alert_joker or alert_tarot or alert_planet or alert_spectral or alert_blind or alert_edition or alert_seal or alert_tag

        G.ARGS.set_alerts_alertables = G.ARGS.set_alerts_alertables or {
            {id = 'your_collection', alert_uibox_name = 'your_collection_alert'},
            {id = 'your_collection_jokers', alert_uibox_name = 'your_collection_jokers_alert'},
            {id = 'your_collection_tarots', alert_uibox_name = 'your_collection_tarots_alert'},
            {id = 'your_collection_planets', alert_uibox_name = 'your_collection_planets_alert'},
            {id = 'your_collection_spectrals', alert_uibox_name = 'your_collection_spectrals_alert'},
            {id = 'your_collection_vouchers', alert_uibox_name = 'your_collection_vouchers_alert'},
            {id = 'your_collection_editions', alert_uibox_name = 'your_collection_editions_alert'},
            {id = 'your_collection_blinds', alert_uibox_name = 'your_collection_blinds_alert'},
            {id = 'your_collection_tags', alert_uibox_name = 'your_collection_tags_alert'},
            {id = 'your_collection_seals', alert_uibox_name = 'your_collection_seals_alert'},
            {id = 'your_collection_boosters', alert_uibox_name = 'your_collection_boosters_alert'},
        }
        G.ARGS.set_alerts_alertables[1].should_alert = alert_any
        G.ARGS.set_alerts_alertables[2].should_alert = alert_joker
        G.ARGS.set_alerts_alertables[3].should_alert = alert_tarot
        G.ARGS.set_alerts_alertables[4].should_alert = alert_planet
        G.ARGS.set_alerts_alertables[5].should_alert = alert_spectral
        G.ARGS.set_alerts_alertables[6].should_alert = alert_voucher
        G.ARGS.set_alerts_alertables[7].should_alert = alert_edition
        G.ARGS.set_alerts_alertables[8].should_alert = alert_blind
        G.ARGS.set_alerts_alertables[9].should_alert = alert_tag
        G.ARGS.set_alerts_alertables[10].should_alert = alert_seal
        G.ARGS.set_alerts_alertables[11].should_alert = alert_booster

        for k, v in ipairs(G.ARGS.set_alerts_alertables) do
            if G.OVERLAY_MENU and G.OVERLAY_MENU:get_UIE_by_ID(v.id) then
                if v.should_alert then
                    if not G[v.alert_uibox_name] then 
                        G[v.alert_uibox_name] = UIBox{
                            definition = create_UIBox_card_alert({red_bad = true}),
                            config = {align="tri", offset = {x = 0.05, y = -0.05}, major = G.OVERLAY_MENU:get_UIE_by_ID(v.id), instance_type = 'ALERT'}
                        }
                        G[v.alert_uibox_name].states.collide.can = false
                    end
                elseif G[v.alert_uibox_name] then 
                    G[v.alert_uibox_name]:remove()
                    G[v.alert_uibox_name] = nil
                end
            elseif G[v.alert_uibox_name] then
                G[v.alert_uibox_name]:remove()
                G[v.alert_uibox_name] = nil
            end
        end

        if G.MAIN_MENU_UI then 
            if alert_any then
                if not G.collection_alert then 
                    G.collection_alert = UIBox{definition = create_UIBox_card_alert(), config = {align="tri", offset = {x = 0.05, y = -0.05}, major = G.MAIN_MENU_UI:get_UIE_by_ID('collection_button')}}
                    G.collection_alert.states.collide.can = false
                end
            elseif G.collection_alert then 
                G.collection_alert:remove()
                G.collection_alert = nil
            end
        elseif G.collection_alert then 
            G.collection_alert:remove()
            G.collection_alert = nil
        end
    end
end

function set_main_menu_UI()
    G.MAIN_MENU_UI = UIBox{
        definition = create_UIBox_main_menu_buttons(), 
        config = {align="bmi", offset = {x=0,y=10}, major = G.ROOM_ATTACH, bond = 'Weak'}
    }
    G.MAIN_MENU_UI.alignment.offset.y = 0
    G.MAIN_MENU_UI:align_to_major()
    G.E_MANAGER:add_event(Event({
        blockable = false,
        blocking = false,
        func = (function()
            if (not G.F_DISP_USERNAME) or (type(G.F_DISP_USERNAME) == 'string') then
                G.PROFILE_BUTTON = UIBox{
                    definition =  create_UIBox_profile_button(), 
                        config = {align="bli", offset = {x=-10,y=0}, major = G.ROOM_ATTACH, bond = 'Weak'}}
                    G.PROFILE_BUTTON.alignment.offset.x = 0
                    G.PROFILE_BUTTON:align_to_major()
                return true
            end
        end)
      }))

    
    G.CONTROLLER:snap_to{node = G.MAIN_MENU_UI:get_UIE_by_ID('main_menu_play')}
end

function card_eval_status_text(card, eval_type, amt, percent, dir, extra)
    percent = percent or (0.9 + 0.2*math.random())
    if dir == 'down' then 
        percent = 1-percent
    end

    if extra and extra.focus then card = extra.focus end

    local text = ''
    local sound = nil
    local volume = 1
    local card_aligned = 'bm'
    local y_off = 0.15*G.CARD_H
    if card.area == G.jokers or card.area == G.consumeables then
        y_off = 0.05*card.T.h
    elseif card.area == G.hand then
        y_off = -0.05*G.CARD_H
        card_aligned = 'tm'
    elseif card.area == G.play then
        y_off = -0.05*G.CARD_H
        card_aligned = 'tm'
    elseif card.jimbo  then
        y_off = -0.05*G.CARD_H
        card_aligned = 'tm'
    end
    local config = {}
    local delay = 0.65
    local colour = config.colour or (extra and extra.colour) or ( G.C.FILTER )
    local extrafunc = nil

    if eval_type == 'debuff' then 
        sound = 'cancel'
        amt = 1
        colour = G.C.RED
        config.scale = 0.6
        text = localize('k_debuffed')
    elseif eval_type == 'chips' then 
        sound = 'chips1'
        amt = amt
        colour = G.C.CHIPS
        text = localize{type='variable',key='a_chips',vars={amt}}
        delay = 0.6
    elseif eval_type == 'mult' then 
        sound = 'multhit1'--'other1'
        amt = amt
        text = localize{type='variable',key='a_mult',vars={amt}}
        colour = G.C.MULT
        config.type = 'fade'
        config.scale = 0.7
    elseif (eval_type == 'x_mult') or (eval_type == 'h_x_mult') then 
        sound = 'multhit2'
        volume = 0.7
        amt = amt
        text = localize{type='variable',key='a_xmult',vars={amt}}
        colour = G.C.XMULT
        config.type = 'fade'
        config.scale = 0.7
    elseif eval_type == 'h_mult' then 
        sound = 'multhit1'
        amt = amt
        text = localize{type='variable',key='a_mult',vars={amt}}
        colour = G.C.MULT
        config.type = 'fade'
        config.scale = 0.7
    elseif eval_type == 'dollars' then 
        sound = 'coin3'
        amt = amt
        text = (amt <-0.01 and '-' or '')..localize("$")..tostring(math.abs(amt))
        colour = amt <-0.01 and G.C.RED or G.C.MONEY
    elseif eval_type == 'swap' then 
        sound = 'generic1'
        amt = amt
        text = localize('k_swapped_ex')
        colour = G.C.PURPLE
    elseif eval_type == 'extra' or eval_type == 'jokers' then 
        sound = extra.edition and 'foil2' or extra.mult_mod and 'multhit1' or extra.Xmult_mod and 'multhit2' or 'generic1'
        if extra.edition then 
            colour = G.C.DARK_EDITION
        end
        volume = extra.edition and 0.3 or sound == 'multhit2' and 0.7 or 1
        delay = extra.delay or 0.75
        amt = 1
        text = extra.message or text
        if not extra.edition and (extra.mult_mod or extra.Xmult_mod)  then
            colour = G.C.MULT
        end
        if extra.chip_mod then
            config.type = 'fall'
            colour = G.C.CHIPS
            config.scale = 0.7
        elseif extra.swap then
            config.type = 'fall'
            colour = G.C.PURPLE
            config.scale = 0.7
        else
            config.type = 'fall'
            config.scale = 0.7
        end
    end
    delay = delay*1.25

    if amt > 0 or amt < 0 then
        if extra and extra.instant then
            if extrafunc then extrafunc() end
            attention_text({
                text = text,
                scale = config.scale or 1, 
                hold = delay - 0.2,
                backdrop_colour = colour,
                align = card_aligned,
                major = card,
                offset = {x = 0, y = y_off}
            })
            play_sound(sound, 0.8+percent*0.2, volume)
            if not extra or not extra.no_juice then
                card:juice_up(0.6, 0.1)
                G.ROOM.jiggle = G.ROOM.jiggle + 0.7
            end
        else
            G.E_MANAGER:add_event(Event({ --Add bonus chips from this card
                    trigger = 'before',
                    delay = delay,
                    func = function()
                    if extrafunc then extrafunc() end
                    attention_text({
                        text = text,
                        scale = config.scale or 1, 
                        hold = delay - 0.2,
                        backdrop_colour = colour,
                        align = card_aligned,
                        major = card,
                        offset = {x = 0, y = y_off}
                    })
                    play_sound(sound, 0.8+percent*0.2, volume)
                    if not extra or not extra.no_juice then
                        card:juice_up(0.6, 0.1)
                        G.ROOM.jiggle = G.ROOM.jiggle + 0.7
                    end
                    return true
                    end
            }))
        end
    end
    if extra and extra.playing_cards_created then 
        playing_card_joker_effects(extra.playing_cards_created)
    end
end

function add_round_eval_row(config)
    local config = config or {}
    local width = G.round_eval.T.w - 0.51
    local num_dollars = config.dollars or 1
    local scale = 0.9

    if config.name ~= 'bottom' then
        if config.name ~= 'blind1' then
            if not G.round_eval.divider_added then 
                G.E_MANAGER:add_event(Event({
                    trigger = 'after',delay = 0.25,
                    func = function() 
                        local spacer = {n=G.UIT.R, config={align = "cm", minw = width}, nodes={
                            {n=G.UIT.O, config={object = DynaText({string = {'......................................'}, colours = {G.C.WHITE},shadow = true, float = true, y_offset = -30, scale = 0.45, spacing = 13.5, font = G.LANGUAGES['en-us'].font, pop_in = 0})}}
                        }}
                        G.round_eval:add_child(spacer,G.round_eval:get_UIE_by_ID(config.bonus and 'bonus_round_eval' or 'base_round_eval'))
                        return true
                    end
                }))
                delay(0.6)
                G.round_eval.divider_added = true
            end
        else
            delay(0.2)
        end

        delay(0.2)

        G.E_MANAGER:add_event(Event({
            trigger = 'before',delay = 0.5,
            func = function()
                --Add the far left text and context first:
                local left_text = {}
                if config.name == 'blind1' then
                    local stake_sprite = get_stake_sprite(G.GAME.stake or 1, 0.5)
                    local blind_sprite = AnimatedSprite(0, 0, 1.2,1.2, G.ANIMATION_ATLAS['blind_chips'], copy_table(G.GAME.blind.pos))
                    blind_sprite:define_draw_steps({
                        {shader = 'dissolve', shadow_height = 0.05},
                        {shader = 'dissolve'}
                    })
                    table.insert(left_text, {n=G.UIT.O, config={w=1.2,h=1.2 , object = blind_sprite, hover = true, can_collide = false}})
  
                    table.insert(left_text,                  
                    config.saved and 
                    {n=G.UIT.C, config={padding = 0.05, align = 'cm'}, nodes={
                        {n=G.UIT.R, config={align = 'cm'}, nodes={
                            {n=G.UIT.O, config={object = DynaText({string = {' '..localize('ph_mr_bones')..' '}, colours = {G.C.FILTER}, shadow = true, pop_in = 0, scale = 0.5*scale, silent = true})}}
                        }}
                    }}
                    or {n=G.UIT.C, config={padding = 0.05, align = 'cm'}, nodes={
                        {n=G.UIT.R, config={align = 'cm'}, nodes={
                            {n=G.UIT.O, config={object = DynaText({string = {' '..localize('ph_score_at_least')..' '}, colours = {G.C.UI.TEXT_LIGHT}, shadow = true, pop_in = 0, scale = 0.4*scale, silent = true})}}
                        }},
                        {n=G.UIT.R, config={align = 'cm', minh = 0.8}, nodes={
                            {n=G.UIT.O, config={w=0.5,h=0.5 , object = stake_sprite, hover = true, can_collide = false}},
                            {n=G.UIT.T, config={text = G.GAME.blind.chip_text, scale = scale_number(G.GAME.blind.chips, scale, 100000), colour = G.C.RED, shadow = true}}
                        }}
                    }}) 
                elseif string.find(config.name, 'tag') then
                    local blind_sprite = Sprite(0, 0, 0.7,0.7, G.ASSET_ATLAS['tags'], copy_table(config.pos))
                    blind_sprite:define_draw_steps({
                        {shader = 'dissolve', shadow_height = 0.05},
                        {shader = 'dissolve'}
                    })
                    blind_sprite:juice_up()
                    table.insert(left_text, {n=G.UIT.O, config={w=0.7,h=0.7 , object = blind_sprite, hover = true, can_collide = false}})
                    table.insert(left_text, {n=G.UIT.O, config={object = DynaText({string = {config.condition}, colours = {G.C.UI.TEXT_LIGHT}, shadow = true, pop_in = 0, scale = 0.4*scale, silent = true})}})                   
                elseif config.name == 'hands' then
                    table.insert(left_text, {n=G.UIT.T, config={text = config.disp or config.dollars, scale = 0.8*scale, colour = G.C.BLUE, shadow = true, juice = true}})
                    table.insert(left_text, {n=G.UIT.O, config={object = DynaText({string = {" "..localize{type = 'variable', key = 'remaining_hand_money', vars = {G.GAME.modifiers.money_per_hand or 1}}}, colours = {G.C.UI.TEXT_LIGHT}, shadow = true, pop_in = 0, scale = 0.4*scale, silent = true})}})
                elseif config.name == 'discards' then
                    table.insert(left_text, {n=G.UIT.T, config={text = config.disp or config.dollars, scale = 0.8*scale, colour = G.C.RED, shadow = true, juice = true}})
                    table.insert(left_text, {n=G.UIT.O, config={object = DynaText({string = {" "..localize{type = 'variable', key = 'remaining_discard_money', vars = {G.GAME.modifiers.money_per_discard or 0}}}, colours = {G.C.UI.TEXT_LIGHT}, shadow = true, pop_in = 0, scale = 0.4*scale, silent = true})}})
                elseif string.find(config.name, 'joker') then
                    table.insert(left_text, {n=G.UIT.O, config={object = DynaText({string = localize{type = 'name_text', set = config.card.config.center.set, key = config.card.config.center.key}, colours = {G.C.FILTER}, shadow = true, pop_in = 0, scale = 0.6*scale, silent = true})}})
                elseif config.name == 'interest' then
                    table.insert(left_text, {n=G.UIT.T, config={text = num_dollars, scale = 0.8*scale, colour = G.C.MONEY, shadow = true, juice = true}})
                    table.insert(left_text,{n=G.UIT.O, config={object = DynaText({string = {" "..localize{type = 'variable', key = 'interest', vars = {G.GAME.interest_amount, 5, G.GAME.interest_amount*G.GAME.interest_cap/5}}}, colours = {G.C.UI.TEXT_LIGHT}, shadow = true, pop_in = 0, scale = 0.4*scale, silent = true})}})
                end
                local full_row = {n=G.UIT.R, config={align = "cm", minw = 5}, nodes={
                    {n=G.UIT.C, config={padding = 0.05, minw = width*0.55, minh = 0.61, align = "cl"}, nodes=left_text},
                    {n=G.UIT.C, config={padding = 0.05,minw = width*0.45, align = "cr"}, nodes={{n=G.UIT.C, config={align = "cm", id = 'dollar_'..config.name},nodes={}}}}
                }}
        
                if config.name == 'blind1' then
                    G.GAME.blind:juice_up()
                end
                G.round_eval:add_child(full_row,G.round_eval:get_UIE_by_ID(config.bonus and 'bonus_round_eval' or 'base_round_eval'))
                play_sound('cancel', config.pitch or 1)
                play_sound('highlight1',( 1.5*config.pitch) or 1, 0.2)
                if config.card then config.card:juice_up(0.7, 0.46) end
                return true
            end
        }))
        local dollar_row = 0
        if num_dollars > 60 then 
            local dollar_string = localize('$')..num_dollars
            G.E_MANAGER:add_event(Event({
                trigger = 'before',delay = 0.38,
                func = function()
                    G.round_eval:add_child(
                            {n=G.UIT.R, config={align = "cm", id = 'dollar_row_'..(dollar_row+1)..'_'..config.name}, nodes={
                                {n=G.UIT.O, config={object = DynaText({string = {localize('$')..num_dollars}, colours = {G.C.MONEY}, shadow = true, pop_in = 0, scale = 0.65, float = true})}}
                            }},
                            G.round_eval:get_UIE_by_ID('dollar_'..config.name))

                    play_sound('coin3', 0.9+0.2*math.random(), 0.7)
                    play_sound('coin6', 1.3, 0.8)
                    return true
                end
            }))
        else
            for i = 1, num_dollars or 1 do
                G.E_MANAGER:add_event(Event({
                    trigger = 'before',delay = 0.18 - ((num_dollars > 20 and 0.13) or (num_dollars > 9 and 0.1) or 0),
                    func = function()
                        if i%30 == 1 then 
                            G.round_eval:add_child(
                                {n=G.UIT.R, config={align = "cm", id = 'dollar_row_'..(dollar_row+1)..'_'..config.name}, nodes={}},
                                G.round_eval:get_UIE_by_ID('dollar_'..config.name))
                                dollar_row = dollar_row+1
                        end

                        local r = {n=G.UIT.T, config={text = localize('$'), colour = G.C.MONEY, scale = ((num_dollars > 20 and 0.28) or (num_dollars > 9 and 0.43) or 0.58), shadow = true, hover = true, can_collide = false, juice = true}}
                        play_sound('coin3', 0.9+0.2*math.random(), 0.7 - (num_dollars > 20 and 0.2 or 0))
                        
                        if config.name == 'blind1' then 
                            G.GAME.current_round.dollars_to_be_earned = G.GAME.current_round.dollars_to_be_earned:sub(2)
                        end

                        G.round_eval:add_child(r,G.round_eval:get_UIE_by_ID('dollar_row_'..(dollar_row)..'_'..config.name))
                        G.VIBRATION = G.VIBRATION + 0.4
                        return true
                    end
                }))
            end
        end
    else
        delay(0.4)
        G.E_MANAGER:add_event(Event({
            trigger = 'before',delay = 0.5,
            func = function()
                UIBox{
                    definition = {n=G.UIT.ROOT, config={align = 'cm', colour = G.C.CLEAR}, nodes={
                        {n=G.UIT.R, config={id = 'cash_out_button', align = "cm", padding = 0.1, minw = 7, r = 0.15, colour = G.C.ORANGE, shadow = true, hover = true, one_press = true, button = 'cash_out', focus_args = {snap_to = true}}, nodes={
                            {n=G.UIT.T, config={text = localize('b_cash_out')..": ", scale = 1, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                            {n=G.UIT.T, config={text = localize('$')..config.dollars, scale = 1.2*scale, colour = G.C.WHITE, shadow = true, juice = true}}
                    }},}},
                    config = {
                      align = 'tmi',
                      offset ={x=0,y=0.4},
                      major = G.round_eval}
                }

                --local left_text = {n=G.UIT.R, config={id = 'cash_out_button', align = "cm", padding = 0.1, minw = 2, r = 0.15, colour = G.C.ORANGE, shadow = true, hover = true, one_press = true, button = 'cash_out', focus_args = {snap_to = true}}, nodes={
                --    {n=G.UIT.T, config={text = localize('b_cash_out')..": ", scale = 1, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                --    {n=G.UIT.T, config={text = localize('$')..config.dollars, scale = 1.3*scale, colour = G.C.WHITE, shadow = true, juice = true}}
                --}}
                --G.round_eval:add_child(left_text,G.round_eval:get_UIE_by_ID('eval_bottom'))

                G.GAME.current_round.dollars = config.dollars
                
                play_sound('coin6', config.pitch or 1)
                G.VIBRATION = G.VIBRATION + 1
                return true
            end
        }))
    end
end

function change_shop_size(mod)
    if not G.GAME.shop then return end
    G.GAME.shop.joker_max = G.GAME.shop.joker_max + mod
    if G.shop_jokers and G.shop_jokers.cards then
        if mod < 0 then
            --Remove jokers in shop
            for i = #G.shop_jokers.cards, G.GAME.shop.joker_max+1, -1 do
                if G.shop_jokers.cards[i] then
                    G.shop_jokers.cards[i]:remove()
                end
            end
        end
        G.shop_jokers.config.card_limit = G.GAME.shop.joker_max
        G.shop_jokers.T.w = G.GAME.shop.joker_max*1.01*G.CARD_W
        G.shop:recalculate()
        if mod > 0 then
            for i = 1, G.GAME.shop.joker_max - #G.shop_jokers.cards do
                G.shop_jokers:emplace(create_card_for_shop(G.shop_jokers))
            end
        end
    end
end

function juice_card(card)
    G.E_MANAGER:add_event(Event({
        trigger = 'immediate',
        func = (function() card:juice_up(0.7);return true end)
    }))
end

function update_canvas_juice(dt)
    G.JIGGLE_VIBRATION = G.ROOM.jiggle or 0
    if not G.SETTINGS.screenshake or (type(G.SETTINGS.screenshake) ~= 'number') then
        G.SETTINGS.screenshake = G.SETTINGS.reduced_motion and 0 or 50
    end
    local shake_amt = (G.SETTINGS.reduced_motion and 0 or 1)*math.max(0,G.SETTINGS.screenshake-30)/100
    G.ARGS.eased_cursor_pos = G.ARGS.eased_cursor_pos or {x=G.CURSOR.T.x,y=G.CURSOR.T.y, sx = G.CONTROLLER.cursor_position.x, sy = G.CONTROLLER.cursor_position.y}
    G.ARGS.eased_cursor_pos.x = G.ARGS.eased_cursor_pos.x*(1-3*dt) + 3*dt*(shake_amt*G.CURSOR.T.x + (1-shake_amt)*G.ROOM.T.w/2)
    G.ARGS.eased_cursor_pos.y = G.ARGS.eased_cursor_pos.y*(1-3*dt) + 3*dt*(shake_amt*G.CURSOR.T.y + (1-shake_amt)*G.ROOM.T.h/2)
    G.ARGS.eased_cursor_pos.sx = G.ARGS.eased_cursor_pos.sx*(1-3*dt) + 3*dt*(shake_amt*G.CONTROLLER.cursor_position.x + (1-shake_amt)*G.WINDOWTRANS.real_window_w/2)
    G.ARGS.eased_cursor_pos.sy = G.ARGS.eased_cursor_pos.sy*(1-3*dt) + 3*dt*(shake_amt*G.CONTROLLER.cursor_position.y + (1-shake_amt)*G.WINDOWTRANS.real_window_h/2)

    shake_amt = (G.SETTINGS.reduced_motion and 0 or 1)*G.SETTINGS.screenshake/100*3
    if shake_amt < 0.05 then shake_amt = 0 end

    G.ROOM.jiggle = (G.ROOM.jiggle or 0)*(1-5*dt)*(shake_amt > 0.05 and 1 or 0)
    G.ROOM.T.r = (0.001*math.sin(0.3*G.TIMERS.REAL)+ 0.002*(G.ROOM.jiggle)*math.sin(39.913*G.TIMERS.REAL))*shake_amt
    G.ROOM.T.x = G.ROOM_ORIG.x + (shake_amt)*(0.015*math.sin(0.913*G.TIMERS.REAL)  + 0.01*(G.ROOM.jiggle*shake_amt)*math.sin(19.913*G.TIMERS.REAL) + (G.ARGS.eased_cursor_pos.x - 0.5*(G.ROOM.T.w + G.ROOM_ORIG.x))*0.01)
    G.ROOM.T.y = G.ROOM_ORIG.y + (shake_amt)*(0.015*math.sin(0.952*G.TIMERS.REAL)  + 0.01*(G.ROOM.jiggle*shake_amt)*math.sin(21.913*G.TIMERS.REAL) + (G.ARGS.eased_cursor_pos.y - 0.5*(G.ROOM.T.h + G.ROOM_ORIG.y))*0.01)

    G.JIGGLE_VIBRATION = G.JIGGLE_VIBRATION*(1-5*dt)
    G.CURR_VIBRATION = G.CURR_VIBRATION or 0
    G.CURR_VIBRATION = math.min(1, G.CURR_VIBRATION + G.VIBRATION + G.JIGGLE_VIBRATION*0.2)
    G.VIBRATION = 0
    G.CURR_VIBRATION = (1-15*dt)*G.CURR_VIBRATION
    if not G.SETTINGS.rumble then G.CURR_VIBRATION = 0 end
    if G.CONTROLLER.GAMEPAD.object and G.F_RUMBLE then G.CONTROLLER.GAMEPAD.object:setVibration(G.CURR_VIBRATION*0.4*G.F_RUMBLE, G.CURR_VIBRATION*0.4*G.F_RUMBLE) end
end

function juice_card_until(card, eval_func, first, delay)
    G.E_MANAGER:add_event(Event({
        trigger = 'after',delay = delay or 0.1, blocking = false, blockable = false, timer = 'REAL',
        func = (function() if eval_func(card) then if not first or first then card:juice_up(0.1, 0.1) end;juice_card_until(card, eval_func, nil, 0.8) end return true end)
    }))
end

function check_for_unlock(args)
    if not next(args) then return end
    if G.GAME.seeded then return end
    if args.type == 'win_challenge' then 
        unlock_achievement('rule_bender')
        local _c = true
        for k, v in pairs(G.CHALLENGES) do
            if not G.PROFILES[G.SETTINGS.profile].challenge_progress.completed[v.id] then
                _c = false
            end
        end
        if _c then 
            unlock_achievement('rule_breaker')
        end
    end
    if G.GAME.challenge then return end

    --|--------------------------------------------
    --|Achievements
    --|--------------------------------------------
    if args.type == 'career_stat' then
        if args.statname == 'c_cards_played' and G.PROFILES[G.SETTINGS.profile].career_stats[args.statname] >= 2500 then
            unlock_achievement('card_player')
        end
        if args.statname == 'c_cards_discarded' and G.PROFILES[G.SETTINGS.profile].career_stats[args.statname] >= 2500 then
            unlock_achievement('card_discarder')
        end
    end
    if args.type == 'ante_up' then
        if args.ante >= 4 then
            unlock_achievement('ante_up')
        end
        if args.ante >= 8 then
            unlock_achievement('ante_upper')
        end
    end
    if args.type == 'win' then
        unlock_achievement('heads_up')
        if G.GAME.round <= 12 then
            unlock_achievement('speedrunner')
        end
        if G.GAME.round_scores.times_rerolled.amt <= 0 then 
            unlock_achievement('you_get_what_you_get')
        end
    end
    if args.type == 'win_stake' then 
        local highest_win, lowest_win = get_deck_win_stake(nil)
        if highest_win >= 2 then 
            unlock_achievement('low_stakes')
        end
        if highest_win >= 4 then 
            unlock_achievement('mid_stakes')
        end
        if highest_win >= 8 then 
            unlock_achievement('high_stakes')
        end
        if G.PROGRESS and G.PROGRESS.deck_stakes.tally/G.PROGRESS.deck_stakes.of >=1 then 
            unlock_achievement('completionist_plus')
        end
        if G.PROGRESS and G.PROGRESS.joker_stickers.tally/G.PROGRESS.joker_stickers.of >=1 then
            unlock_achievement('completionist_plus_plus')
        end
    end
    if args.type == 'money' then
        if G.GAME.dollars >= 400 then
            unlock_achievement('nest_egg')
        end
    end
    if args.type == 'hand' then
        if args.handname == 'Flush' and args.scoring_hand then
            local _w = 0
            for k, v in ipairs(args.scoring_hand) do
                if v.ability.name == 'Wild Card' then
                    _w = _w + 1
                end
            end
            if _w == #args.scoring_hand then
                unlock_achievement('flushed')
            end
        end

        if args.disp_text == 'Royal Flush' then 
            unlock_achievement('royale')
        end
    end
    if args.type == 'shatter' then 
        if #args.shattered >= 2 then 
            unlock_achievement('shattered')
        end
    end
    if args.type == 'run_redeem' then 
        local _v = 0
        _v = _v - (G.GAME.starting_voucher_count or 0)
        for k, v in pairs(G.GAME.used_vouchers) do
            _v = _v + 1
        end
        if _v >= 5 and G.GAME.round_resets.ante <= 4 then
            unlock_achievement('roi')
        end
    end
    if args.type == 'upgrade_hand' then
        if args.level >= 10 then
            unlock_achievement('retrograde')
        end
    end
    if args.type == 'chip_score' then
        if args.chips >= 10000 then
            unlock_achievement('_10k')
        end
        if args.chips >= 1000000 then
            unlock_achievement('_1000k')
        end
        if args.chips >= 100000000 then
            unlock_achievement('_100000k')
        end
    end
    if args.type == 'modify_deck' then
        if G.deck and G.deck.config.card_limit <= 20 then
            unlock_achievement('tiny_hands')
        end
        if G.deck and G.deck.config.card_limit >= 80 then
            unlock_achievement('big_hands')
        end
    end
    if args.type == 'spawn_legendary' then
        unlock_achievement('legendary')
    end
    if args.type == 'discover_amount' then
        if G.DISCOVER_TALLIES.vouchers.tally/G.DISCOVER_TALLIES.vouchers.of >=1 then 
            unlock_achievement('extreme_couponer')
        end
        if G.DISCOVER_TALLIES.spectrals.tally/G.DISCOVER_TALLIES.spectrals.of >=1 then 
            unlock_achievement('clairvoyance')
        end
        if G.DISCOVER_TALLIES.tarots.tally/G.DISCOVER_TALLIES.tarots.of >=1 then 
            unlock_achievement('cartomancy')
        end
        if G.DISCOVER_TALLIES.planets.tally/G.DISCOVER_TALLIES.planets.of >=1 then 
            unlock_achievement('astronomy')
        end
        if G.DISCOVER_TALLIES.total.tally/G.DISCOVER_TALLIES.total.of >=1 then 
            unlock_achievement('completionist')
        end
    end
    ---------------------------------------------

    local i=1
    while i <= #G.P_LOCKED do
        local ret = false
        local card = G.P_LOCKED[i]
        if not card.unlocked and card.unlock_condition and args.type == 'career_stat' then
            if args.statname == card.unlock_condition.type and G.PROFILES[G.SETTINGS.profile].career_stats[args.statname] >= card.unlock_condition.extra then
                ret = true
                unlock_card(card)
            end
        end

        if not card.unlocked and card.unlock_condition and card.unlock_condition.type == args.type then
            if args.type == 'hand' and args.handname == card.unlock_condition.extra then
                ret = true
                unlock_card(card)
            end
            if args.type == 'min_hand_size' and G.hand and G.hand.config.card_limit <= card.unlock_condition.extra then
                ret = true
                unlock_card(card)
            end
            if args.type == 'interest_streak' and card.unlock_condition.extra <= G.PROFILES[G.SETTINGS.profile].career_stats.c_round_interest_cap_streak then
                ret = true
                unlock_card(card)
            end
            if args.type == 'run_card_replays' then
                for k, v in ipairs(G.playing_cards) do
                    if v.base.times_played >= card.unlock_condition.extra then 
                        ret = true
                        unlock_card(card)
                        break
                    end
                end
            end
            if args.type == 'play_all_hearts' then
                local played = true
                for k, v in ipairs(G.deck.cards) do
                    if v.ability.name ~= 'Stone Card' and v.base.suit == 'Hearts' then 
                        played = false
                    end
                end
                for k, v in ipairs(G.hand.cards) do
                    if v.ability.name ~= 'Stone Card' and v.base.suit == 'Hearts' then 
                        played = false
                    end
                end
                if played then
                    ret = true
                    unlock_card(card)
                end
            end
            if args.type == 'run_redeem' then
                local vouchers_redeemed = 0
                for k, v in pairs(G.GAME.used_vouchers) do
                    vouchers_redeemed = vouchers_redeemed + 1
                end
                if vouchers_redeemed >= card.unlock_condition.extra then
                    ret = true
                    unlock_card(card)
                end
            end
            if args.type == 'have_edition' then
                local shiny_jokers = 0
                for k, v in ipairs(G.jokers.cards) do
                    if v.edition then shiny_jokers = shiny_jokers + 1 end
                end
                if shiny_jokers >= card.unlock_condition.extra then
                    ret = true
                    unlock_card(card)
                end
            end
            if args.type == 'double_gold' then
                ret = true
                unlock_card(card)
            end
            if args.type == 'continue_game' then
                ret = true
                unlock_card(card)
            end
            if args.type == 'blank_redeems' then
                if G.PROFILES[G.SETTINGS.profile].voucher_usage['v_blank'] and G.PROFILES[G.SETTINGS.profile].voucher_usage['v_blank'].count >= card.unlock_condition.extra then
                    unlock_card(card)
                end
            end
            if args.type == 'modify_deck' then
                if card.unlock_condition.extra and card.unlock_condition.extra.suit then
                    local count = 0
                    for _, v in pairs(G.playing_cards) do
                        if v.base.suit == card.unlock_condition.extra.suit then count = count + 1 end
                    end
                    if count >= card.unlock_condition.extra.count then
                        ret = true
                        unlock_card(card)
                    end
                end
                if card.unlock_condition.extra and card.unlock_condition.extra.enhancement then
                    local count = 0
                    for _, v in pairs(G.playing_cards) do
                        if v.ability.name == card.unlock_condition.extra.enhancement then count = count + 1 end
                    end
                    if count >= card.unlock_condition.extra.count then
                        ret = true
                        unlock_card(card)
                    end
                end
                if card.unlock_condition.extra and card.unlock_condition.extra.tally then
                    local count = 0
                    for _, v in pairs(G.playing_cards) do
                        if v.ability.set == 'Enhanced' then count = count + 1 end
                    end
                    if count >= card.unlock_condition.extra.count then
                        ret = true
                        unlock_card(card)
                    end
                end
            end
            if args.type == 'discover_amount' then
                if card.unlock_condition.amount then 
                    if card.unlock_condition.amount <= args.amount then
                        ret = true
                        unlock_card(card)
                    end
                end
                if card.unlock_condition.tarot_count then 
                    if card.unlock_condition.tarot_count <= args.tarot_count then
                        ret = true
                        unlock_card(card)
                    end
                end
                if card.unlock_condition.planet_count then 
                    if card.unlock_condition.planet_count <= args.planet_count then
                        ret = true
                        unlock_card(card)
                    end
                end
            end
            if args.type == 'win_deck' then
                if card.unlock_condition.deck then
                    if get_deck_win_stake(card.unlock_condition.deck) > 0 then
                        ret = true
                        unlock_card(card)
                    end
                end
            end
            if args.type == 'win_stake' then 
                if card.unlock_condition.stake then
                    if get_deck_win_stake() >= card.unlock_condition.stake then
                        ret = true
                        unlock_card(card)
                    end
                end
            end
            if args.type == 'discover_planets' then
                local count = 0
                for k, v in pairs(G.P_CENTERS) do
                    if v.set == 'Planet' and v.discovered then count = count + 1 end
                end
                if count >= 9 then
                    ret = true
                    unlock_card(card)   
                end
            end
            if args.type == 'blind_discoveries' then
                local discovered_blinds = 0
                for k, v in pairs(G.P_BLINDS) do
                    if v.discovered then 
                        discovered_blinds = discovered_blinds + 1
                    end
                end
                if discovered_blinds >= card.unlock_condition.extra then 
                    ret = true
                    unlock_card(card)
                end
            end
            if args.type == 'modify_jokers' and G.jokers then
                if card.unlock_condition.extra.count then
                    local count = 0
                    for _, v in pairs(G.jokers.cards) do
                        if v.ability.set == 'Joker' and v.edition and v.edition.polychrome and card.unlock_condition.extra.polychrome then count = count + 1 end
                    end
                    if count >= card.unlock_condition.extra.count then
                        ret = true
                        unlock_card(card)
                    end
                end
            end
            if args.type == 'money' then
                if card.unlock_condition.extra <= G.GAME.dollars then
                    ret = true
                    unlock_card(card)   
                end
            end
            if args.type == 'round_win' then
                if card.name == 'Matador' then
                    if G.GAME.current_round.hands_played == 1 and
                        G.GAME.current_round.discards_left == G.GAME.round_resets.discards and
                        G.GAME.blind:get_type() == 'Boss' then
                        ret = true
                        unlock_card(card)   
                    end
                end
                if card.name == 'Troubadour' then
                    if G.PROFILES[G.SETTINGS.profile].career_stats.c_single_hand_round_streak >= card.unlock_condition.extra then
                        ret = true
                        unlock_card(card)   
                    end
                end
                if card.name == 'Hanging Chad' then
                    if G.GAME.last_hand_played == card.unlock_condition.extra and G.GAME.blind:get_type() == 'Boss' then
                        ret = true
                        unlock_card(card)   
                    end
                end
            end
            if args.type == 'ante_up' then
                if card.unlock_condition.ante then
                    if args.ante == card.unlock_condition.ante then
                        ret = true
                        unlock_card(card)   
                    end
                end
            end
            if args.type == 'hand_contents' then
                if card.name == 'Seeing Double' then
                    local tally = 0
                    for j = 1, #args.cards do
                        if args.cards[j]:get_id() == 7 and args.cards[j]:is_suit('Clubs') then
                            tally = tally+1
                        end
                    end
                    if tally >= 4 then 
                        ret = true
                        unlock_card(card)
                    end
                end
                
                if card.name == 'Golden Ticket' then 
                    local tally = 0
                    for j = 1, #args.cards do
                        if args.cards[j].ability.name == 'Gold Card' then
                            tally = tally+1
                        end
                    end
                    if tally >= 5 then 
                        ret = true
                        unlock_card(card)
                    end
                end
            end
            if args.type == 'discard_custom' then
                if card.name == 'Hit the Road' then 
                    local tally = 0
                    for j = 1, #args.cards do
                        if args.cards[j]:get_id() == 11 then
                            tally = tally+1
                        end
                    end
                    if tally >= 5 then 
                        ret = true
                        unlock_card(card)
                    end
                end
                if card.name == 'Brainstorm' then 
                    local eval = evaluate_poker_hand(args.cards)
                    if next(eval['Straight Flush']) then
                        local min = 10
                        for j = 1, #args.cards do
                            if args.cards[j]:get_id() < min then min = args.cards[j]:get_id() end
                        end
                        if min == 10 then 
                            ret = true
                            unlock_card(card)
                        end
                    end
                end
            end
            if args.type == 'win_no_hand' and G.GAME.hands[card.unlock_condition.extra].played == 0 then
                ret = true
                unlock_card(card)
            end
            if args.type == 'win_custom' then
                if card.name == 'Invisible Joker'  and
                    G.GAME.max_jokers <= 4 then
                    ret = true
                    unlock_card(card)
                end
                if card.name == 'Blueprint' then
                    ret = true
                    unlock_card(card)
                end
            end
            if args.type == 'win' then
                if card.unlock_condition.n_rounds >= G.GAME.round then
                    ret = true
                    unlock_card(card)
                end
            end
            if args.type == 'chip_score' then
                if card.unlock_condition.chips <= args.chips then
                    ret = true
                    G.E_MANAGER:add_event(Event({
                        func = function()
                            G.E_MANAGER:add_event(Event({
                                func = function()
                                    unlock_card(card)
                                return true end
                            }))
                        return true end
                    }))
                end
            end
        end
        if ret == true then
            table.remove(G.P_LOCKED, i)
        else
            i = i + 1
        end
    end
end

function unlock_card(card)
    if card.unlocked == false then
        if G.GAME.seeded or G.GAME.challenge then return end
        if card.unlocked or card.wip then return end
        G:save_notify(card)
        card.unlocked = true
        if card.set == 'Back' then discover_card(card) end
        table.sort(G.P_CENTER_POOLS["Back"], function (a, b) return (a.order - (a.unlocked and 100 or 0)) < (b.order - (b.unlocked and 100 or 0)) end)
        G:save_progress()
        G.FILE_HANDLER.force = true
        notify_alert(card.key, card.set)
    end
end

function fetch_achievements()
    G.ACHIEVEMENTS = G.ACHIEVEMENTS or {
        ante_up =               {order = 1,    tier = 3, earned = false, steamid = "BAL_01"}, 
        ante_upper =            {order = 2,    tier = 3, earned = false, steamid = "BAL_02"}, 
        heads_up =              {order = 3,    tier = 2, earned = false, steamid = "BAL_03"}, 
        low_stakes =            {order = 4,    tier = 2, earned = false, steamid = "BAL_04"}, 
        mid_stakes =            {order = 5,    tier = 2, earned = false, steamid = "BAL_05"}, 
        high_stakes =           {order = 6,    tier = 2, earned = false, steamid = "BAL_06"}, 
        card_player =           {order = 7,    tier = 3, earned = false, steamid = "BAL_07"}, 
        card_discarder =        {order = 8,    tier = 3, earned = false, steamid = "BAL_08"}, 
        nest_egg =              {order = 9,    tier = 2, earned = false, steamid = "BAL_09"}, 
        flushed =               {order = 10,   tier = 3, earned = false, steamid = "BAL_10"}, 
        speedrunner =           {order = 11,   tier = 2, earned = false, steamid = "BAL_11"}, 
        roi =                   {order = 12,   tier = 3, earned = false, steamid = "BAL_12"}, 
        shattered =             {order = 13,   tier = 3, earned = false, steamid = "BAL_13"}, 
        royale =                {order = 14,   tier = 3, earned = false, steamid = "BAL_14"}, 
        retrograde =            {order = 15,   tier = 2, earned = false, steamid = "BAL_15"}, 
        _10k =                  {order = 16,   tier = 3, earned = false, steamid = "BAL_16"}, 
        _1000k =                {order = 17,   tier = 2, earned = false, steamid = "BAL_17"}, 
        _100000k =              {order = 18,   tier = 1, earned = false, steamid = "BAL_18"}, 
        tiny_hands =            {order = 19,   tier = 2, earned = false, steamid = "BAL_19"}, 
        big_hands =             {order = 20,   tier = 2, earned = false, steamid = "BAL_20"}, 
        you_get_what_you_get =  {order = 21,   tier = 3, earned = false, steamid = "BAL_21"}, 
        rule_bender =           {order = 22,   tier = 3, earned = false, steamid = "BAL_22"}, 
        rule_breaker =          {order = 23,   tier = 1, earned = false, steamid = "BAL_23"}, 
        legendary =             {order = 24,   tier = 3, earned = false, steamid = "BAL_24"}, 
        astronomy =             {order = 25,   tier = 3, earned = false, steamid = "BAL_25"}, 
        cartomancy =            {order = 26,   tier = 3, earned = false, steamid = "BAL_26"}, 
        clairvoyance =          {order = 27,   tier = 2, earned = false, steamid = "BAL_27"}, 
        extreme_couponer =      {order = 28,   tier = 1, earned = false, steamid = "BAL_28"}, 
        completionist =         {order = 29,   tier = 1, earned = false, steamid = "BAL_29"}, 
        completionist_plus =    {order = 30,   tier = 1, earned = false, steamid = "BAL_30"}, 
        completionist_plus_plus={order = 31,   tier = 1, earned = false, steamid = "BAL_31"},
    }

    if G.F_NO_ACHIEVEMENTS then return end

    --|FROM LOCAL SETTINGS FILE
    --|-------------------------------------------------------
    if not G.STEAM then --|set this to false if you get this information from elsewhere
        G.SETTINGS.ACHIEVEMENTS_EARNED = G.SETTINGS.ACHIEVEMENTS_EARNED or {}
        for k, v in pairs(G.SETTINGS.ACHIEVEMENTS_EARNED) do
            if G.ACHIEVEMENTS[k] then
                G.ACHIEVEMENTS[k].earned = true
            end
        end
    end
    --|-------------------------------------------------------

    --|STEAM ACHIEVEMENTS
    --|-------------------------------------------------------
    if G.STEAM and not G.STEAM.initial_fetch then 
        for k, v in pairs(G.ACHIEVEMENTS) do
            local achievement_name = v.steamid
            local success, achieved = G.STEAM.userStats.getAchievement(achievement_name)
            if success then 
                v.earned = not not achieved
            end
        end
        G.STEAM.initial_fetch = true
    end
    --|-------------------------------------------------------

    --|Other platforms
    --|-------------------------------------------------------

    --|-------------------------------------------------------
end

function unlock_achievement(achievement_name)
    if G.PROFILES[G.SETTINGS.profile].all_unlocked then return end
    G.E_MANAGER:add_event(Event({
        no_delete = true,
        blockable = false,
        blocking = false,
        func = function()
            if G.STATE ~= G.STATES.HAND_PLAYED then 
                if G.PROFILES[G.SETTINGS.profile].all_unlocked then return end
                local achievement_set = false
                if G.F_NO_ACHIEVEMENTS then return end

                --|LOCAL SETTINGS FILE
                --|-------------------------------------------------------
                if not G.ACHIEVEMENTS then fetch_achievements() end

                G.SETTINGS.ACHIEVEMENTS_EARNED[achievement_name] = true
                G:save_progress()
                if G.ACHIEVEMENTS[achievement_name] and not G.STEAM then 
                    if not G.ACHIEVEMENTS[achievement_name].earned then
                        --|THIS IS THE FIRST TIME THIS ACHIEVEMENT HAS BEEN EARNED
                        achievement_set = true
                        G.FILE_HANDLER.force = true
                    end
                    G.ACHIEVEMENTS[achievement_name].earned = true
                end
                --|-------------------------------------------------------


                --|STEAM ACHIEVEMENTS
                --|-------------------------------------------------------
                if G.STEAM then 
                    if G.ACHIEVEMENTS[achievement_name] then 
                        if not G.ACHIEVEMENTS[achievement_name].earned then
                            --|THIS IS THE FIRST TIME THIS ACHIEVEMENT HAS BEEN EARNED
                            achievement_set = true
                            G.FILE_HANDLER.force = true
                            local achievement_code = G.ACHIEVEMENTS[achievement_name].steamid
                            local success, achieved = G.STEAM.userStats.getAchievement(achievement_code)
                            if not success or not achieved then
                                G.STEAM.send_control.update_queued = true
                                G.STEAM.userStats.setAchievement(achievement_code)
                            end
                        end
                        G.ACHIEVEMENTS[achievement_name].earned = true
                    end
                end
                --|-------------------------------------------------------

                --|Other platforms
                --|-------------------------------------------------------

                --|-------------------------------------------------------

                if achievement_set then notify_alert(achievement_name) end
                return true
            end
        end
        }), 'achievement')
end

function notify_alert(_achievement, _type)
    _type = _type or 'achievement'
    G.E_MANAGER:add_event(Event({
      no_delete = true,
      pause_force = true,
      timer = 'UPTIME',
      func = function()
        if G.achievement_notification then
            G.achievement_notification:remove()
            G.achievement_notification = nil
        end
        G.achievement_notification = G.achievement_notification or UIBox{
            definition = create_UIBox_notify_alert(_achievement, _type),
            config = {align='cr', offset = {x=20,y=0},major = G.ROOM_ATTACH, bond = 'Weak'}
        }
        return true
      end
    }), 'achievement')
    G.E_MANAGER:add_event(Event({
        no_delete = true,
        trigger = 'after',
        pause_force = true,
        timer = 'UPTIME',
        delay = 0.1,
        func = function()
            G.achievement_notification.alignment.offset.x = G.ROOM.T.x - G.achievement_notification.UIRoot.children[1].children[1].T.w - 0.8
          return true
        end
    }), 'achievement')
    G.E_MANAGER:add_event(Event({
        no_delete = true,
        pause_force = true,
        trigger = 'after',
        timer = 'UPTIME',
        delay = 0.1,
        func = function()
            play_sound('highlight1', nil, 0.5)
            play_sound('foil2', 0.5, 0.4)
          return true
        end
    }), 'achievement')
    G.E_MANAGER:add_event(Event({
      no_delete = true,
      pause_force = true,
      trigger = 'after',
      delay = 3,
      timer = 'UPTIME',
      func = function()
        G.achievement_notification.alignment.offset.x = 20
        return true
      end
    }), 'achievement')
    G.E_MANAGER:add_event(Event({
        no_delete = true,
        pause_force = true,
        trigger = 'after',
        delay = 0.5,
        timer = 'UPTIME',
        func = function()
            if G.achievement_notification then
                G.achievement_notification:remove()
                G.achievement_notification = nil
            end
          return true
        end
    }), 'achievement')
end

function inc_steam_stat(stat_name)
    if not G.STEAM then return end
    local success, current_stat = G.STEAM.userStats.getStatInt(stat_name)
    if success then
        G.STEAM.userStats.setStatInt(stat_name, current_stat+1)
        G.STEAM.send_control.update_queued = true
    end
end

function unlock_notify()
    local _UN = get_compressed(G.SETTINGS.profile..'/'..'unlock_notify.jkr')
    if _UN then 
        for key in string.gmatch(_UN .. "\n", "(.-)\n") do
            create_unlock_overlay(key)
        end
        love.filesystem.remove(G.SETTINGS.profile..'/'..'unlock_notify.jkr')
    end
end

function create_unlock_overlay(key)
    if G.P_CENTERS[key] then 
        G.E_MANAGER:add_event(Event({
            trigger = 'immediate',
            no_delete = true,
            func = (function()
                if not G.OVERLAY_MENU then 
                    G.SETTINGS.paused = true
                    G.FUNCS.overlay_menu{
                        definition = G.P_CENTERS[key].set == 'Back' and create_UIBox_deck_unlock(G.P_CENTERS[key]) or create_UIBox_card_unlock(G.P_CENTERS[key]),
                    }
                    play_sound('foil1', 0.7, 0.3)
                    play_sound('gong', 1.4, 0.15)
                    return true
                end
            end)
        }), 'unlock')
    end
end

function discover_card(card)
    if G.GAME.seeded or G.GAME.challenge then return end
    card = card or {}
    if card.discovered or card.wip then return end
    if card and not card.discovered then
        card.alert = true
        G.GAME.round_scores.new_collection.amt = G.GAME.round_scores.new_collection.amt+1
    end
    card.discovered = true
    set_discover_tallies()
    G.E_MANAGER:add_event(Event({
        func = (function()
            G:save_progress()
    return true end)}))
end

function get_deck_from_name(_name)
    for k, v in pairs(G.P_CENTERS) do
        if v.name == _name then return v end
    end
end

function get_next_voucher_key(_from_tag)
    local _pool, _pool_key = get_current_pool('Voucher')
    if _from_tag then _pool_key = 'Voucher_fromtag' end
    local center = pseudorandom_element(_pool, pseudoseed(_pool_key))
    local it = 1
    while center == 'UNAVAILABLE' do
        it = it + 1
        center = pseudorandom_element(_pool, pseudoseed(_pool_key..'_resample'..it))
    end

    return center
end

function get_next_tag_key(append)
    if G.FORCE_TAG then return G.FORCE_TAG end
    local _pool, _pool_key = get_current_pool('Tag', nil, nil, append)
    local _tag = pseudorandom_element(_pool, pseudoseed(_pool_key))
    local it = 1
    while _tag == 'UNAVAILABLE' do
        it = it + 1
        _tag = pseudorandom_element(_pool, pseudoseed(_pool_key..'_resample'..it))
    end

    return _tag
end

function create_playing_card(card_init, area, skip_materialize, silent, colours)
    card_init = card_init or {}
    card_init.front = card_init.front or pseudorandom_element(G.P_CARDS, pseudoseed('front'))
    card_init.center = card_init.center or G.P_CENTERS.c_base

    G.playing_card = (G.playing_card and G.playing_card + 1) or 1
    local _area = area or G.hand
    local card = Card(_area.T.x, _area.T.y, G.CARD_W, G.CARD_H, card_init.front, card_init.center, {playing_card = G.playing_card})
    table.insert(G.playing_cards, card)
    card.playing_card = G.playing_card

    if area then area:emplace(card) end
    if not skip_materialize then card:start_materialize(colours, silent) end

    return card
end

function get_pack(_key, _type)
    if not G.GAME.first_shop_buffoon and not G.GAME.banned_keys['p_buffoon_normal_1'] then
        G.GAME.first_shop_buffoon = true
        return G.P_CENTERS['p_buffoon_normal_'..(math.random(1, 2))]
    end
    local cume, it, center = 0, 0, nil
    for k, v in ipairs(G.P_CENTER_POOLS['Booster']) do
        if (not _type or _type == v.kind) and not G.GAME.banned_keys[v.key] then cume = cume + (v.weight or 1 ) end
    end
    local poll = pseudorandom(pseudoseed((_key or 'pack_generic')..G.GAME.round_resets.ante))*cume
    for k, v in ipairs(G.P_CENTER_POOLS['Booster']) do
        if not G.GAME.banned_keys[v.key] then 
            if not _type or _type == v.kind then it = it + (v.weight or 1) end
            if it >= poll and it - (v.weight or 1) <= poll then center = v; break end
        end
    end
    return center
end

function get_current_pool(_type, _rarity, _legendary, _append)
        --create the pool
        G.ARGS.TEMP_POOL = EMPTY(G.ARGS.TEMP_POOL)
        local _pool, _starting_pool, _pool_key, _pool_size = G.ARGS.TEMP_POOL, nil, '', 0
    
        if _type == 'Joker' then 
            local rarity = _rarity or pseudorandom('rarity'..G.GAME.round_resets.ante..(_append or '')) 
            rarity = (_legendary and 4) or (rarity > 0.95 and 3) or (rarity > 0.7 and 2) or 1
            _starting_pool, _pool_key = G.P_JOKER_RARITY_POOLS[rarity], 'Joker'..rarity..((not _legendary and _append) or '')
        else _starting_pool, _pool_key = G.P_CENTER_POOLS[_type], _type..(_append or '')
        end
    
        --cull the pool
        for k, v in ipairs(_starting_pool) do
            local add = nil
            if _type == 'Enhanced' then
                add = true
            elseif _type == 'Demo' then
                if v.pos and v.config then add = true end
            elseif _type == 'Tag' then
                if (not v.requires or (G.P_CENTERS[v.requires] and G.P_CENTERS[v.requires].discovered)) and 
                (not v.min_ante or v.min_ante <= G.GAME.round_resets.ante) then
                    add = true
                end
            elseif not (G.GAME.used_jokers[v.key] and not next(find_joker("Showman"))) and
                (v.unlocked ~= false or v.rarity == 4) then
                if v.set == 'Voucher' then
                    if not G.GAME.used_vouchers[v.key] then 
                        local include = true
                        if v.requires then 
                            for kk, vv in pairs(v.requires) do
                                if not G.GAME.used_vouchers[vv] then 
                                    include = false
                                end
                            end
                        end
                        if G.shop_vouchers and G.shop_vouchers.cards then
                            for kk, vv in ipairs(G.shop_vouchers.cards) do
                                if vv.config.center.key == v.key then include = false end
                            end
                        end
                        if include then
                            add = true
                        end
                    end
                elseif v.set == 'Planet' then
                    if (not v.config.softlock or G.GAME.hands[v.config.hand_type].played > 0) then
                        add = true
                    end
                elseif v.enhancement_gate then
                    add = nil
                    for kk, vv in pairs(G.playing_cards) do
                        if vv.config.center.key == v.enhancement_gate then
                            add = true
                        end
                    end
                else
                    add = true
                end
                if v.name == 'Black Hole' or v.name == 'The Soul' then
                    add = false
                end
            end

            if v.no_pool_flag and G.GAME.pool_flags[v.no_pool_flag] then add = nil end
            if v.yes_pool_flag and not G.GAME.pool_flags[v.yes_pool_flag] then add = nil end
            
            if add and not G.GAME.banned_keys[v.key] then 
                _pool[#_pool + 1] = v.key
                _pool_size = _pool_size + 1
            else
                _pool[#_pool + 1] = 'UNAVAILABLE'
            end
        end

        --if pool is empty
        if _pool_size == 0 then
            _pool = EMPTY(G.ARGS.TEMP_POOL)
            if _type == 'Tarot' or _type == 'Tarot_Planet' then _pool[#_pool + 1] = "c_strength"
            elseif _type == 'Planet' then _pool[#_pool + 1] = "c_pluto"
            elseif _type == 'Spectral' then _pool[#_pool + 1] = "c_incantation"
            elseif _type == 'Joker' then _pool[#_pool + 1] = "j_joker"
            elseif _type == 'Demo' then _pool[#_pool + 1] = "j_joker"
            elseif _type == 'Voucher' then _pool[#_pool + 1] = "v_blank"
            elseif _type == 'Tag' then _pool[#_pool + 1] = "tag_handy"
            else _pool[#_pool + 1] = "j_joker"
            end
        end

        return _pool, _pool_key..(not _legendary and G.GAME.round_resets.ante or '')
end

function poll_edition(_key, _mod, _no_neg, _guaranteed)
    _mod = _mod or 1
    local edition_poll = pseudorandom(pseudoseed(_key or 'edition_generic'))
    if _guaranteed then
        if edition_poll > 1 - 0.003*25 and not _no_neg then
            return {negative = true}
        elseif edition_poll > 1 - 0.006*25 then
            return {polychrome = true}
        elseif edition_poll > 1 - 0.02*25 then
            return {holo = true}
        elseif edition_poll > 1 - 0.04*25 then
            return {foil = true}
        end
    else
        if edition_poll > 1 - 0.003*_mod and not _no_neg then
            return {negative = true}
        elseif edition_poll > 1 - 0.006*G.GAME.edition_rate*_mod then
            return {polychrome = true}
        elseif edition_poll > 1 - 0.02*G.GAME.edition_rate*_mod then
            return {holo = true}
        elseif edition_poll > 1 - 0.04*G.GAME.edition_rate*_mod then
            return {foil = true}
        end
    end
    return nil
end

function create_card(_type, area, legendary, _rarity, skip_materialize, soulable, forced_key, key_append)
    local area = area or G.jokers
    local center = G.P_CENTERS.b_red
        

    --should pool be skipped with a forced key
    if not forced_key and soulable and (not G.GAME.banned_keys['c_soul']) then
        if (_type == 'Tarot' or _type == 'Spectral' or _type == 'Tarot_Planet') and
        not (G.GAME.used_jokers['c_soul'] and not next(find_joker("Showman")))  then
            if pseudorandom('soul_'.._type..G.GAME.round_resets.ante) > 0.997 then
                forced_key = 'c_soul'
            end
        end
        if (_type == 'Planet' or _type == 'Spectral') and
        not (G.GAME.used_jokers['c_black_hole'] and not next(find_joker("Showman")))  then 
            if pseudorandom('soul_'.._type..G.GAME.round_resets.ante) > 0.997 then
                forced_key = 'c_black_hole'
            end
        end
    end

    if _type == 'Base' then 
        forced_key = 'c_base'
    end



    if forced_key and not G.GAME.banned_keys[forced_key] then 
        center = G.P_CENTERS[forced_key]
        _type = (center.set ~= 'Default' and center.set or _type)
    else
        local _pool, _pool_key = get_current_pool(_type, _rarity, legendary, key_append)
        center = pseudorandom_element(_pool, pseudoseed(_pool_key))
        local it = 1
        while center == 'UNAVAILABLE' do
            it = it + 1
            center = pseudorandom_element(_pool, pseudoseed(_pool_key..'_resample'..it))
        end

        center = G.P_CENTERS[center]
    end

    local front = ((_type=='Base' or _type == 'Enhanced') and pseudorandom_element(G.P_CARDS, pseudoseed('front'..(key_append or '')..G.GAME.round_resets.ante))) or nil

    local card = Card(area.T.x + area.T.w/2, area.T.y, G.CARD_W, G.CARD_H, front, center,
    {bypass_discovery_center = area==G.shop_jokers or area == G.pack_cards or area == G.shop_vouchers or (G.shop_demo and area==G.shop_demo) or area==G.jokers or area==G.consumeables,
     bypass_discovery_ui = area==G.shop_jokers or area == G.pack_cards or area==G.shop_vouchers or (G.shop_demo and area==G.shop_demo),
     discover = area==G.jokers or area==G.consumeables, 
     bypass_back = G.GAME.selected_back.pos})
    if card.ability.consumeable and not skip_materialize then card:start_materialize() end

    if _type == 'Joker' then
        if G.GAME.modifiers.all_eternal then
            card:set_eternal(true)
        end
        if (area == G.shop_jokers) or (area == G.pack_cards) then 
            local eternal_perishable_poll = pseudorandom((area == G.pack_cards and 'packetper' or 'etperpoll')..G.GAME.round_resets.ante)
            if G.GAME.modifiers.enable_eternals_in_shop and eternal_perishable_poll > 0.7 then
                card:set_eternal(true)
            elseif G.GAME.modifiers.enable_perishables_in_shop and ((eternal_perishable_poll > 0.4) and (eternal_perishable_poll <= 0.7)) then
                card:set_perishable(true)
            end
            if G.GAME.modifiers.enable_rentals_in_shop and pseudorandom((area == G.pack_cards and 'packssjr' or 'ssjr')..G.GAME.round_resets.ante) > 0.7 then
                card:set_rental(true)
            end
        end

        local edition = poll_edition('edi'..(key_append or '')..G.GAME.round_resets.ante)
        card:set_edition(edition)
        check_for_unlock({type = 'have_edition'})
    end
    return card
end

function copy_card(other, new_card, card_scale, playing_card, strip_edition)
    local new_card = new_card or Card(other.T.x, other.T.y, G.CARD_W*(card_scale or 1), G.CARD_H*(card_scale or 1), G.P_CARDS.empty, G.P_CENTERS.c_base, {playing_card = playing_card})
    new_card:set_ability(other.config.center)
    new_card.ability.type = other.ability.type
    new_card:set_base(other.config.card)
    for k, v in pairs(other.ability) do
        if type(v) == 'table' then 
            new_card.ability[k] = copy_table(v)
        else
            new_card.ability[k] = v
        end
    end

    if not strip_edition then 
        new_card:set_edition(other.edition or {}, nil, true)
    end
    check_for_unlock({type = 'have_edition'})
    new_card:set_seal(other.seal, true)
    if other.params then
        new_card.params = other.params
        new_card.params.playing_card = playing_card
    end
    new_card.debuff = other.debuff
    new_card.pinned = other.pinned
    return new_card
end

function tutorial_info(args)
    local overlay_colour = {0.32,0.36,0.41,0}
    ease_value(overlay_colour, 4, 0.6, nil, 'REAL', true,0.4)
    G.OVERLAY_TUTORIAL = G.OVERLAY_TUTORIAL or UIBox{
        definition = {n=G.UIT.ROOT, config = {align = "cm", padding = 32.05, r=0.1, colour = overlay_colour, emboss = 0.05}, nodes={
            {n=G.UIT.R, config={align = "tr", minh = G.ROOM.T.h, minw = G.ROOM.T.w}, nodes={
                UIBox_button{label = {localize('b_skip').." >"}, button = "skip_tutorial_section", minw = 1.3, scale = 0.45, colour = G.C.JOKER_GREY}
            }}
        }},
        config = {
            align = "cm",
            offset = {x=0,y=3.2},
            major = G.ROOM_ATTACH,
            bond = 'Weak'
          }
      }
    G.OVERLAY_TUTORIAL.step = G.OVERLAY_TUTORIAL.step or 1
    G.OVERLAY_TUTORIAL.step_complete = false
    local row_dollars_chips = G.HUD:get_UIE_by_ID('row_dollars_chips')
    local align = args.align or "tm"
    local step = args.step or 1
    local attach = args.attach or {major = row_dollars_chips, type = 'tm', offset = {x=0, y=-0.5}}
    local pos = args.pos or {x=attach.major.T.x + attach.major.T.w/2, y=attach.major.T.y + attach.major.T.h/2}
    local button = args.button or {button = localize('b_next'), func = 'tut_next'}
    args.highlight = args.highlight or {}
    G.E_MANAGER:add_event(Event({
        trigger = 'after',
        delay = 0.3,
        func = function()
            if G.OVERLAY_TUTORIAL and G.OVERLAY_TUTORIAL.step == step and
            not G.OVERLAY_TUTORIAL.step_complete then
                G.CONTROLLER.interrupt.focus = true
                G.OVERLAY_TUTORIAL.Jimbo = G.OVERLAY_TUTORIAL.Jimbo or Card_Character(pos)
                if type(args.highlight) == 'function' then args.highlight = args.highlight() end
                args.highlight[#args.highlight+1] = G.OVERLAY_TUTORIAL.Jimbo
                G.OVERLAY_TUTORIAL.Jimbo:add_speech_bubble(args.text_key, align, args.loc_vars)
                G.OVERLAY_TUTORIAL.Jimbo:set_alignment(attach)
                if args.hard_set then G.OVERLAY_TUTORIAL.Jimbo:hard_set_VT() end
                G.OVERLAY_TUTORIAL.button_listen = nil
                if G.OVERLAY_TUTORIAL.content then G.OVERLAY_TUTORIAL.content:remove() end
                if args.content then
                    G.OVERLAY_TUTORIAL.content = UIBox{
                        definition = args.content(),
                        config = {
                            align = args.content_config and args.content_config.align or "cm",
                            offset = args.content_config and args.content_config.offset or {x=0,y=0},
                            major = args.content_config and args.content_config.major or G.OVERLAY_TUTORIAL.Jimbo,
                            bond = 'Weak'
                          }
                      }
                    args.highlight[#args.highlight+1] = G.OVERLAY_TUTORIAL.content
                end
                if args.button_listen then G.OVERLAY_TUTORIAL.button_listen = args.button_listen end
                if not args.no_button then G.OVERLAY_TUTORIAL.Jimbo:add_button(button.button, button.func, button.colour, button.update_func, true) end
                G.OVERLAY_TUTORIAL.Jimbo:say_stuff(2*(#(G.localization.misc.tutorial[args.text_key] or {}))+1)
                if args.snap_to then
                    G.E_MANAGER:add_event(Event({
                        trigger = 'immediate',
                        blocking = false, blockable = false,
                        func = function()
                            if G.OVERLAY_TUTORIAL and G.OVERLAY_TUTORIAL.Jimbo and not G.OVERLAY_TUTORIAL.Jimbo.talking then 
                            local _snap_to = args.snap_to()
                            if _snap_to then
                                G.CONTROLLER.interrupt.focus = false
                                G.CONTROLLER:snap_to({node = args.snap_to()})
                            end
                            return true
                            end
                        end
                    }), 'tutorial') 
                end
                if args.highlight then G.OVERLAY_TUTORIAL.highlights = args.highlight end 
                G.OVERLAY_TUTORIAL.step_complete = true
            end
            return not G.OVERLAY_TUTORIAL or G.OVERLAY_TUTORIAL.step > step or G.OVERLAY_TUTORIAL.skip_steps
        end
    }), 'tutorial') 
    return step+1
end

function calculate_reroll_cost(skip_increment)
    if G.GAME.current_round.free_rerolls < 0 then G.GAME.current_round.free_rerolls = 0 end
    if G.GAME.current_round.free_rerolls > 0 then G.GAME.current_round.reroll_cost = 0; return end
    G.GAME.current_round.reroll_cost_increase = G.GAME.current_round.reroll_cost_increase or 0
    if not skip_increment then G.GAME.current_round.reroll_cost_increase = G.GAME.current_round.reroll_cost_increase + 1 end
    G.GAME.current_round.reroll_cost = (G.GAME.round_resets.temp_reroll_cost or G.GAME.round_resets.reroll_cost) + G.GAME.current_round.reroll_cost_increase
end

function reset_idol_card()
    G.GAME.current_round.idol_card.rank = 'Ace'
    G.GAME.current_round.idol_card.suit = 'Spades'
    local valid_idol_cards = {}
    for k, v in ipairs(G.playing_cards) do
        if v.ability.effect ~= 'Stone Card' then
            valid_idol_cards[#valid_idol_cards+1] = v
        end
    end
    if valid_idol_cards[1] then 
        local idol_card = pseudorandom_element(valid_idol_cards, pseudoseed('idol'..G.GAME.round_resets.ante))
        G.GAME.current_round.idol_card.rank = idol_card.base.value
        G.GAME.current_round.idol_card.suit = idol_card.base.suit
        G.GAME.current_round.idol_card.id = idol_card.base.id
    end
end

function reset_mail_rank()
    G.GAME.current_round.mail_card.rank = 'Ace'
    local valid_mail_cards = {}
    for k, v in ipairs(G.playing_cards) do
        if v.ability.effect ~= 'Stone Card' then
            valid_mail_cards[#valid_mail_cards+1] = v
        end
    end
    if valid_mail_cards[1] then 
        local mail_card = pseudorandom_element(valid_mail_cards, pseudoseed('mail'..G.GAME.round_resets.ante))
        G.GAME.current_round.mail_card.rank = mail_card.base.value
        G.GAME.current_round.mail_card.id = mail_card.base.id
    end
end

function reset_ancient_card()
    local ancient_suits = {}
    for k, v in ipairs({'Spades','Hearts','Clubs','Diamonds'}) do
        if v ~= G.GAME.current_round.ancient_card.suit then ancient_suits[#ancient_suits + 1] = v end
    end
    local ancient_card = pseudorandom_element(ancient_suits, pseudoseed('anc'..G.GAME.round_resets.ante))
    G.GAME.current_round.ancient_card.suit = ancient_card
end

function reset_castle_card()
    G.GAME.current_round.castle_card.suit = 'Spades'
    local valid_castle_cards = {}
    for k, v in ipairs(G.playing_cards) do
        if v.ability.effect ~= 'Stone Card' then
            valid_castle_cards[#valid_castle_cards+1] = v
        end
    end
    if valid_castle_cards[1] then 
        local castle_card = pseudorandom_element(valid_castle_cards, pseudoseed('cas'..G.GAME.round_resets.ante))
        G.GAME.current_round.castle_card.suit = castle_card.base.suit
    end
end

function reset_blinds()
    G.GAME.round_resets.blind_states = G.GAME.round_resets.blind_states or {Small = 'Select', Big = 'Upcoming', Boss = 'Upcoming'}
    if G.GAME.round_resets.blind_states.Boss == 'Defeated' then
        G.GAME.round_resets.blind_states.Small = 'Upcoming'
        G.GAME.round_resets.blind_states.Big = 'Upcoming'
        G.GAME.round_resets.blind_states.Boss = 'Upcoming'
        G.GAME.blind_on_deck = 'Small'
        G.GAME.round_resets.blind_choices.Boss = get_new_boss()
        G.GAME.round_resets.boss_rerolled = false
    end
end

function get_new_boss()
    G.GAME.perscribed_bosses = G.GAME.perscribed_bosses or {
    }
    if G.GAME.perscribed_bosses and G.GAME.perscribed_bosses[G.GAME.round_resets.ante] then 
        local ret_boss = G.GAME.perscribed_bosses[G.GAME.round_resets.ante] 
        G.GAME.perscribed_bosses[G.GAME.round_resets.ante] = nil
        G.GAME.bosses_used[ret_boss] = G.GAME.bosses_used[ret_boss] + 1
        return ret_boss
    end
    if G.FORCE_BOSS then return G.FORCE_BOSS end
    
    local eligible_bosses = {}
    for k, v in pairs(G.P_BLINDS) do
        if not v.boss then

        elseif not v.boss.showdown and (v.boss.min <= math.max(1, G.GAME.round_resets.ante) and ((math.max(1, G.GAME.round_resets.ante))%G.GAME.win_ante ~= 0 or G.GAME.round_resets.ante < 2)) then
            eligible_bosses[k] = true
        elseif v.boss.showdown and (G.GAME.round_resets.ante)%G.GAME.win_ante == 0 and G.GAME.round_resets.ante >= 2 then
            eligible_bosses[k] = true
        end
    end
    for k, v in pairs(G.GAME.banned_keys) do
        if eligible_bosses[k] then eligible_bosses[k] = nil end
    end

    local min_use = 100
    for k, v in pairs(G.GAME.bosses_used) do
        if eligible_bosses[k] then
            eligible_bosses[k] = v
            if eligible_bosses[k] <= min_use then 
                min_use = eligible_bosses[k]
            end
        end
    end
    for k, v in pairs(eligible_bosses) do
        if eligible_bosses[k] then
            if eligible_bosses[k] > min_use then 
                eligible_bosses[k] = nil
            end
        end
    end
    local _, boss = pseudorandom_element(eligible_bosses, pseudoseed('boss'))
    G.GAME.bosses_used[boss] = G.GAME.bosses_used[boss] + 1
    
    return boss
end

function get_type_colour(_c, card)
    return 
    ((_c.unlocked == false and not (card and card.bypass_lock)) and G.C.BLACK) or 
    ((_c.unlocked ~= false and (_c.set == 'Joker' or _c.consumeable or _c.set == 'Voucher') and not _c.discoveredand and not ((_c.area ~= G.jokers and _c.area ~= G.consumeables and _c.area) or not _c.area)) and G.C.JOKER_GREY) or
    (card and card.debuff and mix_colours(G.C.RED, G.C.GREY, 0.7)) or 
    (_c.set == 'Joker' and G.C.RARITY[_c.rarity]) or 
    (_c.set == 'Edition' and G.C.DARK_EDITION) or 
    (_c.set == 'Booster' and G.C.BOOSTER) or 
    G.C.SECONDARY_SET[_c.set] or
    {0, 1, 1, 1}
end

function generate_card_ui(_c, full_UI_table, specific_vars, card_type, badges, hide_desc, main_start, main_end)
    local first_pass = nil
    if not full_UI_table then 
        first_pass = true
        full_UI_table = {
            main = {},
            info = {},
            type = {},
            name = nil,
            badges = badges or {}
        }
    end

    local desc_nodes = (not full_UI_table.name and full_UI_table.main) or full_UI_table.info
    local name_override = nil
    local info_queue = {}

    if full_UI_table.name then
        full_UI_table.info[#full_UI_table.info+1] = {}
        desc_nodes = full_UI_table.info[#full_UI_table.info]
    end

    if not full_UI_table.name then
        if specific_vars and specific_vars.no_name then
            full_UI_table.name = true
        elseif card_type == 'Locked' then
            full_UI_table.name = localize{type = 'name', set = 'Other', key = 'locked', nodes = {}}
        elseif card_type == 'Undiscovered' then 
            full_UI_table.name = localize{type = 'name', set = 'Other', key = 'undiscovered_'..(string.lower(_c.set)), name_nodes = {}}
        elseif specific_vars and (card_type == 'Default' or card_type == 'Enhanced') then
            if (_c.name == 'Stone Card') then full_UI_table.name = true end
            if (specific_vars.playing_card and (_c.name ~= 'Stone Card')) then
                full_UI_table.name = {}
                localize{type = 'other', key = 'playing_card', set = 'Other', nodes = full_UI_table.name, vars = {localize(specific_vars.value, 'ranks'), localize(specific_vars.suit, 'suits_plural'), colours = {specific_vars.colour}}}
                full_UI_table.name = full_UI_table.name[1]
            end
        elseif card_type == 'Booster' then
            
        else
            full_UI_table.name = localize{type = 'name', set = _c.set, key = _c.key, nodes = full_UI_table.name}
        end
        full_UI_table.card_type = card_type or _c.set
    end 

    local loc_vars = {}
    if main_start then 
        desc_nodes[#desc_nodes+1] = main_start 
    end

    if _c.set == 'Other' then
        localize{type = 'other', key = _c.key, nodes = desc_nodes, vars = specific_vars or _c.vars}
    elseif card_type == 'Locked' then
        if _c.wip then localize{type = 'other', key = 'wip_locked', set = 'Other', nodes = desc_nodes, vars = loc_vars}
        elseif _c.demo and specific_vars then localize{type = 'other', key = 'demo_shop_locked', nodes = desc_nodes, vars = loc_vars}  
        elseif _c.demo then localize{type = 'other', key = 'demo_locked', nodes = desc_nodes, vars = loc_vars}
        else
            if _c.name == 'Golden Ticket' then
            elseif _c.name == 'Mr. Bones' then loc_vars = {_c.unlock_condition.extra, G.PROFILES[G.SETTINGS.profile].career_stats.c_losses}
            elseif _c.name == 'Acrobat' then loc_vars = {_c.unlock_condition.extra, G.PROFILES[G.SETTINGS.profile].career_stats.c_hands_played}
            elseif _c.name == 'Sock and Buskin' then loc_vars = {_c.unlock_condition.extra, G.PROFILES[G.SETTINGS.profile].career_stats.c_face_cards_played}
            elseif _c.name == 'Swashbuckler' then loc_vars = {_c.unlock_condition.extra, G.PROFILES[G.SETTINGS.profile].career_stats.c_jokers_sold}
            elseif _c.name == 'Troubadour' then loc_vars = {_c.unlock_condition.extra}
            elseif _c.name == 'Certificate' then
            elseif _c.name == 'Smeared Joker' then loc_vars = {_c.unlock_condition.extra.count,localize{type = 'name_text', key = _c.unlock_condition.extra.e_key, set = 'Enhanced'}}
            elseif _c.name == 'Throwback' then
            elseif _c.name == 'Hanging Chad' then loc_vars = {localize(_c.unlock_condition.extra, 'poker_hands')}
            elseif _c.name == 'Rough Gem' then loc_vars = {_c.unlock_condition.extra.count, localize(_c.unlock_condition.extra.suit, 'suits_singular')}
            elseif _c.name == 'Bloodstone' then loc_vars = {_c.unlock_condition.extra.count, localize(_c.unlock_condition.extra.suit, 'suits_singular')}
            elseif _c.name == 'Arrowhead' then loc_vars = {_c.unlock_condition.extra.count, localize(_c.unlock_condition.extra.suit, 'suits_singular')}
            elseif _c.name == 'Onyx Agate' then loc_vars = {_c.unlock_condition.extra.count, localize(_c.unlock_condition.extra.suit, 'suits_singular')}
            elseif _c.name == 'Glass Joker' then loc_vars = {_c.unlock_condition.extra.count, localize{type = 'name_text', key = _c.unlock_condition.extra.e_key, set = 'Enhanced'}}
            elseif _c.name == 'Showman' then loc_vars = {_c.unlock_condition.ante}
            elseif _c.name == 'Flower Pot' then loc_vars = {_c.unlock_condition.ante}
            elseif _c.name == 'Blueprint' then
            elseif _c.name == 'Wee Joker' then loc_vars = {_c.unlock_condition.n_rounds}
            elseif _c.name == 'Merry Andy' then loc_vars = {_c.unlock_condition.n_rounds}
            elseif _c.name == 'Oops! All 6s' then loc_vars = {number_format(_c.unlock_condition.chips)}
            elseif _c.name == 'The Idol' then loc_vars = {number_format(_c.unlock_condition.chips)}
            elseif _c.name == 'Seeing Double' then loc_vars = {localize("ph_4_7_of_clubs")}
            elseif _c.name == 'Matador' then
            elseif _c.name == 'Hit the Road' then
            elseif _c.name == 'The Duo' then loc_vars = {localize(_c.unlock_condition.extra, 'poker_hands')}
            elseif _c.name == 'The Trio' then loc_vars = {localize(_c.unlock_condition.extra, 'poker_hands')}
            elseif _c.name == 'The Family' then loc_vars = {localize(_c.unlock_condition.extra, 'poker_hands')}
            elseif _c.name == 'The Order' then loc_vars = {localize(_c.unlock_condition.extra, 'poker_hands')}
            elseif _c.name == 'The Tribe' then loc_vars = {localize(_c.unlock_condition.extra, 'poker_hands')}
            elseif _c.name == 'Stuntman' then loc_vars = {number_format(_c.unlock_condition.chips)}
            elseif _c.name == 'Invisible Joker' then
            elseif _c.name == 'Brainstorm' then
            elseif _c.name == 'Satellite' then loc_vars = {_c.unlock_condition.extra}
            elseif _c.name == 'Shoot the Moon' then
            elseif _c.name == "Driver's License" then loc_vars = {_c.unlock_condition.extra.count}
            elseif _c.name == 'Cartomancer' then loc_vars = {_c.unlock_condition.tarot_count}
            elseif _c.name == 'Astronomer' then
            elseif _c.name == 'Burnt Joker' then loc_vars = {_c.unlock_condition.extra, G.PROFILES[G.SETTINGS.profile].career_stats.c_cards_sold}
            elseif _c.name == 'Bootstraps' then loc_vars = {_c.unlock_condition.extra.count}
                --Vouchers
            elseif _c.name == 'Overstock Plus' then loc_vars = {_c.unlock_condition.extra, G.PROFILES[G.SETTINGS.profile].career_stats.c_shop_dollars_spent}
            elseif _c.name == 'Liquidation' then loc_vars = {_c.unlock_condition.extra}
            elseif _c.name == 'Tarot Tycoon' then loc_vars = {_c.unlock_condition.extra, G.PROFILES[G.SETTINGS.profile].career_stats.c_tarots_bought}
            elseif _c.name == 'Planet Tycoon' then loc_vars = {_c.unlock_condition.extra, G.PROFILES[G.SETTINGS.profile].career_stats.c_planets_bought}
            elseif _c.name == 'Glow Up' then loc_vars = {_c.unlock_condition.extra}
            elseif _c.name == 'Reroll Glut' then loc_vars = {_c.unlock_condition.extra, G.PROFILES[G.SETTINGS.profile].career_stats.c_shop_rerolls}
            elseif _c.name == 'Omen Globe' then loc_vars = {_c.unlock_condition.extra, G.PROFILES[G.SETTINGS.profile].career_stats.c_tarot_reading_used}
            elseif _c.name == 'Observatory' then loc_vars = {_c.unlock_condition.extra, G.PROFILES[G.SETTINGS.profile].career_stats.c_planetarium_used}
            elseif _c.name == 'Nacho Tong' then loc_vars = {_c.unlock_condition.extra, G.PROFILES[G.SETTINGS.profile].career_stats.c_cards_played}
            elseif _c.name == 'Recyclomancy' then loc_vars = {_c.unlock_condition.extra, G.PROFILES[G.SETTINGS.profile].career_stats.c_cards_discarded}
            elseif _c.name == 'Money Tree' then loc_vars = {_c.unlock_condition.extra, G.PROFILES[G.SETTINGS.profile].career_stats.c_round_interest_cap_streak}
            elseif _c.name == 'Antimatter' then loc_vars = {_c.unlock_condition.extra, G.PROFILES[G.SETTINGS.profile].voucher_usage.v_blank and G.PROFILES[G.SETTINGS.profile].voucher_usage.v_blank.count or 0}
            elseif _c.name == 'Illusion' then loc_vars = {_c.unlock_condition.extra, G.PROFILES[G.SETTINGS.profile].career_stats.c_playing_cards_bought}
            elseif _c.name == 'Petroglyph' then loc_vars = {_c.unlock_condition.extra}
            elseif _c.name == 'Retcon' then loc_vars = {_c.unlock_condition.extra}
            elseif _c.name == 'Palette' then loc_vars = {_c.unlock_condition.extra}
            end
            
            if _c.rarity and _c.rarity == 4 and specific_vars and not specific_vars.not_hidden then 
                localize{type = 'unlocks', key = 'joker_locked_legendary', set = 'Other', nodes = desc_nodes, vars = loc_vars}
            else

            localize{type = 'unlocks', key = _c.key, set = _c.set, nodes = desc_nodes, vars = loc_vars}
            end
        end
    elseif hide_desc then
        localize{type = 'other', key = 'undiscovered_'..(string.lower(_c.set)), set = _c.set, nodes = desc_nodes}
    elseif specific_vars and specific_vars.debuffed then
        localize{type = 'other', key = 'debuffed_'..(specific_vars.playing_card and 'playing_card' or 'default'), nodes = desc_nodes}
    elseif _c.set == 'Joker' then
        if _c.name == 'Stone Joker' or _c.name == 'Marble Joker' then info_queue[#info_queue+1] = G.P_CENTERS.m_stone
        elseif _c.name == 'Steel Joker' then info_queue[#info_queue+1] = G.P_CENTERS.m_steel 
        elseif _c.name == 'Glass Joker' then info_queue[#info_queue+1] = G.P_CENTERS.m_glass 
        elseif _c.name == 'Golden Ticket' then info_queue[#info_queue+1] = G.P_CENTERS.m_gold 
        elseif _c.name == 'Lucky Cat' then info_queue[#info_queue+1] = G.P_CENTERS.m_lucky 
        elseif _c.name == 'Midas Mask' then info_queue[#info_queue+1] = G.P_CENTERS.m_gold
        elseif _c.name == 'Invisible Joker' then 
            if G.jokers and G.jokers.cards then
                for k, v in ipairs(G.jokers.cards) do
                    if (v.edition and v.edition.negative) and (G.localization.descriptions.Other.remove_negative)then 
                        main_end = {}
                        localize{type = 'other', key = 'remove_negative', nodes = main_end, vars = {}}
                        main_end = main_end[1]
                        break
                    end
                end
            end 
        elseif _c.name == 'Diet Cola' then info_queue[#info_queue+1] = {key = 'tag_double', set = 'Tag'}
        elseif _c.name == 'Perkeo' then info_queue[#info_queue+1] = {key = 'e_negative_consumable', set = 'Edition', config = {extra = 1}}
        end
        if specific_vars and specific_vars.pinned then info_queue[#info_queue+1] = {key = 'pinned_left', set = 'Other'} end
        if specific_vars and specific_vars.sticker then info_queue[#info_queue+1] = {key = string.lower(specific_vars.sticker)..'_sticker', set = 'Other'} end
        localize{type = 'descriptions', key = _c.key, set = _c.set, nodes = desc_nodes, vars = specific_vars or {}}
    elseif _c.set == 'Tag' then
        if _c.name == 'Negative Tag' then info_queue[#info_queue+1] = G.P_CENTERS.e_negative
        elseif _c.name == 'Foil Tag' then info_queue[#info_queue+1] = G.P_CENTERS.e_foil 
        elseif _c.name == 'Holographic Tag' then info_queue[#info_queue+1] = G.P_CENTERS.e_holo
        elseif _c.name == 'Polychrome Tag' then info_queue[#info_queue+1] = G.P_CENTERS.e_polychrome 
        elseif _c.name == 'Charm Tag' then info_queue[#info_queue+1] = G.P_CENTERS.p_arcana_mega_1 
        elseif _c.name == 'Meteor Tag' then info_queue[#info_queue+1] = G.P_CENTERS.p_celestial_mega_1 
        elseif _c.name == 'Ethereal Tag' then info_queue[#info_queue+1] = G.P_CENTERS.p_spectral_normal_1 
        elseif _c.name == 'Standard Tag' then info_queue[#info_queue+1] = G.P_CENTERS.p_standard_mega_1 
        elseif _c.name == 'Buffoon Tag' then info_queue[#info_queue+1] = G.P_CENTERS.p_buffoon_mega_1 
        end
        localize{type = 'descriptions', key = _c.key, set = 'Tag', nodes = desc_nodes, vars = specific_vars or {}}
    elseif _c.set == 'Voucher' then
        if _c.name == "Overstock" or _c.name == 'Overstock Plus' then
        elseif _c.name == "Tarot Merchant" or _c.name == "Tarot Tycoon" then loc_vars = {_c.config.extra_disp}
        elseif _c.name == "Planet Merchant" or _c.name == "Planet Tycoon" then loc_vars = {_c.config.extra_disp}
        elseif _c.name == "Hone" or _c.name == "Glow Up" then loc_vars = {_c.config.extra}
        elseif _c.name == "Reroll Surplus" or _c.name == "Reroll Glut" then loc_vars = {_c.config.extra}
        elseif _c.name == "Grabber" or _c.name == "Nacho Tong" then loc_vars = {_c.config.extra}
        elseif _c.name == "Wasteful" or _c.name == "Recyclomancy" then loc_vars = {_c.config.extra}
        elseif _c.name == "Seed Money" or _c.name == "Money Tree" then loc_vars = {_c.config.extra/5}
        elseif _c.name == "Blank" or _c.name == "Antimatter" then
        elseif _c.name == "Hieroglyph" or _c.name == "Petroglyph" then loc_vars = {_c.config.extra}
        elseif _c.name == "Director's Cut" or _c.name == "Retcon" then loc_vars = {_c.config.extra}
        elseif _c.name == "Paint Brush" or _c.name == "Palette" then loc_vars = {_c.config.extra}
        elseif _c.name == "Telescope" or _c.name == "Observatory" then loc_vars = {_c.config.extra}
        elseif _c.name == "Clearance Sale" or _c.name == "Liquidation" then loc_vars = {_c.config.extra}
        end
        localize{type = 'descriptions', key = _c.key, set = _c.set, nodes = desc_nodes, vars = loc_vars}
    elseif _c.set == 'Edition' then
        loc_vars = {_c.config.extra}
        localize{type = 'descriptions', key = _c.key, set = _c.set, nodes = desc_nodes, vars = loc_vars}
    elseif _c.set == 'Default' and specific_vars then 
        if specific_vars.nominal_chips then 
            localize{type = 'other', key = 'card_chips', nodes = desc_nodes, vars = {specific_vars.nominal_chips}}
        end
        if specific_vars.bonus_chips then
            localize{type = 'other', key = 'card_extra_chips', nodes = desc_nodes, vars = {specific_vars.bonus_chips}}
        end
    elseif _c.set == 'Enhanced' then 
        if specific_vars and _c.name ~= 'Stone Card' and specific_vars.nominal_chips then
            localize{type = 'other', key = 'card_chips', nodes = desc_nodes, vars = {specific_vars.nominal_chips}}
        end
        if _c.effect == 'Mult Card' then loc_vars = {_c.config.mult}
        elseif _c.effect == 'Wild Card' then
        elseif _c.effect == 'Glass Card' then loc_vars = {_c.config.Xmult, G.GAME.probabilities.normal, _c.config.extra}
        elseif _c.effect == 'Steel Card' then loc_vars = {_c.config.h_x_mult}
        elseif _c.effect == 'Stone Card' then loc_vars = {((specific_vars and specific_vars.bonus_chips) or _c.config.bonus)}
        elseif _c.effect == 'Gold Card' then loc_vars = {_c.config.h_dollars}
        elseif _c.effect == 'Lucky Card' then loc_vars = {G.GAME.probabilities.normal, _c.config.mult, 5, _c.config.p_dollars, 15}
        end
        localize{type = 'descriptions', key = _c.key, set = _c.set, nodes = desc_nodes, vars = loc_vars}
        if _c.name ~= 'Stone Card' and ((specific_vars and specific_vars.bonus_chips) or _c.config.bonus) then
            localize{type = 'other', key = 'card_extra_chips', nodes = desc_nodes, vars = {((specific_vars and specific_vars.bonus_chips) or _c.config.bonus)}}
        end
    elseif _c.set == 'Booster' then 
        local desc_override = 'p_arcana_normal'
        if _c.name == 'Arcana Pack' then desc_override = 'p_arcana_normal'; loc_vars = {_c.config.choose, _c.config.extra}
        elseif _c.name == 'Jumbo Arcana Pack' then desc_override = 'p_arcana_jumbo'; loc_vars = {_c.config.choose, _c.config.extra}
        elseif _c.name == 'Mega Arcana Pack' then desc_override = 'p_arcana_mega'; loc_vars = {_c.config.choose, _c.config.extra}
        elseif _c.name == 'Celestial Pack' then desc_override = 'p_celestial_normal'; loc_vars = {_c.config.choose, _c.config.extra}
        elseif _c.name == 'Jumbo Celestial Pack' then desc_override = 'p_celestial_jumbo'; loc_vars = {_c.config.choose, _c.config.extra}
        elseif _c.name == 'Mega Celestial Pack' then desc_override = 'p_celestial_mega'; loc_vars = {_c.config.choose, _c.config.extra}
        elseif _c.name == 'Spectral Pack' then desc_override = 'p_spectral_normal'; loc_vars = {_c.config.choose, _c.config.extra}
        elseif _c.name == 'Jumbo Spectral Pack' then desc_override = 'p_spectral_jumbo'; loc_vars = {_c.config.choose, _c.config.extra}
        elseif _c.name == 'Mega Spectral Pack' then desc_override = 'p_spectral_mega'; loc_vars = {_c.config.choose, _c.config.extra}
        elseif _c.name == 'Standard Pack' then desc_override = 'p_standard_normal'; loc_vars = {_c.config.choose, _c.config.extra}
        elseif _c.name == 'Jumbo Standard Pack' then desc_override = 'p_standard_jumbo'; loc_vars = {_c.config.choose, _c.config.extra}
        elseif _c.name == 'Mega Standard Pack' then desc_override = 'p_standard_mega'; loc_vars = {_c.config.choose, _c.config.extra}
        elseif _c.name == 'Buffoon Pack' then desc_override = 'p_buffoon_normal'; loc_vars = {_c.config.choose, _c.config.extra}
        elseif _c.name == 'Jumbo Buffoon Pack' then desc_override = 'p_buffoon_jumbo'; loc_vars = {_c.config.choose, _c.config.extra}
        elseif _c.name == 'Mega Buffoon Pack' then desc_override = 'p_buffoon_mega'; loc_vars = {_c.config.choose, _c.config.extra}
        end
        name_override = desc_override
        if not full_UI_table.name then full_UI_table.name = localize{type = 'name', set = 'Other', key = name_override, nodes = full_UI_table.name} end
        localize{type = 'other', key = desc_override, nodes = desc_nodes, vars = loc_vars}
    elseif _c.set == 'Spectral' then 
        if _c.name == 'Familiar' or _c.name == 'Grim' or _c.name == 'Incantation' then loc_vars = {_c.config.extra}
        elseif _c.name == 'Immolate' then loc_vars = {_c.config.extra.destroy, _c.config.extra.dollars}
        elseif _c.name == 'Hex' then info_queue[#info_queue+1] = G.P_CENTERS.e_polychrome
        elseif _c.name == 'Talisman' then info_queue[#info_queue+1] = {key = 'gold_seal', set = 'Other'}
        elseif _c.name == 'Deja Vu' then info_queue[#info_queue+1] = {key = 'red_seal', set = 'Other'}
        elseif _c.name == 'Trance' then info_queue[#info_queue+1] = {key = 'blue_seal', set = 'Other'}
        elseif _c.name == 'Medium' then info_queue[#info_queue+1] = {key = 'purple_seal', set = 'Other'}
        elseif _c.name == 'Ankh' then
            if G.jokers and G.jokers.cards then
                for k, v in ipairs(G.jokers.cards) do
                    if (v.edition and v.edition.negative) and (G.localization.descriptions.Other.remove_negative)then 
                        info_queue[#info_queue+1] = G.P_CENTERS.e_negative
                        main_end = {}
                        localize{type = 'other', key = 'remove_negative', nodes = main_end, vars = {}}
                        main_end = main_end[1]
                        break
                    end
                end
            end
        elseif _c.name == 'Cryptid' then loc_vars = {_c.config.extra}
        end
        if _c.name == 'Ectoplasm' then info_queue[#info_queue+1] = G.P_CENTERS.e_negative; loc_vars = {G.GAME.ecto_minus or 1} end
        if _c.name == 'Aura' then
            info_queue[#info_queue+1] = G.P_CENTERS.e_foil
            info_queue[#info_queue+1] = G.P_CENTERS.e_holo
            info_queue[#info_queue+1] = G.P_CENTERS.e_polychrome
        end
        localize{type = 'descriptions', key = _c.key, set = _c.set, nodes = desc_nodes, vars = loc_vars}
    elseif _c.set == 'Planet' then
        loc_vars = {
            G.GAME.hands[_c.config.hand_type].level,localize(_c.config.hand_type, 'poker_hands'), G.GAME.hands[_c.config.hand_type].l_mult, G.GAME.hands[_c.config.hand_type].l_chips,
            colours = {(G.GAME.hands[_c.config.hand_type].level==1 and G.C.UI.TEXT_DARK or G.C.HAND_LEVELS[math.min(7, G.GAME.hands[_c.config.hand_type].level)])}
        }
        localize{type = 'descriptions', key = _c.key, set = _c.set, nodes = desc_nodes, vars = loc_vars}
    elseif _c.set == 'Tarot' then
       if _c.name == "The Fool" then
            local fool_c = G.GAME.last_tarot_planet and G.P_CENTERS[G.GAME.last_tarot_planet] or nil
            local last_tarot_planet = fool_c and localize{type = 'name_text', key = fool_c.key, set = fool_c.set} or localize('k_none')
            local colour = (not fool_c or fool_c.name == 'The Fool') and G.C.RED or G.C.GREEN
            main_end = {
                {n=G.UIT.C, config={align = "bm", padding = 0.02}, nodes={
                    {n=G.UIT.C, config={align = "m", colour = colour, r = 0.05, padding = 0.05}, nodes={
                        {n=G.UIT.T, config={text = ' '..last_tarot_planet..' ', colour = G.C.UI.TEXT_LIGHT, scale = 0.3, shadow = true}},
                    }}
                }}
            }
           loc_vars = {last_tarot_planet}
           if not (not fool_c or fool_c.name == 'The Fool') then
                info_queue[#info_queue+1] = fool_c
           end
       elseif _c.name == "The Magician" then loc_vars = {_c.config.max_highlighted, localize{type = 'name_text', set = 'Enhanced', key = _c.config.mod_conv}}; info_queue[#info_queue+1] = G.P_CENTERS[_c.config.mod_conv]
       elseif _c.name == "The High Priestess" then loc_vars = {_c.config.planets}
       elseif _c.name == "The Empress" then loc_vars = {_c.config.max_highlighted, localize{type = 'name_text', set = 'Enhanced', key = _c.config.mod_conv}}; info_queue[#info_queue+1] = G.P_CENTERS[_c.config.mod_conv]
       elseif _c.name == "The Emperor" then loc_vars = {_c.config.tarots}
       elseif _c.name == "The Hierophant" then loc_vars = {_c.config.max_highlighted, localize{type = 'name_text', set = 'Enhanced', key = _c.config.mod_conv}}; info_queue[#info_queue+1] = G.P_CENTERS[_c.config.mod_conv]
       elseif _c.name == "The Lovers" then loc_vars = {_c.config.max_highlighted, localize{type = 'name_text', set = 'Enhanced', key = _c.config.mod_conv}}; info_queue[#info_queue+1] = G.P_CENTERS[_c.config.mod_conv]
       elseif _c.name == "The Chariot" then loc_vars = {_c.config.max_highlighted, localize{type = 'name_text', set = 'Enhanced', key = _c.config.mod_conv}}; info_queue[#info_queue+1] = G.P_CENTERS[_c.config.mod_conv]
       elseif _c.name == "Justice" then loc_vars = {_c.config.max_highlighted, localize{type = 'name_text', set = 'Enhanced', key = _c.config.mod_conv}}; info_queue[#info_queue+1] = G.P_CENTERS[_c.config.mod_conv]
       elseif _c.name == "The Hermit" then loc_vars = {_c.config.extra}
       elseif _c.name == "The Wheel of Fortune" then loc_vars = {G.GAME.probabilities.normal, _c.config.extra};  info_queue[#info_queue+1] = G.P_CENTERS.e_foil; info_queue[#info_queue+1] = G.P_CENTERS.e_holo; info_queue[#info_queue+1] = G.P_CENTERS.e_polychrome; 
       elseif _c.name == "Strength" then loc_vars = {_c.config.max_highlighted}
       elseif _c.name == "The Hanged Man" then loc_vars = {_c.config.max_highlighted}
       elseif _c.name == "Death" then loc_vars = {_c.config.max_highlighted}
       elseif _c.name == "Temperance" then
        local _money = 0
        if G.jokers then
            for i = 1, #G.jokers.cards do
                if G.jokers.cards[i].ability.set == 'Joker' then
                    _money = _money + G.jokers.cards[i].sell_cost
                end
            end
        end
        loc_vars = {_c.config.extra, math.min(_c.config.extra, _money)}
       elseif _c.name == "The Devil" then loc_vars = {_c.config.max_highlighted, localize{type = 'name_text', set = 'Enhanced', key = _c.config.mod_conv}}; info_queue[#info_queue+1] = G.P_CENTERS[_c.config.mod_conv]
       elseif _c.name == "The Tower" then loc_vars = {_c.config.max_highlighted, localize{type = 'name_text', set = 'Enhanced', key = _c.config.mod_conv}}; info_queue[#info_queue+1] = G.P_CENTERS[_c.config.mod_conv]
       elseif _c.name == "The Star" then loc_vars = {_c.config.max_highlighted,  localize(_c.config.suit_conv, 'suits_plural'), colours = {G.C.SUITS[_c.config.suit_conv]}}
       elseif _c.name == "The Moon" then loc_vars = {_c.config.max_highlighted, localize(_c.config.suit_conv, 'suits_plural'), colours = {G.C.SUITS[_c.config.suit_conv]}}
       elseif _c.name == "The Sun" then loc_vars = {_c.config.max_highlighted, localize(_c.config.suit_conv, 'suits_plural'), colours = {G.C.SUITS[_c.config.suit_conv]}}
       elseif _c.name == "Judgement" then
       elseif _c.name == "The World" then loc_vars = {_c.config.max_highlighted, localize(_c.config.suit_conv, 'suits_plural'), colours = {G.C.SUITS[_c.config.suit_conv]}}
       end
       localize{type = 'descriptions', key = _c.key, set = _c.set, nodes = desc_nodes, vars = loc_vars}
   end

    if main_end then 
        desc_nodes[#desc_nodes+1] = main_end 
    end

   --Fill all remaining info if this is the main desc
    if not ((specific_vars and not specific_vars.sticker) and (card_type == 'Default' or card_type == 'Enhanced')) then
        if desc_nodes == full_UI_table.main and not full_UI_table.name then
            localize{type = 'name', key = _c.key, set = _c.set, nodes = full_UI_table.name} 
            if not full_UI_table.name then full_UI_table.name = {} end
        elseif desc_nodes ~= full_UI_table.main then 
            desc_nodes.name = localize{type = 'name_text', key = name_override or _c.key, set = name_override and 'Other' or _c.set} 
        end
    end

    if first_pass and not (_c.set == 'Edition') and badges then
        for k, v in ipairs(badges) do
            if v == 'foil' then info_queue[#info_queue+1] = G.P_CENTERS['e_foil'] end
            if v == 'holographic' then info_queue[#info_queue+1] = G.P_CENTERS['e_holo'] end
            if v == 'polychrome' then info_queue[#info_queue+1] = G.P_CENTERS['e_polychrome'] end
            if v == 'negative' then info_queue[#info_queue+1] = G.P_CENTERS['e_negative'] end
            if v == 'negative_consumable' then info_queue[#info_queue+1] = {key = 'e_negative_consumable', set = 'Edition', config = {extra = 1}} end
            if v == 'gold_seal' then info_queue[#info_queue+1] = {key = 'gold_seal', set = 'Other'} end
            if v == 'blue_seal' then info_queue[#info_queue+1] = {key = 'blue_seal', set = 'Other'} end
            if v == 'red_seal' then info_queue[#info_queue+1] = {key = 'red_seal', set = 'Other'} end
            if v == 'purple_seal' then info_queue[#info_queue+1] = {key = 'purple_seal', set = 'Other'} end
            if v == 'eternal' then info_queue[#info_queue+1] = {key = 'eternal', set = 'Other'} end
            if v == 'perishable' then info_queue[#info_queue+1] = {key = 'perishable', set = 'Other', vars = {G.GAME.perishable_rounds or 1, specific_vars.perish_tally or G.GAME.perishable_rounds}} end
            if v == 'rental' then info_queue[#info_queue+1] = {key = 'rental', set = 'Other', vars = {G.GAME.rental_rate or 1}} end
            if v == 'pinned_left' then info_queue[#info_queue+1] = {key = 'pinned_left', set = 'Other'} end
        end
    end

    for _, v in ipairs(info_queue) do
        generate_card_ui(v, full_UI_table)
    end

    return full_UI_table
end
