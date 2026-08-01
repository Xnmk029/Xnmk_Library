--Create a global UIDEF that contains all UI definition functions\
--As a rule, these contain functions that return a table T representing the definition for a UIBox
G.UIDEF = {}

function create_UIBox_debug_tools()
  G.debug_tool_config = G.debug_tool_config or {}
  G.FUNCS.DT_add_money = function() if G.STAGE == G.STAGES.RUN then ease_dollars(10) end end
  G.FUNCS.DT_add_round = function() if G.STAGE == G.STAGES.RUN then  ease_round(1) end end
  G.FUNCS.DT_add_ante = function() if G.STAGE == G.STAGES.RUN then  ease_ante(1) end end
  G.FUNCS.DT_add_hand = function() if G.STAGE == G.STAGES.RUN then  ease_hands_played(1) end end
  G.FUNCS.DT_add_discard = function() if G.STAGE == G.STAGES.RUN then  ease_discard(1) end end
  G.FUNCS.DT_reroll_boss = function() if G.STAGE == G.STAGES.RUN and G.blind_select_opts then G.from_boss_tag = true; G.FUNCS.reroll_boss(); G.from_boss_tag = nil end end
  G.FUNCS.DT_toggle_background = function() G.debug_background_toggle = not G.debug_background_toggle end
  G.FUNCS.DT_add_chips = function() if G.STAGE == G.STAGES.RUN then update_hand_text({delay = 0}, {chips = 10 + G.GAME.current_round.current_hand.chips}); play_sound('chips1') end end
  G.FUNCS.DT_add_mult = function() if G.STAGE == G.STAGES.RUN then update_hand_text({delay = 0}, {mult = 10 + G.GAME.current_round.current_hand.mult}); play_sound('multhit1') end end
  G.FUNCS.DT_x_chips = function() if G.STAGE == G.STAGES.RUN then update_hand_text({delay = 0}, {chips = 2*G.GAME.current_round.current_hand.chips}); play_sound('chips1') end end
  G.FUNCS.DT_x_mult = function() if G.STAGE == G.STAGES.RUN then update_hand_text({delay = 0}, {mult = 10*G.GAME.current_round.current_hand.mult}); play_sound('multhit2') end end
  G.FUNCS.DT_chip_mult_reset = function() if G.STAGE == G.STAGES.RUN then update_hand_text({delay = 0}, {mult = 0, chips = 0}) end end
  G.FUNCS.DT_win_game = function() if G.STAGE == G.STAGES.RUN then win_game() end end
  G.FUNCS.DT_lose_game = function() if G.STAGE == G.STAGES.RUN then G.STATE = G.STATES.GAME_OVER; G.STATE_COMPLETE = false end end
  G.FUNCS.DT_jimbo_toggle = function() 
    if G.DT_jimbo then 
      if G.DT_jimbo.children.particles.states.visible then
        if G.DT_jimbo.children.card.states.visible then
          G.DT_jimbo.children.card.states.visible = false
        else
          G.DT_jimbo.children.card.states.visible = true
          G.DT_jimbo.children.particles.states.visible = false
        end
      else
        G.DT_jimbo:remove()
        G.DT_jimbo = nil
        if G.SPLASH_LOGO then 
          G.SPLASH_LOGO.states.visible = true
          if G.title_top and G.title_top.cards[1] then G.title_top.cards[1].states.visible = true end
        end
      end
    else
      if G.SPLASH_LOGO then 
        G.SPLASH_LOGO.states.visible = false
        if G.title_top and G.title_top.cards[1] then G.title_top.cards[1].states.visible = false end
      end
      G.E_MANAGER:add_event(Event({
        trigger = 'after',
        delay = 0.4,
        blockable = false,
        func = function()
            G.DT_jimbo = Card_Character({x = G.ROOM.T.w/2,y = G.ROOM.T.h/2}) 

            G.DT_jimbo:set_alignment{
                                  major = G.ROOM_ATTACH,
                                  type = 'cm'
                              }
                        return true
                end
            }))

    end end
    G.FUNCS.DT_jimbo_talk = function() 
      if G.DT_jimbo then
        G.DT_jimbo:add_speech_bubble({
          "                             ",
          "           ",
          "           ",
      }, 'cr')
        G.DT_jimbo:say_stuff(4) end
    end

    local t = {n=G.UIT.ROOT, config = {align = 'cm', r = 0.1}, nodes={
      UIBox_dyn_container({
      {n=G.UIT.R, config={align = "cm", padding = 0.05}, nodes={
        {n=G.UIT.R, config={align = "cm", padding = 0.05}, nodes={
          {n=G.UIT.T, config={text = "While in collection, hover over a card", scale = 0.25, colour = G.C.WHITE, shadow = true}}
        }},
        {n=G.UIT.R, config={align = "cm", padding = 0.05}, nodes={
          {n=G.UIT.T, config={text = "and press the following keys:", scale = 0.25, colour = G.C.WHITE, shadow = true}}
        }},
        {n=G.UIT.R, config={align = "cm", padding = 0.05}, nodes={
          {n=G.UIT.C, config={align = "cm", padding = 0.05, colour = G.C.BLUE, emboss = 0.05, r = 0.1}, nodes={
            {n=G.UIT.T, config={text = "[1] Unlock", scale = 0.25, colour = G.C.WHITE}}
          }},
          {n=G.UIT.C, config={align = "cm", padding = 0.05, colour = G.C.BLUE, emboss = 0.05, r = 0.1}, nodes={
            {n=G.UIT.T, config={text = "[2] Discover", scale = 0.25, colour = G.C.WHITE}}
          }},
          {n=G.UIT.C, config={align = "cm", padding = 0.05, colour = G.C.BLUE, emboss = 0.05, r = 0.1}, nodes={
            {n=G.UIT.T, config={text = "[3] Spawn", scale = 0.25, colour = G.C.WHITE}}
          }}
        }}
      }},
      {n=G.UIT.R, config={align = "cm", padding = 0.05}, nodes={
        {n=G.UIT.R, config={align = "cm", padding = 0.05}, nodes={
          {n=G.UIT.T, config={text = "Hover over any Joker/Playing card", scale = 0.25, colour = G.C.WHITE, shadow = true}}
        }},
        {n=G.UIT.R, config={align = "cm", padding = 0.05}, nodes={
          {n=G.UIT.T, config={text = "and press [Q] to cycle Edition", scale = 0.25, colour = G.C.WHITE, shadow = true}}
        }},
      }},
      {n=G.UIT.R, config={align = "cm", padding = 0.05}, nodes={
        {n=G.UIT.R, config={align = "cm", padding = 0.05}, nodes={
          {n=G.UIT.T, config={text = "Press [H] to isolate background", scale = 0.25, colour = G.C.WHITE, shadow = true}}
        }},
      }},
      {n=G.UIT.R, config={align = "cm", padding = 0.05}, nodes={
        {n=G.UIT.R, config={align = "cm", padding = 0.05}, nodes={
          {n=G.UIT.T, config={text = "Press [J] to play splash animation", scale = 0.25, colour = G.C.WHITE, shadow = true}}
        }},
      }},
      {n=G.UIT.R, config={align = "cm", padding = 0.05}, nodes={
        {n=G.UIT.R, config={align = "cm", padding = 0.05}, nodes={
          {n=G.UIT.T, config={text = "Press [8] to toggle cursor", scale = 0.25, colour = G.C.WHITE, shadow = true}}
        }},
      }},
      {n=G.UIT.R, config={align = "cm", padding = 0.05}, nodes={                  
        {n=G.UIT.R, config={align = "cm", padding = 0.05}, nodes={
          {n=G.UIT.T, config={text = "Press [9] to toggle all tooltips", scale = 0.25, colour = G.C.WHITE, shadow = true}}
        }},
      }},
      {n=G.UIT.R, config={align = "cm", padding = 0.15}, nodes={
        {n=G.UIT.C, config={align = "cm", padding = 0.15}, nodes={
          UIBox_button{ label = {"$10"}, button = "DT_add_money", minw = 1.7, minh = 0.4, scale = 0.35},
          UIBox_button{ label = {"+1 Round"}, button = "DT_add_round", minw = 1.7, minh = 0.4, scale = 0.35},
          UIBox_button{ label = {"+1 Ante"}, button = "DT_add_ante", minw = 1.7, minh = 0.4, scale = 0.35},
          UIBox_button{ label = {"+1 Hand"}, button = "DT_add_hand", minw = 1.7, minh = 0.4, scale = 0.35},
          UIBox_button{ label = {"+1 Discard"}, button = "DT_add_discard", minw = 1.7, minh = 0.4, scale = 0.35},
          UIBox_button{ label = {"Boss Reroll"}, button = "DT_reroll_boss", minw = 1.7, minh = 0.4, scale = 0.35},
          UIBox_button{ label = {"Background"}, button = "DT_toggle_background", minw = 1.7, minh = 0.4, scale = 0.35},
        }},
        {n=G.UIT.C, config={align = "cm", padding = 0.15}, nodes={
          UIBox_button{ label = {"+10 chips"}, button = "DT_add_chips", minw = 1.7, minh = 0.4, scale = 0.35},
          UIBox_button{ label = {"+10 mult"}, button = "DT_add_mult", minw = 1.7, minh = 0.4, scale = 0.35},
          UIBox_button{ label = {"X2 chips"}, button = "DT_x_chips", minw = 1.7, minh = 0.4, scale = 0.35},
          UIBox_button{ label = {"X10 mult"}, button = "DT_x_mult", minw = 1.7, minh = 0.4, scale = 0.35},
          UIBox_button{ label = {"Win this Run"}, button = "DT_win_game", minw = 1.7, minh = 0.4, scale = 0.35},
          UIBox_button{ label = {"Lose this Run"}, button = "DT_lose_game", minw = 1.7, minh = 0.4, scale = 0.35},
          UIBox_button{ label = {"Reset"}, button = "DT_chip_mult_reset", minw = 1.7, minh = 0.4, scale = 0.35},
          UIBox_button{ label = {"Jimbo"}, button = "DT_jimbo_toggle", minw = 1.7, minh = 0.4, scale = 0.35},
          UIBox_button{ label = {"Jimbo talk"}, button = "DT_jimbo_talk", minw = 1.7, minh = 0.4, scale = 0.35},
        }}
      }}
      }, true)
  }}
  return t
end

function create_UIBox_notify_alert(_achievement, _type)
  local _c, _atlas = G.P_CENTERS[_achievement],
    _type == 'Joker' and G.ASSET_ATLAS["Joker"] or
    _type == 'Voucher' and G.ASSET_ATLAS["Voucher"] or
    _type == 'Back' and G.ASSET_ATLAS["centers"] or
    G.ASSET_ATLAS["icons"]

  local t_s = Sprite(0,0,1.5*(_atlas.px/_atlas.py),1.5,_atlas, _c and _c.pos or {x=3, y=0})
  t_s.states.drag.can = false
  t_s.states.hover.can = false
  t_s.states.collide.can = false
 
  local subtext = _type == 'achievement' and localize(G.F_TROPHIES and 'k_trophy' or 'k_achievement') or
    _type == 'Joker' and localize('k_joker') or 
    _type == 'Voucher' and localize('k_voucher') or
    _type == 'Back' and localize('k_deck') or 'ERROR'

  if _achievement == 'b_challenge' then subtext = localize('k_challenges') end
  local name = _type == 'achievement' and localize(_achievement, 'achievement_names') or 'ERROR'

    local t = {n=G.UIT.ROOT, config = {align = 'cl', r = 0.1, padding = 0.06, colour = G.C.UI.TRANSPARENT_DARK}, nodes={
    {n=G.UIT.R, config={align = "cl", padding = 0.2, minw = 20, r = 0.1, colour = G.C.BLACK, outline = 1.5, outline_colour = G.C.GREY}, nodes={
      {n=G.UIT.R, config={align = "cm", r = 0.1}, nodes={
        {n=G.UIT.R, config={align = "cm", r = 0.1}, nodes={
          {n=G.UIT.O, config={object = t_s}},
        }},
        _type ~= 'achievement' and {n=G.UIT.R, config={align = "cm", padding = 0.04}, nodes={
          {n=G.UIT.R, config={align = "cm", maxw = 3.4}, nodes={
            {n=G.UIT.T, config={text = subtext, scale = 0.5, colour = G.C.FILTER, shadow = true}},
          }},
          {n=G.UIT.R, config={align = "cm", maxw = 3.4}, nodes={
            {n=G.UIT.T, config={text = localize('k_unlocked_ex'), scale = 0.35, colour = G.C.FILTER, shadow = true}},
          }}
        }}
        or {n=G.UIT.R, config={align = "cm", padding = 0.04}, nodes={
          {n=G.UIT.R, config={align = "cm", maxw = 3.4, padding = 0.1}, nodes={
            {n=G.UIT.T, config={text = name, scale = 0.4, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
          }},
          {n=G.UIT.R, config={align = "cm", maxw = 3.4}, nodes={
            {n=G.UIT.T, config={text = subtext, scale = 0.3, colour = G.C.FILTER, shadow = true}},
          }},
          {n=G.UIT.R, config={align = "cm", maxw = 3.4}, nodes={
            {n=G.UIT.T, config={text = localize('k_unlocked_ex'), scale = 0.35, colour = G.C.FILTER, shadow = true}},
          }}
        }}
      }}
    }}
  }}
  return t
end

function create_UIBox_online_high_scores()
  G.HTTP_MANAGER.out_channel:push({get_score = true})
  local padding, col, minw = 0.05, G.C.UI.TRANSPARENT_DARK, 0
    local t = {n=G.UIT.ROOT, config = {align = 'cm', minw=minw, r = 0.1, colour = col, padding = padding}, nodes={
        {n=G.UIT.R, config={align = "cm", padding = 0.1, r = 0.1, colour = G.C.BLACK}, nodes={
      }}
  }}
  return t
end

function create_UIBox_high_scores_filling(_resp)
  local scores = {}
  _resp = assert(loadstring(_resp))()
  if not _resp then 
    return {n=G.UIT.ROOT, config = {align = 'cm', r = 0.1, colour = G.C.L_BLACK, padding = 0.05}, nodes={
      {n=G.UIT.R, config={align = "cm", padding = 0.1, minh = 1.3}, nodes={
        {n=G.UIT.T, config={text = 'ERROR', scale = 0.9, colour = G.C.RED, shadow = true}},
      }}
    }}
  end
  for i = 1, 6 do
    local v = _resp[i] or {username = '-'}
    v.score = v.score and math.floor(v.score) or nil
    local name_col = v.username == (G.SETTINGS.COMP and G.SETTINGS.COMP.name or nil) and G.C.FILTER or G.C.WHITE
    scores[#scores+1] = {n=G.UIT.R, config={align = "cm", padding = 0.05}, nodes={
      {n=G.UIT.C, config={align = "cl", padding = 0, minw = 0.3}, nodes={
        {n=G.UIT.T, config={text = i..'.', scale = 0.5, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
      }},
      {n=G.UIT.C, config={align = "cl", padding = 0, minw = 1.7, maxw = 1.6}, nodes={
        {n=G.UIT.T, config={text = (v.username), scale = math.min(0.6, 8*0.56/v.username:len()), colour = v.score and name_col or G.C.UI.TRANSPARENT_LIGHT, shadow = true}}
      }},
      {n=G.UIT.C, config={align = "cl", minh = 0.8, r = 0.1, minw = 2.5, colour = G.C.BLACK, emboss = 0.05}, nodes={
        {n=G.UIT.C, config={align = "cm", padding = 0.05, r = 0.1, minw = 2.6}, nodes={
          {n=G.UIT.C, config={align = "cm"}, nodes={
            {n=G.UIT.O, config={object = DynaText({string = {type(v.score) == 'number' and number_format(v.score) or ''}, colours = {G.C.RED},shadow = true, float = true,maxw = 2.5, scale = math.min(0.75, score_number_scale(1.5, v.score))})}},
          }},
        }},
      }},
    }}
  end
  return {n=G.UIT.ROOT, config = {align = 'cm', r = 0.1, colour = G.C.L_BLACK, padding = 0.05}, nodes=scores}
end

function G.UIDEF.use_and_sell_buttons(card)
  local sell = nil
  local use = nil
  if card.area and card.area.config.type == 'joker' then
    sell = {n=G.UIT.C, config={align = "cr"}, nodes={
      {n=G.UIT.C, config={ref_table = card, align = "cr",padding = 0.1, r=0.08, minw = 1.25, hover = true, shadow = true, colour = G.C.UI.BACKGROUND_INACTIVE, one_press = true, button = 'sell_card', func = 'can_sell_card'}, nodes={
        {n=G.UIT.B, config = {w=0.1,h=0.6}},
        {n=G.UIT.C, config={align = "tm"}, nodes={
          {n=G.UIT.R, config={align = "cm", maxw = 1.25}, nodes={
            {n=G.UIT.T, config={text = localize('b_sell'),colour = G.C.UI.TEXT_LIGHT, scale = 0.4, shadow = true}}
          }},
          {n=G.UIT.R, config={align = "cm"}, nodes={
            {n=G.UIT.T, config={text = localize('$'),colour = G.C.WHITE, scale = 0.4, shadow = true}},
            {n=G.UIT.T, config={ref_table = card, ref_value = 'sell_cost_label',colour = G.C.WHITE, scale = 0.55, shadow = true}}
          }}
        }}
      }},
    }}
  end
  if card.ability.consumeable then
    if (card.area == G.pack_cards and G.pack_cards) then
      return {
        n=G.UIT.ROOT, config = {padding = 0, colour = G.C.CLEAR}, nodes={
          {n=G.UIT.R, config={mid = true}, nodes={
          }},
          {n=G.UIT.R, config={ref_table = card, r = 0.08, padding = 0.1, align = "bm", minw = 0.5*card.T.w - 0.15, minh = 0.8*card.T.h, maxw = 0.7*card.T.w - 0.15, hover = true, shadow = true, colour = G.C.UI.BACKGROUND_INACTIVE, one_press = true, button = 'use_card', func = 'can_use_consumeable'}, nodes={
            {n=G.UIT.T, config={text = localize('b_use'),colour = G.C.UI.TEXT_LIGHT, scale = 0.55, shadow = true}}
          }},
      }}
    end
    use = 
    {n=G.UIT.C, config={align = "cr"}, nodes={
      
      {n=G.UIT.C, config={ref_table = card, align = "cr",maxw = 1.25, padding = 0.1, r=0.08, minw = 1.25, minh = (card.area and card.area.config.type == 'joker') and 0 or 1, hover = true, shadow = true, colour = G.C.UI.BACKGROUND_INACTIVE, one_press = true, button = 'use_card', func = 'can_use_consumeable'}, nodes={
        {n=G.UIT.B, config = {w=0.1,h=0.6}},
        {n=G.UIT.T, config={text = localize('b_use'),colour = G.C.UI.TEXT_LIGHT, scale = 0.55, shadow = true}}
      }}
    }}
  elseif card.area and card.area == G.pack_cards then
    return {
      n=G.UIT.ROOT, config = {padding = 0, colour = G.C.CLEAR}, nodes={
        {n=G.UIT.R, config={ref_table = card, r = 0.08, padding = 0.1, align = "bm", minw = 0.5*card.T.w - 0.15, maxw = 0.9*card.T.w - 0.15, minh = 0.3*card.T.h, hover = true, shadow = true, colour = G.C.UI.BACKGROUND_INACTIVE, one_press = true, button = 'use_card', func = 'can_select_card'}, nodes={
          {n=G.UIT.T, config={text = localize('b_select'),colour = G.C.UI.TEXT_LIGHT, scale = 0.45, shadow = true}}
        }},
    }}
  end
    local t = {
      n=G.UIT.ROOT, config = {padding = 0, colour = G.C.CLEAR}, nodes={
        {n=G.UIT.C, config={padding = 0.15, align = 'cl'}, nodes={
          {n=G.UIT.R, config={align = 'cl'}, nodes={
            sell
          }},
          {n=G.UIT.R, config={align = 'cl'}, nodes={
            use
          }},
        }},
    }}
  return t
end

function G.UIDEF.card_focus_ui(card)
  local card_width = card.T.w + (card.ability.consumeable and -0.1 or card.ability.set == 'Voucher' and -0.16 or 0)

  local playing_card_colour = copy_table(G.C.WHITE)
  playing_card_colour[4] = 1.5
  if G.hand and card.area == G.hand then ease_value(playing_card_colour, 4, -1.5, nil, 'REAL',nil, 0.2, 'quad') end

  local tcnx, tcny = card.T.x + card.T.w/2 - G.ROOM.T.w/2, card.T.y + card.T.h/2 - G.ROOM.T.h/2

  local base_background = UIBox{
    T = {card.VT.x,card.VT.y,0,0},
    definition = 
      (not G.hand or card.area ~= G.hand) and {n=G.UIT.ROOT, config = {align = 'cm', minw = card_width + 0.3, minh = card.T.h + 0.3, r = 0.1, colour = adjust_alpha(G.C.BLACK, 0.7), outline_colour = lighten(G.C.JOKER_GREY, 0.5), outline = 1.5, line_emboss = 0.8}, nodes={
        {n=G.UIT.R, config={id = 'ATTACH_TO_ME'}, nodes={}}
      }} or 
      {n=G.UIT.ROOT, config = {align = 'cm', minw = card_width, minh = card.T.h, r = 0.1, colour = playing_card_colour}, nodes={
        {n=G.UIT.R, config={id = 'ATTACH_TO_ME'}, nodes={}}
      }},
    config = {
        align = 'cm',
        offset = {x= 0.007*tcnx*card.T.w, y = 0.007*tcny*card.T.h}, 
        parent = card,
        r_bond = (not G.hand or card.area ~= G.hand) and 'Weak' or 'Strong'
      }
  }

  base_background.set_alignment = function()
    local cnx, cny = card.T.x + card.T.w/2 - G.ROOM.T.w/2, card.T.y + card.T.h/2 - G.ROOM.T.h/2
    Moveable.set_alignment(card.children.focused_ui, {offset = {x= 0.007*cnx*card.T.w, y = 0.007*cny*card.T.h}})
  end

  local base_attach = base_background:get_UIE_by_ID('ATTACH_TO_ME')

  --The card UI can have BUY, REDEEM, USE, and SELL buttons depending on the context of the card
  if card.area == G.shop_jokers and G.shop_jokers then --Add a buy button
    local buy_and_use = nil
    if card.ability.consumeable then 
      base_attach.children.buy_and_use = G.UIDEF.card_focus_button{
        card = card, parent = base_attach, type = 'buy_and_use',
        func = 'can_buy_and_use', button = 'buy_from_shop', card_width = card_width
      }
      buy_and_use = true
    end
    base_attach.children.buy = G.UIDEF.card_focus_button{
      card = card, parent = base_attach, type = 'buy',
      func = 'can_buy', button = 'buy_from_shop', card_width = card_width, buy_and_use = buy_and_use
    }
  end
  if card.area == G.shop_vouchers and G.shop_vouchers then --Add a redeem button
    base_attach.children.redeem = G.UIDEF.card_focus_button{
      card = card, parent = base_attach, type = 'buy',
      func = 'can_redeem', button = 'redeem_from_shop', card_width = card_width
    }
  end
  if card.area == G.shop_booster and G.shop_booster then --Add a redeem button
    base_attach.children.redeem = G.UIDEF.card_focus_button{
      card = card, parent = base_attach, type = 'buy',
      func = 'can_open', button = 'open_booster', card_width = card_width*0.85
    }
  end
  if ((card.area == G.consumeables and G.consumeables) or (card.area == G.pack_cards and G.pack_cards)) and
  card.ability.consumeable then --Add a use button
    base_attach.children.use = G.UIDEF.card_focus_button{
      card = card, parent = base_attach, type = 'use',
      func = 'can_use_consumeable', button = 'use_card', card_width = card_width
    }
  end
  if (card.area == G.pack_cards and G.pack_cards) and not card.ability.consumeable then --Add a use button
    base_attach.children.use = G.UIDEF.card_focus_button{
      card = card, parent = base_attach, type = 'select',
      func = 'can_select_card', button = 'use_card', card_width = card_width
    }
  end
  if (card.area == G.jokers and G.jokers or card.area == G.consumeables and G.consumeables) and G.STATE ~= G.STATES.TUTORIAL then --Add a sell button
    base_attach.children.sell = G.UIDEF.card_focus_button{
      card = card, parent = base_attach, type = 'sell',
      func = 'can_sell_card', button = 'sell_card', card_width = card_width
    }
  end

  return base_background
end

function G.UIDEF.card_focus_button(args)
  if not args then return end

  local button_contents = {}
  if args.type == 'sell' then 
    button_contents = 
    {n=G.UIT.C, config={align = "cl"}, nodes={
      {n=G.UIT.R, config={align = "cl", maxw = 1}, nodes={
        {n=G.UIT.T, config={text = localize('b_sell'),colour = G.C.UI.TEXT_LIGHT, scale = 0.4, shadow = true}}
      }},
      {n=G.UIT.R, config={align = "cl"}, nodes={
        {n=G.UIT.T, config={text = localize('$'),colour = G.C.WHITE, scale = 0.4, shadow = true}},
        {n=G.UIT.T, config={ref_table = args.card, ref_value = 'sell_cost_label',colour = G.C.WHITE, scale = 0.55, shadow = true}}
      }}
    }}
  elseif args.type == 'buy' then 
    button_contents = {n=G.UIT.T, config={text = localize('b_buy'),colour = G.C.WHITE, scale = 0.5}}
  elseif args.type == 'select' then 
    button_contents = {n=G.UIT.T, config={text = localize('b_select'),colour = G.C.WHITE, scale = 0.3}}
  elseif args.type == 'redeem' then 
    button_contents = {n=G.UIT.T, config={text = localize('b_redeem'),colour = G.C.WHITE, scale = 0.5}}
  elseif args.type == 'use' then
    button_contents = {n=G.UIT.T, config={text = localize('b_use'),colour = G.C.WHITE, scale = 0.5}}
  elseif args.type == 'buy_and_use' then
    button_contents = 
    {n=G.UIT.C, config={align = "cr"}, nodes={
      {n=G.UIT.R, config={align = "cr", maxw = 1}, nodes={
        {n=G.UIT.T, config={text = localize('b_buy'),colour = G.C.UI.TEXT_LIGHT, scale = 0.4, shadow = true}}
      }},
      {n=G.UIT.R, config={align = "cr", maxw = 1}, nodes={
        {n=G.UIT.T, config={text = localize('b_and_use'),colour = G.C.WHITE, scale = 0.3, shadow = true}},
      }}
    }}
  end

  return UIBox{
    T = {args.card.VT.x,args.card.VT.y,0,0},
    definition = 
      {n=G.UIT.ROOT, config = {align = 'cm', colour = G.C.CLEAR}, nodes={
        {n=G.UIT.R, config={id = args.type == 'buy_and_use' and 'buy_and_use' or nil, ref_table = args.card, ref_parent = args.parent, align =  args.type == 'sell' and 'cl' or 'cr', colour = G.C.BLACK, shadow = true, r = 0.08, func = args.func, one_press = true, button = args.button, focus_args = {type = 'none'}, hover = true}, nodes={
          {n=G.UIT.R, config={align = args.type == 'sell' and 'cl' or 'cr', minw = 1 + (args.type == 'select' and 0.1 or 0), minh = args.type == 'sell' and 1.5 or 1, padding = 0.08,
              focus_args = {button = args.type == 'sell' and 'leftshoulder' or args.type == 'buy_and_use' and 'leftshoulder' or 'rightshoulder', scale = 0.55, orientation = args.type == 'sell' and 'tli' or 'tri', offset = {x = args.type == 'sell' and 0.1 or -0.1, y = 0}, type = 'none'},
              func = 'set_button_pip'}, nodes={
            {n=G.UIT.R, config={align = "cm", minh = 0.3}, nodes={}},
            {n=G.UIT.R, config={align = "cm"}, nodes={
              args.type ~= 'sell' and {n=G.UIT.C, config={align = "cm",minw = 0.2, minh = 0.6}, nodes={}} or nil,
              {n=G.UIT.C, config={align = "cm", maxw = 1}, nodes={
                button_contents
              }},
              args.type == 'sell' and {n=G.UIT.C, config={align = "cm",minw = 0.2, minh = 0.6}, nodes={}} or nil,
            }}
          }}
        }}
      }}, 
    config = {
        align = args.type == 'sell' and 'cl' or 'cr',
        offset = {x=(args.type == 'sell' and -1 or 1)*((args.card_width or 0) - 0.17 - args.card.T.w/2),y=args.type == 'buy_and_use' and 0.6 or (args.buy_and_use) and -0.6 or 0}, 
        parent = args.parent,
      }
  }
end

function G.UIDEF.speech_bubble(text_key, loc_vars) 
  local text = {}
  if loc_vars and loc_vars.quip then
    localize{type = 'quips', key = text_key or 'lq_1', vars = loc_vars or {}, nodes = text}
  else
    localize{type = 'tutorial', key = text_key or 'sb_1', vars = loc_vars or {}, nodes = text}
  end
  local row = {}
  for k, v in ipairs(text) do
    row[#row+1] =  {n=G.UIT.R, config={align = "cl"}, nodes=v}
  end
  local t = {n=G.UIT.ROOT, config = {align = "cm", minh = 1,r = 0.3, padding = 0.07, minw = 1, colour = G.C.JOKER_GREY, shadow = true}, nodes={
                {n=G.UIT.C, config={align = "cm", minh = 1,r = 0.2, padding = 0.1, minw = 1, colour = G.C.WHITE}, nodes={
                {n=G.UIT.C, config={align = "cm", minh = 1,r = 0.2, padding = 0.03, minw = 1, colour = G.C.WHITE}, nodes=row}}
                }
              }}
  return t
end

function create_UIBox_highlight(rect)
  local t = {n=G.UIT.ROOT, config = {align = "cm", minh = rect.T.h+0.1, minw = rect.T.w+0.15, r = 0.15, colour = G.C.DARK_EDITION}, nodes={
  }}
return t
end

function G.UIDEF.deck_preview(args) 

  local _minh, _minw = 0.35, 0.5
  local suit_labels = {}
  local suit_counts = {
    Spades = 0,
    Hearts = 0,
    Clubs = 0,
    Diamonds = 0
  }
  local mod_suit_counts = {
    Spades = 0,
    Hearts = 0,
    Clubs = 0,
    Diamonds = 0
  }
  local mod_suit_diff = false
  local wheel_flipped, wheel_flipped_text = 0, nil
  local flip_col = G.C.WHITE
  local rank_counts = {}
  local deck_tables = {}
  remove_nils(G.playing_cards)
  table.sort(G.playing_cards, function (a, b) return a:get_nominal('suit') > b:get_nominal('suit') end )
  local SUITS = {
    Spades = {},
    Hearts = {},
    Clubs = {},
    Diamonds = {},
  }

  for k, v in pairs(SUITS) do
    for i = 1, 14 do
      SUITS[k][#SUITS[k]+1] = {}
    end
  end

  local suit_map = {'Spades', 'Hearts', 'Clubs', 'Diamonds'}
  local stones = nil
  local rank_name_mapping = {'A','K','Q','J','10',9,8,7,6,5,4,3,2}

  for k, v in ipairs(G.playing_cards) do
    if v.ability.effect == 'Stone Card' then
      stones = stones or 0
    end
    if (v.area and v.area == G.deck) or v.ability.wheel_flipped then
      if v.ability.wheel_flipped then wheel_flipped = wheel_flipped + 1 end
      if v.ability.effect == 'Stone Card' then
        stones = stones + 1
      else
        for kk, vv in pairs(suit_counts) do
          if v.base.suit == kk then suit_counts[kk] = suit_counts[kk] + 1 end
          if v:is_suit(kk) then mod_suit_counts[kk] = mod_suit_counts[kk] + 1 end
        end
        if SUITS[v.base.suit][v.base.id] then
          table.insert(SUITS[v.base.suit][v.base.id], v)
        end
        rank_counts[v.base.id] = (rank_counts[v.base.id] or 0) + 1
      end
    end
  end

  wheel_flipped_text = (wheel_flipped > 0) and {n=G.UIT.T, config={text = '?',colour = G.C.FILTER, scale =0.25, shadow = true}} or nil
  flip_col = wheel_flipped_text and mix_colours(G.C.FILTER, G.C.WHITE,0.7) or G.C.WHITE

  suit_labels[#suit_labels+1] = {n=G.UIT.R, config={align = "cm", r = 0.1, padding = 0.04, minw = _minw, minh = 2*_minh+0.25}, nodes={
    stones and {n=G.UIT.T, config={text = localize('ph_deck_preview_stones')..': ',colour = G.C.WHITE, scale =0.25, shadow = true}}
    or nil,
    stones and {n=G.UIT.T, config={text = ''..stones,colour = (stones > 0 and G.C.WHITE or G.C.UI.TRANSPARENT_LIGHT), scale =0.4, shadow = true}}
    or nil,
  }}
  
  local _row = {}
  local _bg_col = G.C.JOKER_GREY
  for k, v in ipairs(rank_name_mapping) do
    local _tscale = 0.3
    local _colour = G.C.BLACK
    local rank_col = v == 'A' and _bg_col or (v == 'K' or v == 'Q' or v == 'J') and G.C.WHITE or _bg_col
    rank_col = mix_colours(rank_col, _bg_col, 0.8)
    
    local _col = {n=G.UIT.C, config={align = "cm"}, nodes={
      {n=G.UIT.C, config={align = "cm", r = 0.1, minw = _minw, minh = _minh, colour = rank_col, emboss = 0.04, padding = 0.03}, nodes={
      {n=G.UIT.R, config={align = "cm"}, nodes={
        {n=G.UIT.T, config={text = ''..v,colour = _colour, scale =1.6*_tscale}},
      }},
      {n=G.UIT.R, config={align = "cm", minw = _minw+0.04, minh = _minh, colour = G.C.L_BLACK, r = 0.1}, nodes={
        {n=G.UIT.T, config={text = ''..(rank_counts[15 - k] or 0),colour = flip_col, scale =_tscale, shadow = true}}
      }}
    }}
  }}
    table.insert(_row, _col)
  end
  table.insert(deck_tables, {n=G.UIT.R, config={align = "cm", padding = 0.04}, nodes=_row})

  for j = 1, 4 do
      _row = {}
      _bg_col = mix_colours(G.C.SUITS[suit_map[j]], G.C.L_BLACK, 0.7)
      for i = 14, 2, -1 do
        local _tscale = #SUITS[suit_map[j]][i] > 0 and 0.3 or 0.25
        local _colour = #SUITS[suit_map[j]][i] > 0 and flip_col or G.C.UI.TRANSPARENT_LIGHT
        
        local _col = {n=G.UIT.C, config={align = "cm",padding = 0.05, minw = _minw+0.098, minh = _minh}, nodes={
          {n=G.UIT.T, config={text = ''..#SUITS[suit_map[j]][i],colour = _colour, scale =_tscale, shadow = true, lang = G.LANGUAGES['en-us']}},
        }}
        table.insert(_row, _col)
      end
      table.insert(deck_tables, {n=G.UIT.R, config={align = "cm", r = 0.1, padding = 0.04, minh = 0.4, colour = _bg_col}, nodes=_row})
  end

  for k, v in ipairs(suit_map) do
    local _x = (v == 'Spades' and 3) or (v == 'Hearts' and 0) or (v == 'Clubs' and 2) or (v == 'Diamonds' and 1)
    local t_s = Sprite(0,0,0.3,0.3,G.ASSET_ATLAS["ui_"..(G.SETTINGS.colourblind_option and 2 or 1)], {x=_x, y=1})
    t_s.states.drag.can = false
    t_s.states.hover.can = false
    t_s.states.collide.can = false

    if mod_suit_counts[v] ~= suit_counts[v] then mod_suit_diff = true end

    suit_labels[#suit_labels+1] = 
    {n=G.UIT.R, config={align = "cm", r = 0.1, padding = 0.03, colour = G.C.JOKER_GREY}, nodes={
      {n=G.UIT.C, config={align = "cm", minw = _minw, minh = _minh}, nodes={
        {n=G.UIT.O, config={can_collide = false, object = t_s}}
      }},
      {n=G.UIT.C, config={align = "cm", minw = _minw*2.4, minh = _minh, colour = G.C.L_BLACK, r = 0.1}, nodes={
        {n=G.UIT.T, config={text = ''..suit_counts[v],colour = flip_col, scale =0.3, shadow = true, lang = G.LANGUAGES['en-us']}},
        mod_suit_counts[v] ~= suit_counts[v] and {n=G.UIT.T, config={text = ' ('..mod_suit_counts[v]..')',colour = mix_colours(G.C.BLUE, G.C.WHITE,0.7), scale =0.28, shadow = true, lang = G.LANGUAGES['en-us']}} or nil,
      }}
    }}
  end


  local t = 
  {n=G.UIT.ROOT, config={align = "cm", colour = G.C.JOKER_GREY, r = 0.1, emboss = 0.05, padding = 0.07}, nodes={
    {n=G.UIT.R, config={align = "cm", r = 0.1, emboss = 0.05, colour = G.C.BLACK, padding = 0.1}, nodes={
      {n=G.UIT.R, config={align = "cm"}, nodes={
        {n=G.UIT.C, config={align = "cm", padding = 0.04}, nodes=suit_labels},
        {n=G.UIT.C, config={align = "cm", padding = 0.02}, nodes=deck_tables}
      }},
      mod_suit_diff and {n=G.UIT.R, config={align = "cm"}, nodes={
        {n=G.UIT.C, config={padding = 0.3, r = 0.1, colour = mix_colours(G.C.BLUE, G.C.WHITE,0.7)}, nodes = {}},
        {n=G.UIT.T, config={text =' '..localize('ph_deck_preview_effective'),colour = G.C.WHITE, scale =0.3}},
      }} or nil,
      wheel_flipped_text and {n=G.UIT.R, config={align = "cm"}, nodes={
        {n=G.UIT.C, config={padding = 0.3, r = 0.1, colour = flip_col}, nodes = {}},
        {n=G.UIT.T, config={text =' '..(wheel_flipped > 1 and
          localize{type = 'variable', key = 'deck_preview_wheel_plural', vars = {wheel_flipped}} or
          localize{type = 'variable', key = 'deck_preview_wheel_singular', vars = {wheel_flipped}}),colour = G.C.WHITE, scale =0.3}},
      }} or nil,
    }}
  }}
  return t
end

function create_UIBox_character_button(args) 
  local button = args.button or "NONE"
  local func = args.func or nil
  local colour = args.colour or G.C.RED
  local update_func = args.update_func or nil

  local t = {n=G.UIT.ROOT, config = {align = "cm", padding = 0.1, colour = G.C.CLEAR}, nodes={
    {n=G.UIT.C, config={align = "tm", minw = 1.9, padding = 0.2, minh = 1.2, r = 0.1, hover = true, colour = colour, button = func, func = update_func, shadow = true, maxw = args.maxw}, nodes={
      {n=G.UIT.R, config={align = "cm", padding = 0}, nodes={
        {n=G.UIT.T, config={text = button, scale = 0.55, colour = G.C.UI.TEXT_LIGHT, focus_args = {button = 'x', orientation = 'bm'}, func = 'set_button_pip'}}
      }}
    }},
    }}
  return t
end
  
function G.UIDEF.shop()
    G.shop_jokers = CardArea(
      G.hand.T.x+0,
      G.hand.T.y+G.ROOM.T.y + 9,
      G.GAME.shop.joker_max*1.02*G.CARD_W,
      1.05*G.CARD_H, 
      {card_limit = G.GAME.shop.joker_max, type = 'shop', highlight_limit = 1})


    G.shop_vouchers = CardArea(
      G.hand.T.x+0,
      G.hand.T.y+G.ROOM.T.y + 9,
      2.1*G.CARD_W,
      1.05*G.CARD_H, 
      {card_limit = 1, type = 'shop', highlight_limit = 1})

    G.shop_booster = CardArea(
      G.hand.T.x+0,
      G.hand.T.y+G.ROOM.T.y + 9,
      2.4*G.CARD_W,
      1.15*G.CARD_H, 
      {card_limit = 2, type = 'shop', highlight_limit = 1, card_w = 1.27*G.CARD_W})

    local shop_sign = AnimatedSprite(0,0, 4.4, 2.2, G.ANIMATION_ATLAS['shop_sign'])
    shop_sign:define_draw_steps({
      {shader = 'dissolve', shadow_height = 0.05},
      {shader = 'dissolve'}
    })
    G.SHOP_SIGN = UIBox{
      definition = 
        {n=G.UIT.ROOT, config = {colour = G.C.DYN_UI.MAIN, emboss = 0.05, align = 'cm', r = 0.1, padding = 0.1}, nodes={
          {n=G.UIT.R, config={align = "cm", padding = 0.1, minw = 4.72, minh = 3.1, colour = G.C.DYN_UI.DARK, r = 0.1}, nodes={
            {n=G.UIT.R, config={align = "cm"}, nodes={
              {n=G.UIT.O, config={object = shop_sign}}
            }},
            {n=G.UIT.R, config={align = "cm"}, nodes={
              {n=G.UIT.O, config={object = DynaText({string = {localize('ph_improve_run')}, colours = {lighten(G.C.GOLD, 0.3)},shadow = true, rotate = true, float = true, bump = true, scale = 0.5, spacing = 1, pop_in = 1.5, maxw = 4.3})}}
            }},
          }},
        }},
      config = {
        align="cm",
        offset = {x=0,y=-15},
        major = G.HUD:get_UIE_by_ID('row_blind'),
        bond = 'Weak'
      }
    }
    G.E_MANAGER:add_event(Event({
      trigger = 'immediate',
      func = (function()
          G.SHOP_SIGN.alignment.offset.y = 0
          return true
      end)
    }))
    local t = {n=G.UIT.ROOT, config = {align = 'cl', colour = G.C.CLEAR}, nodes={
            UIBox_dyn_container({
                {n=G.UIT.C, config={align = "cm", padding = 0.1, emboss = 0.05, r = 0.1, colour = G.C.DYN_UI.BOSS_MAIN}, nodes={
                    {n=G.UIT.R, config={align = "cm", padding = 0.05}, nodes={
                      {n=G.UIT.C, config={align = "cm", padding = 0.1}, nodes={
                        {n=G.UIT.R,config={id = 'next_round_button', align = "cm", minw = 2.8, minh = 1.5, r=0.15,colour = G.C.RED, one_press = true, button = 'toggle_shop', hover = true,shadow = true}, nodes = {
                          {n=G.UIT.R, config={align = "cm", padding = 0.07, focus_args = {button = 'y', orientation = 'cr'}, func = 'set_button_pip'}, nodes={
                            {n=G.UIT.R, config={align = "cm", maxw = 1.3}, nodes={
                              {n=G.UIT.T, config={text = localize('b_next_round_1'), scale = 0.4, colour = G.C.WHITE, shadow = true}}
                            }},
                            {n=G.UIT.R, config={align = "cm", maxw = 1.3}, nodes={
                              {n=G.UIT.T, config={text = localize('b_next_round_2'), scale = 0.4, colour = G.C.WHITE, shadow = true}}
                            }}   
                          }},              
                        }},
                        {n=G.UIT.R, config={align = "cm", minw = 2.8, minh = 1.6, r=0.15,colour = G.C.GREEN, button = 'reroll_shop', func = 'can_reroll', hover = true,shadow = true}, nodes = {
                          {n=G.UIT.R, config={align = "cm", padding = 0.07, focus_args = {button = 'x', orientation = 'cr'}, func = 'set_button_pip'}, nodes={
                            {n=G.UIT.R, config={align = "cm", maxw = 1.3}, nodes={
                              {n=G.UIT.T, config={text = localize('k_reroll'), scale = 0.4, colour = G.C.WHITE, shadow = true}},
                            }},
                            {n=G.UIT.R, config={align = "cm", maxw = 1.3, minw = 1}, nodes={
                              {n=G.UIT.T, config={text = localize('$'), scale = 0.7, colour = G.C.WHITE, shadow = true}},
                              {n=G.UIT.T, config={ref_table = G.GAME.current_round, ref_value = 'reroll_cost', scale = 0.75, colour = G.C.WHITE, shadow = true}},
                            }}
                          }}
                        }},
                      }},
                      {n=G.UIT.C, config={align = "cm", padding = 0.2, r=0.2, colour = G.C.L_BLACK, emboss = 0.05, minw = 8.2}, nodes={
                          {n=G.UIT.O, config={object = G.shop_jokers}},
                      }},
                    }},
                    {n=G.UIT.R, config={align = "cm", minh = 0.2}, nodes={}},
                    {n=G.UIT.R, config={align = "cm", padding = 0.1}, nodes={
                      {n=G.UIT.C, config={align = "cm", padding = 0.15, r=0.2, colour = G.C.L_BLACK, emboss = 0.05}, nodes={
                        {n=G.UIT.C, config={align = "cm", padding = 0.2, r=0.2, colour = G.C.BLACK, maxh = G.shop_vouchers.T.h+0.4}, nodes={
                          {n=G.UIT.T, config={text = localize{type = 'variable', key = 'ante_x_voucher', vars = {G.GAME.round_resets.ante}}, scale = 0.45, colour = G.C.L_BLACK, vert = true}},
                          {n=G.UIT.O, config={object = G.shop_vouchers}},
                        }},
                      }},
                      {n=G.UIT.C, config={align = "cm", padding = 0.15, r=0.2, colour = G.C.L_BLACK, emboss = 0.05}, nodes={
                        {n=G.UIT.O, config={object = G.shop_booster}},
                      }},
                    }}
                }
              },
              
              }, false)
        }}
    return t
end
  
  function create_card_for_shop(area)
      if area == G.shop_jokers and G.SETTINGS.tutorial_progress and G.SETTINGS.tutorial_progress.forced_shop and G.SETTINGS.tutorial_progress.forced_shop[#G.SETTINGS.tutorial_progress.forced_shop] then
        local t = G.SETTINGS.tutorial_progress.forced_shop
        local _center = G.P_CENTERS[t[#t]] or G.P_CENTERS.c_empress
        local card = Card(area.T.x + area.T.w/2, area.T.y, G.CARD_W, G.CARD_H, G.P_CARDS.empty, _center, {bypass_discovery_center = true, bypass_discovery_ui = true})
        t[#t] = nil
        if not t[1] then G.SETTINGS.tutorial_progress.forced_shop = nil end
        
        create_shop_card_ui(card)
        return card
      else
        local forced_tag = nil
        for k, v in ipairs(G.GAME.tags) do
          if not forced_tag then
            forced_tag = v:apply_to_run({type = 'store_joker_create', area = area})
            if forced_tag then
              for kk, vv in ipairs(G.GAME.tags) do
                if vv:apply_to_run({type = 'store_joker_modify', card = forced_tag}) then break end
              end
              return forced_tag end
          end
        end
          G.GAME.spectral_rate = G.GAME.spectral_rate or 0
          local total_rate = G.GAME.joker_rate + G.GAME.tarot_rate + G.GAME.planet_rate + G.GAME.playing_card_rate + G.GAME.spectral_rate
          local polled_rate = pseudorandom(pseudoseed('cdt'..G.GAME.round_resets.ante))*total_rate
          local check_rate = 0
          for _, v in ipairs({
            {type = 'Joker', val = G.GAME.joker_rate},
            {type = 'Tarot', val = G.GAME.tarot_rate},
            {type = 'Planet', val = G.GAME.planet_rate},
            {type = (G.GAME.used_vouchers["v_illusion"] and pseudorandom(pseudoseed('illusion')) > 0.6) and 'Enhanced' or 'Base', val = G.GAME.playing_card_rate},
            {type = 'Spectral', val = G.GAME.spectral_rate},
          }) do
            if polled_rate > check_rate and polled_rate <= check_rate + v.val then
              local card = create_card(v.type, area, nil, nil, nil, nil, nil, 'sho')
              create_shop_card_ui(card, v.type, area)
              G.E_MANAGER:add_event(Event({
                  func = (function()
                      for k, v in ipairs(G.GAME.tags) do
                        if v:apply_to_run({type = 'store_joker_modify', card = card}) then break end
                      end
                      return true
                  end)
              }))
              if (v.type == 'Base' or v.type == 'Enhanced') and G.GAME.used_vouchers["v_illusion"] and pseudorandom(pseudoseed('illusion')) > 0.8 then 
                local edition_poll = pseudorandom(pseudoseed('illusion'))
                local edition = {}
                if edition_poll > 1 - 0.15 then edition.polychrome = true
                elseif edition_poll > 0.5 then edition.holo = true
                else edition.foil = true
                end
                card:set_edition(edition)
              end
              return card
            end
            check_rate = check_rate + v.val
          end
      end
  end

  function create_shop_card_ui(card, type, area)
      G.E_MANAGER:add_event(Event({
        trigger = 'after',
        delay = 0.43,
        blocking = false,
        blockable = false,
        func = (function()
          if card.opening then return true end
          local t1 = {
              n=G.UIT.ROOT, config = {minw = 0.6, align = 'tm', colour = darken(G.C.BLACK, 0.2), shadow = true, r = 0.05, padding = 0.05, minh = 1}, nodes={
                  {n=G.UIT.R, config={align = "cm", colour = lighten(G.C.BLACK, 0.1), r = 0.1, minw = 1, minh = 0.55, emboss = 0.05, padding = 0.03}, nodes={
                    {n=G.UIT.O, config={object = DynaText({string = {{prefix = localize('$'), ref_table = card, ref_value = 'cost'}}, colours = {G.C.MONEY},shadow = true, silent = true, bump = true, pop_in = 0, scale = 0.5})}},
                  }}
              }}
          local t2 = card.ability.set == 'Voucher' and {
            n=G.UIT.ROOT, config = {ref_table = card, minw = 1.1, maxw = 1.3, padding = 0.1, align = 'bm', colour = G.C.GREEN, shadow = true, r = 0.08, minh = 0.94, func = 'can_redeem', one_press = true, button = 'redeem_from_shop', hover = true}, nodes={
                {n=G.UIT.T, config={text = localize('b_redeem'),colour = G.C.WHITE, scale = 0.4}}
            }} or card.ability.set == 'Booster' and {
            n=G.UIT.ROOT, config = {ref_table = card, minw = 1.1, maxw = 1.3, padding = 0.1, align = 'bm', colour = G.C.GREEN, shadow = true, r = 0.08, minh = 0.94, func = 'can_open', one_press = true, button = 'open_booster', hover = true}, nodes={
                {n=G.UIT.T, config={text = localize('b_open'),colour = G.C.WHITE, scale = 0.5}}
            }} or {
            n=G.UIT.ROOT, config = {ref_table = card, minw = 1.1, maxw = 1.3, padding = 0.1, align = 'bm', colour = G.C.GOLD, shadow = true, r = 0.08, minh = 0.94, func = 'can_buy', one_press = true, button = 'buy_from_shop', hover = true}, nodes={
                {n=G.UIT.T, config={text = localize('b_buy'),colour = G.C.WHITE, scale = 0.5}}
            }}
          local t3 = {
            n=G.UIT.ROOT, config = {id = 'buy_and_use', ref_table = card, minh = 1.1, padding = 0.1, align = 'cr', colour = G.C.RED, shadow = true, r = 0.08, minw = 1.1, func = 'can_buy_and_use', one_press = true, button = 'buy_from_shop', hover = true, focus_args = {type = 'none'}}, nodes={
              {n=G.UIT.B, config = {w=0.1,h=0.6}},
              {n=G.UIT.C, config = {align = 'cm'}, nodes={
                {n=G.UIT.R, config = {align = 'cm', maxw = 1}, nodes={
                  {n=G.UIT.T, config={text = localize('b_buy'),colour = G.C.WHITE, scale = 0.5}}
                }},
                {n=G.UIT.R, config = {align = 'cm', maxw = 1}, nodes={
                  {n=G.UIT.T, config={text = localize('b_and_use'),colour = G.C.WHITE, scale = 0.3}}
                }},
              }} 
            }}
            

          card.children.price = UIBox{
            definition = t1,
            config = {
              align="tm",
              offset = {x=0,y=1.5},
              major = card,
              bond = 'Weak',
              parent = card
            }
          }

          card.children.buy_button = UIBox{
            definition = t2,
            config = {
              align="bm",
              offset = {x=0,y=-0.3},
              major = card,
              bond = 'Weak',
              parent = card
            }
          }

          if card.ability.consumeable then --and card:can_use_consumeable(true, true)
            card.children.buy_and_use_button = UIBox{
              definition = t3,
              config = {
                align="cr",
                offset = {x=-0.3,y=0},
                major = card,
                bond = 'Weak',
                parent = card
              }
            }
          end

          card.children.price.alignment.offset.y = card.ability.set == 'Booster' and 0.5 or 0.38

            return true
        end)
      }))
  end


  function attention_text(args)
    args = args or {}
    args.text = args.text or 'test'
    args.scale = args.scale or 1
    args.colour = copy_table(args.colour or G.C.WHITE)
    args.hold = (args.hold or 0) + 0.1*(G.SPEEDFACTOR)
    args.pos = args.pos or {x = 0, y = 0}
    args.align = args.align or 'cm'
    args.emboss = args.emboss or nil

    args.fade = 1

    if args.cover then
      args.cover_colour = copy_table(args.cover_colour or G.C.RED)
      args.cover_colour_l = copy_table(lighten(args.cover_colour, 0.2))
      args.cover_colour_d = copy_table(darken(args.cover_colour, 0.2))
    else
      args.cover_colour = copy_table(G.C.CLEAR)
    end

    args.uibox_config = {
      align = args.align or 'cm',
      offset = args.offset or {x=0,y=0}, 
      major = args.cover or args.major or nil,
    }

    G.E_MANAGER:add_event(Event({
      trigger = 'after',
      delay = 0,
      blockable = false,
      blocking = false,
      func = function()
          args.AT = UIBox{
            T = {args.pos.x,args.pos.y,0,0},
            definition = 
              {n=G.UIT.ROOT, config = {align = args.cover_align or 'cm', minw = (args.cover and args.cover.T.w or 0.001) + (args.cover_padding or 0), minh = (args.cover and args.cover.T.h or 0.001) + (args.cover_padding or 0), padding = 0.03, r = 0.1, emboss = args.emboss, colour = args.cover_colour}, nodes={
                {n=G.UIT.O, config={draw_layer = 1, object = DynaText({scale = args.scale, string = args.text, maxw = args.maxw, colours = {args.colour},float = true, shadow = true, silent = not args.noisy, args.scale, pop_in = 0, pop_in_rate = 6, rotate = args.rotate or nil})}},
              }}, 
            config = args.uibox_config
          }
          args.AT.attention_text = true

          args.text = args.AT.UIRoot.children[1].config.object
          args.text:pulse(0.5)
          
          if args.cover then
            Particles(args.pos.x,args.pos.y, 0,0, {
              timer_type = 'TOTAL',
              timer = 0.01,
              pulse_max = 15,
              max = 0,
              scale = 0.3,
              vel_variation = 0.2,
              padding = 0.1,
              fill=true,
              lifespan = 0.5,
              speed = 2.5,
              attach = args.AT.UIRoot,
              colours = {args.cover_colour, args.cover_colour_l, args.cover_colour_d},
          })
          end
          if args.backdrop_colour then
            args.backdrop_colour = copy_table(args.backdrop_colour)
            Particles(args.pos.x,args.pos.y,0,0,{
              timer_type = 'TOTAL',
              timer = 5,
              scale = 2.4*(args.backdrop_scale or 1), 
              lifespan = 5,
              speed = 0,
              attach = args.AT,
              colours = {args.backdrop_colour}
            })
          end
          return true
      end
      }))

      G.E_MANAGER:add_event(Event({
        trigger = 'after',
        delay = args.hold,
        blockable = false,
        blocking = false,
        func = function()
          if not args.start_time then
            args.start_time = G.TIMERS.TOTAL
            args.text:pop_out(3)
          else
            --args.AT:align_to_attach()
            args.fade = math.max(0, 1 - 3*(G.TIMERS.TOTAL - args.start_time))
            if args.cover_colour then args.cover_colour[4] = math.min(args.cover_colour[4], 2*args.fade) end
            if args.cover_colour_l then args.cover_colour_l[4] = math.min(args.cover_colour_l[4], args.fade) end
            if args.cover_colour_d then args.cover_colour_d[4] = math.min(args.cover_colour_d[4], args.fade) end
            if args.backdrop_colour then args.backdrop_colour[4] = math.min(args.backdrop_colour[4], args.fade) end
            args.colour[4] = math.min(args.colour[4], args.fade)
            if args.fade <= 0 then
              args.AT:remove()
              return true
            end
          end
        end
      }))
  end

  function create_UIBox_buttons()
    local text_scale = 0.45
    local button_height = 1.3
    local play_button = {n=G.UIT.C, config={id = 'play_button', align = "tm", minw = 2.5, padding = 0.3, r = 0.1, hover = true, colour = G.C.BLUE, button = "play_cards_from_highlighted", one_press = true, shadow = true, func = 'can_play'}, nodes={
      {n=G.UIT.R, config={align = "bcm", padding = 0}, nodes={
        {n=G.UIT.T, config={text = localize('b_play_hand'), scale = text_scale, colour = G.C.UI.TEXT_LIGHT, focus_args = {button = 'x', orientation = 'bm'}, func = 'set_button_pip'}}
      }},
    }}

    local discard_button = {n=G.UIT.C, config={id = 'discard_button',align = "tm", padding = 0.3, r = 0.1, minw = 2.5, minh = button_height, hover = true, colour = G.C.RED, button = "discard_cards_from_highlighted", one_press = true, shadow = true, func = 'can_discard'}, nodes={
      {n=G.UIT.R, config={align = "cm", padding = 0}, nodes={
        {n=G.UIT.T, config={text = localize('b_discard'), scale = text_scale, colour = G.C.UI.TEXT_LIGHT, focus_args = {button = 'y', orientation = 'bm'}, func = 'set_button_pip'}}
      }}
    }}

    local t = {
      n=G.UIT.ROOT, config = {align = "cm", minw = 1, minh = 0.3,padding = 0.15, r = 0.1, colour = G.C.CLEAR}, nodes={
          G.SETTINGS.play_button_pos == 1 and discard_button or play_button,

          {n=G.UIT.C, config={align = "cm", padding = 0.1, r = 0.1, colour =G.C.UI.TRANSPARENT_DARK, outline = 1.5, outline_colour = mix_colours(G.C.WHITE,G.C.JOKER_GREY, 0.7), line_emboss = 1}, nodes={
            {n=G.UIT.R, config={align = "cm", padding = 0}, nodes={
              {n=G.UIT.R, config={align = "cm", padding = 0}, nodes={
                {n=G.UIT.T, config={text = localize('b_sort_hand'), scale = text_scale*0.8, colour = G.C.UI.TEXT_LIGHT}}
              }},
              {n=G.UIT.R, config={align = "cm", padding = 0.1}, nodes={
                {n=G.UIT.C, config={align = "cm", minh = 0.7, minw = 0.9, padding = 0.1, r = 0.1, hover = true, colour =G.C.ORANGE, button = "sort_hand_value", shadow = true}, nodes={
                  {n=G.UIT.T, config={text = localize('k_rank'), scale = text_scale*0.7, colour = G.C.UI.TEXT_LIGHT}}
                }},
                {n=G.UIT.C, config={align = "cm", minh = 0.7, minw = 0.9, padding = 0.1, r = 0.1, hover = true, colour =G.C.ORANGE, button = "sort_hand_suit", shadow = true}, nodes={
                  {n=G.UIT.T, config={text = localize('k_suit'), scale = text_scale*0.7, colour = G.C.UI.TEXT_LIGHT}}
                }}
              }}
            }}
          }},
  
          G.SETTINGS.play_button_pos == 1 and play_button or discard_button,
        }
      }
    return t
  end

  function desc_from_rows(desc_nodes, empty, maxw)
    local t = {}
    for k, v in ipairs(desc_nodes) do
      t[#t+1] = {n=G.UIT.R, config={align = "cm", maxw = maxw}, nodes=v}
    end
    return {n=G.UIT.R, config={align = "cm", colour = empty and G.C.CLEAR or G.C.UI.BACKGROUND_WHITE, r = 0.1, padding = 0.04, minw = 2, minh = 0.8, emboss = not empty and 0.05 or nil, filler = true}, nodes={
      {n=G.UIT.R, config={align = "cm", padding = 0.03}, nodes=t}
    }}
  end

  function transparent_multiline_text(desc_nodes)
    local t = {}
    for k, v in ipairs(desc_nodes) do
      t[#t+1] = {n=G.UIT.R, config={align = "cm", maxw = maxw}, nodes=v}
    end
    return {n=G.UIT.R, config={align = "cm", padding = 0.03}, nodes=t}
  end

  function info_tip_from_rows(desc_nodes, name)
    local t = {}
    for k, v in ipairs(desc_nodes) do
      t[#t+1] = {n=G.UIT.R, config={align = "cm"}, nodes=v}
    end
    return {n=G.UIT.R, config={align = "cm", colour = lighten(G.C.GREY, 0.15), r = 0.1}, nodes={
      {n=G.UIT.R, config={align = "tm", minh = 0.36, padding = 0.03}, nodes={{n=G.UIT.T, config={text = name, scale = 0.32, colour = G.C.UI.TEXT_LIGHT}}}},
      {n=G.UIT.R, config={align = "cm", minw = 1.5, minh = 0.4, r = 0.1, padding = 0.05, colour = G.C.WHITE}, nodes={{n=G.UIT.R, config={align = "cm", padding = 0.03}, nodes=t}}}
    }}
  end

  function overlay_infotip(text_rows)
    local t = {}
    if type(text_rows) ~= 'table' then text_rows = {"ERROR"} end
    for k, v in ipairs(text_rows) do
      t[#t+1] = {n=G.UIT.R, config={align = "cm"}, nodes={
        {n=G.UIT.T, config={text = v,colour = G.C.UI.TEXT_LIGHT, scale = 0.45, juice = true, shadow = true, lang = text_rows.lang}}
      }}
    end
    return {n=G.UIT.ROOT, config={align = "cm", colour = G.C.CLEAR, padding = 0.1}, nodes=t}
  end

  function name_from_rows(name_nodes, background_colour)
    if not name_nodes or (type(name_nodes) ~= 'table') or not next(name_nodes) then return end
    return {n=G.UIT.R, config={align = "cm", padding = 0.05, r = 0.1, colour = background_colour, emboss = background_colour and 0.05 or nil}, nodes=name_nodes}
  end

  function G.UIDEF.card_h_popup(card)
    if card.ability_UIBox_table then
      local AUT = card.ability_UIBox_table
      local debuffed = card.debuff
      local card_type_colour = get_type_colour(card.config.center or card.config, card)
      local card_type_background = 
          (AUT.card_type == 'Locked' and G.C.BLACK) or 
          ((AUT.card_type == 'Undiscovered') and darken(G.C.JOKER_GREY, 0.3)) or 
          (AUT.card_type == 'Enhanced' or AUT.card_type == 'Default') and darken(G.C.BLACK, 0.1) or
          (debuffed and darken(G.C.BLACK, 0.1)) or 
          (card_type_colour and darken(G.C.BLACK, 0.1)) or
          G.C.SET[AUT.card_type] or
          {0, 1, 1, 1}

      local outer_padding = 0.05
      local card_type = localize('k_'..string.lower(AUT.card_type))

      if AUT.card_type == 'Joker' or (AUT.badges and AUT.badges.force_rarity) then card_type = ({localize('k_common'), localize('k_uncommon'), localize('k_rare'), localize('k_legendary')})[card.config.center.rarity] end
      if AUT.card_type == 'Enhanced' then card_type = localize{type = 'name_text', key = card.config.center.key, set = 'Enhanced'} end
      card_type = (debuffed and AUT.card_type ~= 'Enhanced') and localize('k_debuffed') or card_type

      local disp_type, is_playing_card = 
                (AUT.card_type ~= 'Locked' and AUT.card_type ~= 'Undiscovered' and AUT.card_type ~= 'Default') or debuffed,
                AUT.card_type == 'Enhanced' or AUT.card_type == 'Default'

      local info_boxes = {}
      local badges = {}

      if AUT.badges.card_type or AUT.badges.force_rarity then
        badges[#badges + 1] = create_badge(((card.ability.name == 'Pluto' or card.ability.name == 'Ceres' or card.ability.name == 'Eris') and localize('k_dwarf_planet')) or (card.ability.name == 'Planet X' and localize('k_planet_q') or card_type),card_type_colour, nil, 1.2)
      end
      if AUT.badges then
        for k, v in ipairs(AUT.badges) do
          if v == 'negative_consumable' then v = 'negative' end
          badges[#badges + 1] = create_badge(localize(v, "labels"), get_badge_colour(v))
        end
      end

      if AUT.info then
        for k, v in ipairs(AUT.info) do
          info_boxes[#info_boxes+1] =
          {n=G.UIT.R, config={align = "cm"}, nodes={
          {n=G.UIT.R, config={align = "cm", colour = lighten(G.C.JOKER_GREY, 0.5), r = 0.1, padding = 0.05, emboss = 0.05}, nodes={
            info_tip_from_rows(v, v.name),
          }}
        }}
        end
      end

      return {n=G.UIT.ROOT, config = {align = 'cm', colour = G.C.CLEAR}, nodes={
        {n=G.UIT.C, config={align = "cm", func = 'show_infotip',object = Moveable(),ref_table = next(info_boxes) and info_boxes or nil}, nodes={
          {n=G.UIT.R, config={padding = outer_padding, r = 0.12, colour = lighten(G.C.JOKER_GREY, 0.5), emboss = 0.07}, nodes={
            {n=G.UIT.R, config={align = "cm", padding = 0.07, r = 0.1, colour = adjust_alpha(card_type_background, 0.8)}, nodes={
              name_from_rows(AUT.name, is_playing_card and G.C.WHITE or nil),
              desc_from_rows(AUT.main),
              badges[1] and {n=G.UIT.R, config={align = "cm", padding = 0.03}, nodes=badges} or nil,
            }}
          }}
        }},
      }}
    end
  end

  function get_badge_colour(key)
    G.BADGE_COL = G.BADGE_COL or {
      eternal = G.C.ETERNAL,
      perishable = G.C.PERISHABLE,
      rental = G.C.RENTAL,
      foil = G.C.DARK_EDITION,
      holographic = G.C.DARK_EDITION,
      polychrome = G.C.DARK_EDITION,
      negative = G.C.DARK_EDITION,
      gold_seal = G.C.GOLD,
      red_seal = G.C.RED,
      blue_seal = G.C.BLUE,
      purple_seal = G.C.PURPLE,
      pinned_left = G.C.ORANGE,
    }
    return G.BADGE_COL[key] or {1, 0, 0, 1}
  end

  function create_badge(_string, _badge_col, _text_col, scaling)
    scaling = scaling or 1
    return {n=G.UIT.R, config={align = "cm"}, nodes={
      {n=G.UIT.R, config={align = "cm", colour = _badge_col or G.C.GREEN, r = 0.1, minw = 2, minh = 0.4*scaling, emboss = 0.05, padding = 0.03*scaling}, nodes={
        {n=G.UIT.B, config={h=0.1,w=0.03}},
        {n=G.UIT.O, config={object = DynaText({string = _string or 'ERROR', colours = {_text_col or G.C.WHITE},float = true, shadow = true, offset_y = -0.05, silent = true, spacing = 1, scale = 0.33*scaling})}},
        {n=G.UIT.B, config={h=0.1,w=0.03}},
      }}
    }}
  end

  function create_UIBox_detailed_tooltip(_center)
    local full_UI_table = {
        main = {},
        info = {},
        type = {},
        name = 'done',
        badges = badges or {}
    }
    local desc = generate_card_ui(_center, full_UI_table, nil, _center.set, nil)
    return {n=G.UIT.ROOT, config={align = "cm", colour = G.C.CLEAR}, nodes={
      {n=G.UIT.R, config={align = "cm", colour = lighten(G.C.JOKER_GREY, 0.5), r = 0.1, padding = 0.05, emboss = 0.05}, nodes={
        info_tip_from_rows(desc.info[1], desc.info[1].name),
      }}
    }}
  end
  
  function create_popup_UIBox_tooltip(tooltip)
    local title = tooltip.title or nil
    local text = tooltip.text or {}
    local rows = {}
    if title then
        local r = {n=G.UIT.R, config={align = "cm"}, nodes={
            {n=G.UIT.C, config={align = "cm"}, nodes={
                {n=G.UIT.T, config={text = title,colour = G.C.UI.TEXT_DARK, scale = 0.4}}}}}}
        table.insert(rows, r)
    end
    for i = 1, #text do
      if type(text[i]) == 'table' then
        local r = {n=G.UIT.R, config={align = "cm", padding = 0.03}, nodes={
          {n=G.UIT.T, config={ref_table = text[i].ref_table, ref_value = text[i].ref_value,colour = G.C.UI.TEXT_DARK, scale = 0.4}}}}
        table.insert(rows, r)
      else
        local r = {n=G.UIT.R, config={align = "cm", padding = 0.03}, nodes={
                {n=G.UIT.T, config={text = text[i],colour = G.C.UI.TEXT_DARK, scale = 0.4}}}}
        table.insert(rows, r)
      end
    end
    if tooltip.filler then 
      table.insert(rows, tooltip.filler.func(tooltip.filler.args))
    end
    local t = {
        n=G.UIT.ROOT, config = {align = "cm", padding = 0.05, r=0.1, colour = G.C.RED, emboss = 0.05}, nodes=
        {{n=G.UIT.C, config={align = "cm", padding = 0.05, r = 0.1, colour = G.C.WHITE, emboss = 0.05}, nodes=rows}}}
    return t
  end

function create_UIBox_HUD_blind()
  local scale = 0.4
  local stake_sprite = get_stake_sprite(G.GAME.stake or 1, 0.5)
  G.GAME.blind:change_dim(1.5,1.5)

  return {n=G.UIT.ROOT, config={align = "cm", minw = 4.5, r = 0.1, colour = G.C.BLACK, emboss = 0.05, padding = 0.05, func = 'HUD_blind_visible', id = 'HUD_blind'}, nodes={
      {n=G.UIT.R, config={align = "cm", minh = 0.7, r = 0.1, emboss = 0.05, colour = G.C.DYN_UI.MAIN}, nodes={
        {n=G.UIT.C, config={align = "cm", minw = 3}, nodes={
          {n=G.UIT.O, config={object = DynaText({string = {{ref_table = G.GAME.blind, ref_value = 'loc_name'}}, colours = {G.C.UI.TEXT_LIGHT},shadow = true, rotate = true, silent = true, float = true, scale = 1.6*scale, y_offset = -4}),id = 'HUD_blind_name'}},
        }},
      }},
      {n=G.UIT.R, config={align = "cm", minh = 2.74, r = 0.1,colour = G.C.DYN_UI.DARK}, nodes={
        {n=G.UIT.R, config={align = "cm", padding = 0.05}, nodes={
          {n=G.UIT.R, config={align = "cm", minh = 0.3, maxw = 4.2}, nodes={
            {n=G.UIT.T, config={ref_table = {val = ''}, ref_value = 'val', scale = scale*0.9, colour = G.C.UI.TEXT_LIGHT, func = 'HUD_blind_debuff_prefix'}},
            {n=G.UIT.T, config={ref_table = G.GAME.blind.loc_debuff_lines, ref_value = 1, scale = scale*0.9, colour = G.C.UI.TEXT_LIGHT, id = 'HUD_blind_debuff_1', func = 'HUD_blind_debuff'}}
          }},
          {n=G.UIT.R, config={align = "cm", minh = 0.3, maxw = 4.2}, nodes={
            {n=G.UIT.T, config={ref_table = G.GAME.blind.loc_debuff_lines, ref_value = 2, scale = scale*0.9, colour = G.C.UI.TEXT_LIGHT, id = 'HUD_blind_debuff_2', func = 'HUD_blind_debuff'}}
          }},
        }},
        {n=G.UIT.R, config={align = "cm",padding = 0.15}, nodes={
          {n=G.UIT.O, config={object = G.GAME.blind, draw_layer = 1}},
          {n=G.UIT.C, config={align = "cm",r = 0.1, padding = 0.05, emboss = 0.05, minw = 2.9, colour = G.C.BLACK}, nodes={
            {n=G.UIT.R, config={align = "cm", maxw = 2.8}, nodes={
              {n=G.UIT.T, config={text = localize('ph_blind_score_at_least'), scale = 0.3, colour = G.C.WHITE, shadow = true}}
            }},
            {n=G.UIT.R, config={align = "cm", minh = 0.6}, nodes={
              {n=G.UIT.O, config={w=0.5,h=0.5, colour = G.C.BLUE, object = stake_sprite, hover = true, can_collide = false}},
              {n=G.UIT.B, config={h=0.1,w=0.1}},
              {n=G.UIT.T, config={ref_table = G.GAME.blind, ref_value = 'chip_text', scale = 0.001, colour = G.C.RED, shadow = true, id = 'HUD_blind_count', func = 'blind_chip_UI_scale'}}
            }},
            {n=G.UIT.R, config={align = "cm", minh = 0.45, maxw = 2.8, func = 'HUD_blind_reward'}, nodes={
              {n=G.UIT.T, config={text = localize('ph_blind_reward'), scale = 0.3, colour = G.C.WHITE}},
              {n=G.UIT.O, config={object = DynaText({string = {{ref_table = G.GAME.current_round, ref_value = 'dollars_to_be_earned'}}, colours = {G.C.MONEY},shadow = true, rotate = true, bump = true, silent = true, scale = 0.45}),id = 'dollars_to_be_earned'}},
            }},
          }},
        }},
      }},
    }}
end

function add_tag(_tag)
  G.HUD_tags = G.HUD_tags or {}
  local tag_sprite_ui = _tag:generate_UI()
  G.HUD_tags[#G.HUD_tags+1] = UIBox{
      definition = {n=G.UIT.ROOT, config={align = "cm",padding = 0.05, colour = G.C.CLEAR}, nodes={
        tag_sprite_ui
      }},
      config = {
        align = G.HUD_tags[1] and 'tm' or 'bri',
        offset = G.HUD_tags[1] and {x=0,y=0} or {x=0.7,y=0},
        major = G.HUD_tags[1] and G.HUD_tags[#G.HUD_tags] or G.ROOM_ATTACH}
  }
  discover_card(G.P_TAGS[_tag.key])

  for i = 1, #G.GAME.tags do
    G.GAME.tags[i]:apply_to_run({type = 'tag_add', tag = _tag})
  end
  
  G.GAME.tags[#G.GAME.tags+1] = _tag
  _tag.HUD_tag = G.HUD_tags[#G.HUD_tags]
end

function create_UIBox_HUD()
    local scale = 0.4
    local stake_sprite = get_stake_sprite(G.GAME.stake or 1, 0.5)

    local contents = {}

    local spacing = 0.13
    local temp_col = G.C.DYN_UI.BOSS_MAIN
    local temp_col2 = G.C.DYN_UI.BOSS_DARK
            contents.round = {
              {n=G.UIT.R, config={align = "cm"}, nodes={
                {n=G.UIT.C, config={id = 'hud_hands',align = "cm", padding = 0.05, minw = 1.45, colour = temp_col, emboss = 0.05, r = 0.1}, nodes={
                  {n=G.UIT.R, config={align = "cm", minh = 0.33, maxw = 1.35}, nodes={
                    {n=G.UIT.T, config={text = localize('k_hud_hands'), scale = 0.85*scale, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                  }},
                  {n=G.UIT.R, config={align = "cm", r = 0.1, minw = 1.2, colour = temp_col2}, nodes={
                    {n=G.UIT.O, config={object = DynaText({string = {{ref_table = G.GAME.current_round, ref_value = 'hands_left'}}, font = G.LANGUAGES['en-us'].font, colours = {G.C.BLUE},shadow = true, rotate = true, scale = 2*scale}),id = 'hand_UI_count'}},
                  }}
                }},
                {n=G.UIT.C, config={minw = spacing},nodes={}},
                {n=G.UIT.C, config={align = "cm", padding = 0.05, minw = 1.45, colour = temp_col, emboss = 0.05, r = 0.1}, nodes={
                  {n=G.UIT.R, config={align = "cm", minh = 0.33, maxw = 1.35}, nodes={
                    {n=G.UIT.T, config={text = localize('k_hud_discards'), scale = 0.85*scale, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                  }},
                  {n=G.UIT.R, config={align = "cm"}, nodes={
                    {n=G.UIT.R, config={align = "cm", r = 0.1, minw = 1.2, colour = temp_col2}, nodes={
                      {n=G.UIT.O, config={object = DynaText({string = {{ref_table = G.GAME.current_round, ref_value = 'discards_left'}}, font = G.LANGUAGES['en-us'].font, colours = {G.C.RED},shadow = true, rotate = true, scale = 2*scale}),id = 'discard_UI_count'}},
                    }}
                  }},
                }},
              }},
              {n=G.UIT.R, config={minh = spacing},nodes={}},
              {n=G.UIT.R, config={align = "cm"}, nodes={
                {n=G.UIT.C, config={align = "cm", padding = 0.05, minw = 1.45*2 + spacing, minh = 1.15, colour = temp_col, emboss = 0.05, r = 0.1}, nodes={
                  {n=G.UIT.R, config={align = "cm"}, nodes={
                    {n=G.UIT.C, config={align = "cm", r = 0.1, minw = 1.28*2+spacing, minh = 1, colour = temp_col2}, nodes={
                      {n=G.UIT.O, config={object = DynaText({string = {{ref_table = G.GAME, ref_value = 'dollars', prefix = localize('$')}}, maxw = 1.35, colours = {G.C.MONEY}, font = G.LANGUAGES['en-us'].font, shadow = true,spacing = 2, bump = true, scale = 2.2*scale}), id = 'dollar_text_UI'}}
                  }},
                  }},
                }},
            }},
            {n=G.UIT.R, config={minh = spacing},nodes={}},
            {n=G.UIT.R, config={align = "cm"}, nodes={
              {n=G.UIT.C, config={id = 'hud_ante',align = "cm", padding = 0.05, minw = 1.45, minh = 1, colour = temp_col, emboss = 0.05, r = 0.1}, nodes={
                {n=G.UIT.R, config={align = "cm", minh = 0.33, maxw = 1.35}, nodes={
                  {n=G.UIT.T, config={text = localize('k_ante'), scale = 0.85*scale, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                }},
                {n=G.UIT.R, config={align = "cm", r = 0.1, minw = 1.2, colour = temp_col2}, nodes={
                  {n=G.UIT.O, config={object = DynaText({string = {{ref_table = G.GAME.round_resets, ref_value = 'ante'}}, colours = {G.C.IMPORTANT},shadow = true, font = G.LANGUAGES['en-us'].font, scale = 2*scale}),id = 'ante_UI_count'}},
                  {n=G.UIT.T, config={text = " ", scale = 0.3*scale}},
                  {n=G.UIT.T, config={text = "/ ", scale = 0.7*scale, colour = G.C.WHITE, shadow = true}},
                  {n=G.UIT.T, config={ref_table = G.GAME, ref_value='win_ante', scale = scale, colour = G.C.WHITE, shadow = true}}
                }},
              }},
              {n=G.UIT.C, config={minw = spacing},nodes={}},
              {n=G.UIT.C, config={align = "cm", padding = 0.05, minw = 1.45, minh = 1, colour = temp_col, emboss = 0.05, r = 0.1}, nodes={
                {n=G.UIT.R, config={align = "cm", maxw = 1.35}, nodes={
                  {n=G.UIT.T, config={text = localize('k_round'), minh = 0.33, scale = 0.85*scale, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                }},
                {n=G.UIT.R, config={align = "cm", r = 0.1, minw = 1.2, colour = temp_col2, id = 'row_round_text'}, nodes={
                  {n=G.UIT.O, config={object = DynaText({string = {{ref_table = G.GAME, ref_value = 'round'}}, colours = {G.C.IMPORTANT},shadow = true, scale = 2*scale}),id = 'round_UI_count'}},
                }},
              }},
            }},            
    }

    contents.hand =
        {n=G.UIT.R, config={align = "cm", id = 'hand_text_area', colour = darken(G.C.BLACK, 0.1), r = 0.1, emboss = 0.05, padding = 0.03}, nodes={
            {n=G.UIT.C, config={align = "cm"}, nodes={
              {n=G.UIT.R, config={align = "cm", minh = 1.1}, nodes={
                {n=G.UIT.O, config={id = 'hand_name', func = 'hand_text_UI_set',object = DynaText({string = {{ref_table = G.GAME.current_round.current_hand, ref_value = "handname_text"}}, colours = {G.C.UI.TEXT_LIGHT}, shadow = true, float = true, scale = scale*1.4})}},
                {n=G.UIT.O, config={id = 'hand_chip_total', func = 'hand_chip_total_UI_set',object = DynaText({string = {{ref_table = G.GAME.current_round.current_hand, ref_value = "chip_total_text"}}, colours = {G.C.UI.TEXT_LIGHT}, shadow = true, float = true, scale = scale*1.4})}},
                {n=G.UIT.T, config={ref_table = G.GAME.current_round.current_hand, ref_value='hand_level', scale = scale, colour = G.C.UI.TEXT_LIGHT, id = 'hand_level', shadow = true}}
              }},
              {n=G.UIT.R, config={align = "cm", minh = 1, padding = 0.1}, nodes={
                {n=G.UIT.C, config={align = "cr", minw = 2, minh =1, r = 0.1,colour = G.C.UI_CHIPS, id = 'hand_chip_area', emboss = 0.05}, nodes={
                    {n=G.UIT.O, config={func = 'flame_handler',no_role = true, id = 'flame_chips', object = Moveable(0,0,0,0), w = 0, h = 0}},
                    {n=G.UIT.O, config={id = 'hand_chips', func = 'hand_chip_UI_set',object = DynaText({string = {{ref_table = G.GAME.current_round.current_hand, ref_value = "chip_text"}}, colours = {G.C.UI.TEXT_LIGHT}, font = G.LANGUAGES['en-us'].font, shadow = true, float = true, scale = scale*2.3})}},
                    {n=G.UIT.B, config={w=0.1,h=0.1}},
                }},
                {n=G.UIT.C, config={align = "cm"}, nodes={
                  {n=G.UIT.T, config={text = "X", lang = G.LANGUAGES['en-us'], scale = scale*2, colour = G.C.UI_MULT, shadow = true}},
                }},
                {n=G.UIT.C, config={align = "cl", minw = 2, minh=1, r = 0.1,colour = G.C.UI_MULT, id = 'hand_mult_area', emboss = 0.05}, nodes={
                  {n=G.UIT.O, config={func = 'flame_handler',no_role = true, id = 'flame_mult', object = Moveable(0,0,0,0), w = 0, h = 0}},
                  {n=G.UIT.B, config={w=0.1,h=0.1}},
                  {n=G.UIT.O, config={id = 'hand_mult', func = 'hand_mult_UI_set',object = DynaText({string = {{ref_table = G.GAME.current_round.current_hand, ref_value = "mult_text"}}, colours = {G.C.UI.TEXT_LIGHT}, font = G.LANGUAGES['en-us'].font, shadow = true, float = true, scale = scale*2.3})}},
                }}
              }}
            }}
          }}
    contents.dollars_chips = {n=G.UIT.R, config={align = "cm",r=0.1, padding = 0,colour = G.C.DYN_UI.BOSS_MAIN, emboss = 0.05, id = 'row_dollars_chips'}, nodes={
      {n=G.UIT.C, config={align = "cm", padding = 0.1}, nodes={
        {n=G.UIT.C, config={align = "cm", minw = 1.3}, nodes={
          {n=G.UIT.R, config={align = "cm", padding = 0, maxw = 1.3}, nodes={
            {n=G.UIT.T, config={text = localize('k_round'), scale = 0.42, colour = G.C.UI.TEXT_LIGHT, shadow = true}}
          }},
          {n=G.UIT.R, config={align = "cm", padding = 0, maxw = 1.3}, nodes={
            {n=G.UIT.T, config={text =localize('k_lower_score'), scale = 0.42, colour = G.C.UI.TEXT_LIGHT, shadow = true}}
          }}
        }},
        {n=G.UIT.C, config={align = "cm", minw = 3.3, minh = 0.7, r = 0.1, colour = G.C.DYN_UI.BOSS_DARK}, nodes={
          {n=G.UIT.O, config={w=0.5,h=0.5 , object = stake_sprite, hover = true, can_collide = false}},
          {n=G.UIT.B, config={w=0.1,h=0.1}},
          {n=G.UIT.T, config={ref_table = G.GAME, ref_value = 'chips_text', lang = G.LANGUAGES['en-us'], scale = 0.85, colour = G.C.WHITE, id = 'chip_UI_count', func = 'chip_UI_set', shadow = true}}
        }}
      }}
    }}

    contents.buttons = {
      {n=G.UIT.C, config={align = "cm", r=0.1, colour = G.C.CLEAR, shadow = true, id = 'button_area', padding = 0.2}, nodes={
          {n=G.UIT.R, config={id = 'run_info_button', align = "cm", minh = 1.75, minw = 1.5,padding = 0.05, r = 0.1, hover = true, colour = G.C.RED, button = "run_info", shadow = true}, nodes={
            {n=G.UIT.R, config={align = "cm", padding = 0, maxw = 1.4}, nodes={
              {n=G.UIT.T, config={text = localize('b_run_info_1'), scale = 1.2*scale, colour = G.C.UI.TEXT_LIGHT, shadow = true}}
            }},
            {n=G.UIT.R, config={align = "cm", padding = 0, maxw = 1.4}, nodes={
              {n=G.UIT.T, config={text = localize('b_run_info_2'), scale = 1*scale, colour = G.C.UI.TEXT_LIGHT, shadow = true, focus_args = {button = G.F_GUIDE and 'guide' or 'back', orientation = 'bm'}, func = 'set_button_pip'}}
            }}
          }},
          {n=G.UIT.R, config={align = "cm", minh = 1.75, minw = 1.5,padding = 0.05, r = 0.1, hover = true, colour = G.C.ORANGE, button = "options", shadow = true}, nodes={
            {n=G.UIT.C, config={align = "cm", maxw = 1.4, focus_args = {button = 'start', orientation = 'bm'}, func = 'set_button_pip'}, nodes={
              {n=G.UIT.T, config={text = localize('b_options'), scale = scale, colour = G.C.UI.TEXT_LIGHT, shadow = true}}
            }},
          }}
        }}
    }

    return {n=G.UIT.ROOT, config = {align = "cm", padding = 0.03, colour = G.C.UI.TRANSPARENT_DARK}, nodes={
      {n=G.UIT.R, config = {align = "cm", padding= 0.05, colour = G.C.DYN_UI.MAIN, r=0.1}, nodes={
        {n=G.UIT.R, config={align = "cm", colour = G.C.DYN_UI.BOSS_DARK, r=0.1, minh = 30, padding = 0.08}, nodes={
          {n=G.UIT.R, config={align = "cm", minh = 0.3}, nodes={}},
          {n=G.UIT.R, config={align = "cm", id = 'row_blind', minw = 1, minh = 3.75}, nodes={}},
          contents.dollars_chips,
          contents.hand,
          {n=G.UIT.R, config={align = "cm", id = 'row_round'}, nodes={
            {n=G.UIT.C, config={align = "cm"}, nodes=contents.buttons},
            {n=G.UIT.C, config={align = "cm"}, nodes=contents.round}
          }},
        }}
      }}
    }}
end

function create_UIBox_blind_select()
  G.blind_prompt_box = UIBox{
    definition =
      {n=G.UIT.ROOT, config = {align = 'cm', colour = G.C.CLEAR, padding = 0.2}, nodes={
        {n=G.UIT.R, config={align = "cm"}, nodes={
          {n=G.UIT.O, config={object = DynaText({string = localize('ph_choose_blind_1'), colours = {G.C.WHITE}, shadow = true, bump = true, scale = 0.6, pop_in = 0.5, maxw = 5}), id = 'prompt_dynatext1'}}
        }},
        {n=G.UIT.R, config={align = "cm"}, nodes={
          {n=G.UIT.O, config={object = DynaText({string = localize('ph_choose_blind_2'), colours = {G.C.WHITE}, shadow = true, bump = true, scale = 0.7, pop_in = 0.5, maxw = 5, silent = true}), id = 'prompt_dynatext2'}}
        }},
        (G.GAME.used_vouchers["v_retcon"] or G.GAME.used_vouchers["v_directors_cut"]) and
        UIBox_button({label = {localize('b_reroll_boss'), localize('$')..'10'}, button = "reroll_boss", func = 'reroll_boss_button'}) or nil
      }},
    config = {align="cm", offset = {x=0,y=-15},major = G.HUD:get_UIE_by_ID('row_blind'), bond = 'Weak'}
  }
  G.E_MANAGER:add_event(Event({
    trigger = 'immediate',
    func = (function()
        G.blind_prompt_box.alignment.offset.y = 0
        return true
    end)
  }))

  local width = G.hand.T.w
  G.GAME.blind_on_deck = 
    not (G.GAME.round_resets.blind_states.Small == 'Defeated' or G.GAME.round_resets.blind_states.Small == 'Skipped' or G.GAME.round_resets.blind_states.Small == 'Hide') and 'Small' or
    not (G.GAME.round_resets.blind_states.Big == 'Defeated' or G.GAME.round_resets.blind_states.Big == 'Skipped'or G.GAME.round_resets.blind_states.Big == 'Hide') and 'Big' or 
    'Boss'
  
  G.blind_select_opts = {}
  G.blind_select_opts.small = G.GAME.round_resets.blind_states['Small'] ~= 'Hide' and UIBox{definition = {n=G.UIT.ROOT, config={align = "cm", colour = G.C.CLEAR}, nodes={UIBox_dyn_container({create_UIBox_blind_choice('Small')},false,get_blind_main_colour('Small'))}}, config = {align="bmi", offset = {x=0,y=0}}} or nil
  G.blind_select_opts.big = G.GAME.round_resets.blind_states['Big'] ~= 'Hide' and UIBox{definition = {n=G.UIT.ROOT, config={align = "cm", colour = G.C.CLEAR}, nodes={UIBox_dyn_container({create_UIBox_blind_choice('Big')},false,get_blind_main_colour('Big'))}}, config = {align="bmi", offset = {x=0,y=0}}} or nil
  G.blind_select_opts.boss = G.GAME.round_resets.blind_states['Boss'] ~= 'Hide' and UIBox{definition = {n=G.UIT.ROOT, config={align = "cm", colour = G.C.CLEAR}, nodes={UIBox_dyn_container({create_UIBox_blind_choice('Boss')},false,get_blind_main_colour('Boss'), mix_colours(G.C.BLACK, get_blind_main_colour('Boss'), 0.8))}}, config = {align="bmi", offset = {x=0,y=0}}} or nil
 
  local t = {n=G.UIT.ROOT, config = {align = 'tm',minw = width, r = 0.15, colour = G.C.CLEAR}, nodes={
    {n=G.UIT.R, config={align = "cm", padding = 0.5}, nodes={
      G.GAME.round_resets.blind_states['Small'] ~= 'Hide' and {n=G.UIT.O, config={align = "cm", object = G.blind_select_opts.small}} or nil,
      G.GAME.round_resets.blind_states['Big'] ~= 'Hide' and {n=G.UIT.O, config={align = "cm", object = G.blind_select_opts.big}} or nil,
      G.GAME.round_resets.blind_states['Boss'] ~= 'Hide' and {n=G.UIT.O, config={align = "cm", object = G.blind_select_opts.boss}} or nil,
    }}
  }}
  return t 
end

function create_UIBox_blind_tag(blind_choice, run_info)
  G.GAME.round_resets.blind_tags = G.GAME.round_resets.blind_tags or {}
  if not G.GAME.round_resets.blind_tags[blind_choice] then return nil end
  local _tag = Tag(G.GAME.round_resets.blind_tags[blind_choice], nil, blind_choice)
  local _tag_ui, _tag_sprite = _tag:generate_UI()
  _tag_sprite.states.collide.can = not not run_info
  return 
  {n=G.UIT.R, config={id = 'tag_container', ref_table = _tag, align = "cm"}, nodes={
    {n=G.UIT.R, config={align = 'tm', minh = 0.65}, nodes={
      {n=G.UIT.T, config={text = localize('k_or'), scale = 0.55, colour = disabled and G.C.UI.TEXT_INACTIVE or G.C.WHITE, shadow = not disabled}},
    }},
      {n=G.UIT.R, config={id = 'tag_'..blind_choice, align = "cm", r = 0.1, padding = 0.1, minw = 1, can_collide = true, ref_table = _tag_sprite}, nodes={
        {n=G.UIT.C, config={id = 'tag_desc', align = "cm", minh = 1}, nodes={
          _tag_ui
        }},
        not run_info and {n=G.UIT.C, config={align = "cm", colour = G.C.UI.BACKGROUND_INACTIVE, minh = 0.6, minw = 2, maxw = 2, padding = 0.07, r = 0.1, shadow = true, hover = true, one_press = true, button = 'skip_blind', func = 'hover_tag_proxy', ref_table = _tag}, nodes={
          {n=G.UIT.T, config={text = localize('b_skip_blind'), scale = 0.4, colour = G.C.UI.TEXT_INACTIVE}}
        }} or {n=G.UIT.C, config={align = "cm", padding = 0.1, emboss = 0.05, colour = mix_colours(G.C.BLUE, G.C.BLACK, 0.4), r = 0.1, maxw = 2}, nodes={
          {n=G.UIT.T, config={text = localize('b_skip_reward'), scale = 0.35, colour = G.C.WHITE}},
        }},
      }}
  }}
end

function create_UIBox_blind_choice(type, run_info)
  if not G.GAME.blind_on_deck then
    G.GAME.blind_on_deck = 'Small'
  end
  if not run_info then G.GAME.round_resets.blind_states[G.GAME.blind_on_deck] = 'Select' end

  local disabled = false
  type = type or 'Small'

  local blind_choice = {
    config = G.P_BLINDS[G.GAME.round_resets.blind_choices[type]],
  }

  blind_choice.animation = AnimatedSprite(0,0, 1.4, 1.4, G.ANIMATION_ATLAS['blind_chips'],  blind_choice.config.pos)
  blind_choice.animation:define_draw_steps({
    {shader = 'dissolve', shadow_height = 0.05},
    {shader = 'dissolve'}
  })
  local extras = nil
  local stake_sprite = get_stake_sprite(G.GAME.stake or 1, 0.5)

  G.GAME.orbital_choices = G.GAME.orbital_choices or {}
  G.GAME.orbital_choices[G.GAME.round_resets.ante] = G.GAME.orbital_choices[G.GAME.round_resets.ante] or {}

  if not G.GAME.orbital_choices[G.GAME.round_resets.ante][type] then 
    local _poker_hands = {}
    for k, v in pairs(G.GAME.hands) do
        if v.visible then _poker_hands[#_poker_hands+1] = k end
    end

    G.GAME.orbital_choices[G.GAME.round_resets.ante][type] = pseudorandom_element(_poker_hands, pseudoseed('orbital'))
  end



  if type == 'Small' then
    extras = create_UIBox_blind_tag(type, run_info)
  elseif type == 'Big' then
    extras = create_UIBox_blind_tag(type, run_info)
  elseif not run_info then
    local dt1 = DynaText({string = {{string = localize('ph_up_ante_1'), colour = G.C.FILTER}}, colours = {G.C.BLACK}, scale = 0.55, silent = true, pop_delay = 4.5, shadow = true, bump = true, maxw = 3})
    local dt2 = DynaText({string = {{string = localize('ph_up_ante_2'), colour = G.C.WHITE}},colours = {G.C.CHANCE}, scale = 0.35, silent = true, pop_delay = 4.5, shadow = true, maxw = 3})
    local dt3 = DynaText({string = {{string = localize('ph_up_ante_3'), colour = G.C.WHITE}},colours = {G.C.CHANCE}, scale = 0.35, silent = true, pop_delay = 4.5, shadow = true, maxw = 3})
    extras = 
    {n=G.UIT.R, config={align = "cm"}, nodes={
        {n=G.UIT.R, config={align = "cm", padding = 0.07, r = 0.1, colour = {0,0,0,0.12}, minw = 2.9}, nodes={
          {n=G.UIT.R, config={align = "cm"}, nodes={
            {n=G.UIT.O, config={object = dt1}},
          }},
          {n=G.UIT.R, config={align = "cm"}, nodes={
            {n=G.UIT.O, config={object = dt2}},
          }},
          {n=G.UIT.R, config={align = "cm"}, nodes={
            {n=G.UIT.O, config={object = dt3}},
          }},
        }},
      }}
  end
  G.GAME.round_resets.blind_ante = G.GAME.round_resets.blind_ante or G.GAME.round_resets.ante
  local loc_target = localize{type = 'raw_descriptions', key = blind_choice.config.key, set = 'Blind', vars = {localize(G.GAME.current_round.most_played_poker_hand, 'poker_hands')}}
  local loc_name = localize{type = 'name_text', key = blind_choice.config.key, set = 'Blind'}
  local text_table = loc_target
  local blind_col = get_blind_main_colour(type)
  local blind_amt = get_blind_amount(G.GAME.round_resets.blind_ante)*blind_choice.config.mult*G.GAME.starting_params.ante_scaling

  local blind_state = G.GAME.round_resets.blind_states[type]
  local _reward = true
  if G.GAME.modifiers.no_blind_reward and G.GAME.modifiers.no_blind_reward[type] then _reward = nil end
  if blind_state == 'Select' then blind_state = 'Current' end
  local run_info_colour = run_info and (blind_state == 'Defeated' and G.C.GREY or blind_state == 'Skipped' and G.C.BLUE or blind_state == 'Upcoming' and G.C.ORANGE or blind_state == 'Current' and G.C.RED or G.C.GOLD)
  local t = 
  {n=G.UIT.R, config={id = type, align = "tm", func = 'blind_choice_handler', minh = not run_info and 10 or nil, ref_table = {deck = nil, run_info = run_info}, r = 0.1, padding = 0.05}, nodes={
    {n=G.UIT.R, config={align = "cm", colour = mix_colours(G.C.BLACK, G.C.L_BLACK, 0.5), r = 0.1, outline = 1, outline_colour = G.C.L_BLACK}, nodes={  
      {n=G.UIT.R, config={align = "cm", padding = 0.2}, nodes={
          not run_info and {n=G.UIT.R, config={id = 'select_blind_button', align = "cm", ref_table = blind_choice.config, colour = disabled and G.C.UI.BACKGROUND_INACTIVE or G.C.ORANGE, minh = 0.6, minw = 2.7, padding = 0.07, r = 0.1, shadow = true, hover = true, one_press = true, button = 'select_blind'}, nodes={
            {n=G.UIT.T, config={ref_table = G.GAME.round_resets.loc_blind_states, ref_value = type, scale = 0.45, colour = disabled and G.C.UI.TEXT_INACTIVE or G.C.UI.TEXT_LIGHT, shadow = not disabled}}
          }} or 
          {n=G.UIT.R, config={id = 'select_blind_button', align = "cm", ref_table = blind_choice.config, colour = run_info_colour, minh = 0.6, minw = 2.7, padding = 0.07, r = 0.1, emboss = 0.08}, nodes={
            {n=G.UIT.T, config={text = localize(blind_state, 'blind_states'), scale = 0.45, colour = G.C.UI.TEXT_LIGHT, shadow = true}}
          }}
        }},
        {n=G.UIT.R, config={id = 'blind_name',align = "cm", padding = 0.07}, nodes={
          {n=G.UIT.R, config={align = "cm", r = 0.1, outline = 1, outline_colour = blind_col, colour = darken(blind_col, 0.3), minw = 2.9, emboss = 0.1, padding = 0.07, line_emboss = 1}, nodes={
            {n=G.UIT.O, config={object = DynaText({string = loc_name, colours = {disabled and G.C.UI.TEXT_INACTIVE or G.C.WHITE}, shadow = not disabled, float = not disabled, y_offset = -4, scale = 0.45, maxw =2.8})}},
          }},
        }},
        {n=G.UIT.R, config={align = "cm", padding = 0.05}, nodes={
          {n=G.UIT.R, config={id = 'blind_desc', align = "cm", padding = 0.05}, nodes={
            {n=G.UIT.R, config={align = "cm"}, nodes={
              {n=G.UIT.R, config={align = "cm", minh = 1.5}, nodes={
                {n=G.UIT.O, config={object = blind_choice.animation}},
              }},
              text_table[1] and {n=G.UIT.R, config={align = "cm", minh = 0.7, padding = 0.05, minw = 2.9}, nodes={
                text_table[1] and {n=G.UIT.R, config={align = "cm", maxw = 2.8}, nodes={
                  {n=G.UIT.T, config={id = blind_choice.config.key, ref_table = {val = ''}, ref_value = 'val', scale = 0.32, colour = disabled and G.C.UI.TEXT_INACTIVE or G.C.WHITE, shadow = not disabled, func = 'HUD_blind_debuff_prefix'}},
                  {n=G.UIT.T, config={text = text_table[1] or '-', scale = 0.32, colour = disabled and G.C.UI.TEXT_INACTIVE or G.C.WHITE, shadow = not disabled}}
                }} or nil,
                text_table[2] and {n=G.UIT.R, config={align = "cm", maxw = 2.8}, nodes={
                  {n=G.UIT.T, config={text = text_table[2] or '-', scale = 0.32, colour = disabled and G.C.UI.TEXT_INACTIVE or G.C.WHITE, shadow = not disabled}}
                }} or nil,
              }} or nil,
            }},
            {n=G.UIT.R, config={align = "cm",r = 0.1, padding = 0.05, minw = 3.1, colour = G.C.BLACK, emboss = 0.05}, nodes={
              {n=G.UIT.R, config={align = "cm", maxw = 3}, nodes={
                {n=G.UIT.T, config={text = localize('ph_blind_score_at_least'), scale = 0.3, colour = disabled and G.C.UI.TEXT_INACTIVE or G.C.WHITE, shadow = not disabled}}
              }},
              {n=G.UIT.R, config={align = "cm", minh = 0.6}, nodes={
                {n=G.UIT.O, config={w=0.5,h=0.5, colour = G.C.BLUE, object = stake_sprite, hover = true, can_collide = false}},
                {n=G.UIT.B, config={h=0.1,w=0.1}},
                {n=G.UIT.T, config={text = number_format(blind_amt), scale = score_number_scale(0.9, blind_amt), colour = disabled and G.C.UI.TEXT_INACTIVE or G.C.RED, shadow =  not disabled}}
              }},
              _reward and {n=G.UIT.R, config={align = "cm"}, nodes={
                {n=G.UIT.T, config={text = localize('ph_blind_reward'), scale = 0.35, colour = disabled and G.C.UI.TEXT_INACTIVE or G.C.WHITE, shadow = not disabled}},
                {n=G.UIT.T, config={text = string.rep(localize("$"), blind_choice.config.dollars)..'+', scale = 0.35, colour = disabled and G.C.UI.TEXT_INACTIVE or G.C.MONEY, shadow = not disabled}}
              }} or nil,
            }},
          }},
        }},
      }},
        {n=G.UIT.R, config={id = 'blind_extras', align = "cm"}, nodes={
          extras,
        }}

    }}
  return t
end
  
function create_UIBox_round_evaluation()
  local width = G.hand.T.w-2
  local t = {n=G.UIT.ROOT, config = {align = 'tm',colour = G.C.CLEAR}, nodes={
    UIBox_dyn_container(
      {
        {n=G.UIT.R, config={align = "tm", minw = width, minh = 3, padding = 0.1, r = 0.1, colour = G.C.BLACK, emboss = 0.05}, nodes={
          {n=G.UIT.R, config={align = "cm", minw = width, minh = 1.4}, nodes={}},
          {n=G.UIT.R, config={align = "cm", minw = width, id = 'base_round_eval'}, nodes={}},
          {n=G.UIT.R, config={align = "cm", minw = width, id = 'bonus_round_eval'}, nodes={}}
        }},
        {n=G.UIT.R, config={align = "cm", minh = 0.05}, nodes={}},
        {n=G.UIT.R, config={align = "cm", minw = width, id = 'eval_bottom'}, nodes={}}
      },false)
    }}
return t
end

function create_UIBox_arcana_pack()
  local _size = G.GAME.pack_size
  G.pack_cards = CardArea(
    G.ROOM.T.x + 9 + G.hand.T.x, G.hand.T.y,
    _size*G.CARD_W,
    1.05*G.CARD_H, 
    {card_limit = _size, type = 'consumeable', highlight_limit = 1})

    local t = {n=G.UIT.ROOT, config = {align = 'tm', r = 0.15, colour = G.C.CLEAR, padding = 0.15}, nodes={
      {n=G.UIT.R, config={align = "cl", colour = G.C.CLEAR,r=0.15, padding = 0.1, minh = 2, shadow = true}, nodes={
        {n=G.UIT.R, config={align = "cm"}, nodes={
        {n=G.UIT.C, config={align = "cm", padding = 0.1}, nodes={
          {n=G.UIT.C, config={align = "cm", r=0.2, colour = G.C.CLEAR, shadow = true}, nodes={
            {n=G.UIT.O, config={object = G.pack_cards}},
          }}
        }}
      }},
      {n=G.UIT.R, config={align = "cm"}, nodes={
      }},
      {n=G.UIT.R, config={align = "tm"}, nodes={
        {n=G.UIT.C,config={align = "tm", padding = 0.05, minw = 2.4}, nodes={}},
        {n=G.UIT.C,config={align = "tm", padding = 0.05}, nodes={
        UIBox_dyn_container({
          {n=G.UIT.C, config={align = "cm", padding = 0.05, minw = 4}, nodes={
            {n=G.UIT.R,config={align = "bm", padding = 0.05}, nodes={
              {n=G.UIT.O, config={object = DynaText({string = localize('k_arcana_pack'), colours = {G.C.WHITE},shadow = true, rotate = true, bump = true, spacing =2, scale = 0.7, maxw = 4, pop_in = 0.5})}}
            }},
            {n=G.UIT.R,config={align = "bm", padding = 0.05}, nodes={
              {n=G.UIT.O, config={object = DynaText({string = {localize('k_choose')..' '}, colours = {G.C.WHITE},shadow = true, rotate = true, bump = true, spacing =2, scale = 0.5, pop_in = 0.7})}},
              {n=G.UIT.O, config={object = DynaText({string = {{ref_table = G.GAME, ref_value = 'pack_choices'}}, colours = {G.C.WHITE},shadow = true, rotate = true, bump = true, spacing =2, scale = 0.5, pop_in = 0.7})}}
            }},
          }}
        }),
      }},
        {n=G.UIT.C,config={align = "tm", padding = 0.05, minw = 2.4}, nodes={
          {n=G.UIT.R,config={minh =0.2}, nodes={}},
          {n=G.UIT.R,config={align = "tm",padding = 0.2, minh = 1.2, minw = 1.8, r=0.15,colour = G.C.GREY, one_press = true, button = 'skip_booster', hover = true,shadow = true, func = 'can_skip_booster'}, nodes = {
            {n=G.UIT.T, config={text = localize('b_skip'), scale = 0.5, colour = G.C.WHITE, shadow = true, focus_args = {button = 'y', orientation = 'bm'}, func = 'set_button_pip'}}
          }}
        }}
      }}
    }}
  }}
  return t
end

function create_UIBox_spectral_pack()
  local _size = G.GAME.pack_size
  G.pack_cards = CardArea(
    G.ROOM.T.x + 9 + G.hand.T.x, G.hand.T.y,
    _size*G.CARD_W,
    1.05*G.CARD_H, 
    {card_limit = _size, type = 'consumeable', highlight_limit = 1})

    local t = {n=G.UIT.ROOT, config = {align = 'tm', r = 0.15, colour = G.C.CLEAR, padding = 0.15}, nodes={
      {n=G.UIT.R, config={align = "cl", colour = G.C.CLEAR,r=0.15, padding = 0.1, minh = 2, shadow = true}, nodes={
        {n=G.UIT.R, config={align = "cm"}, nodes={
        {n=G.UIT.C, config={align = "cm", padding = 0.1}, nodes={
          {n=G.UIT.C, config={align = "cm", r=0.2, colour = G.C.CLEAR, shadow = true}, nodes={
            {n=G.UIT.O, config={object = G.pack_cards}},
          }}
        }}
      }},
      {n=G.UIT.R, config={align = "cm"}, nodes={
      }},
      {n=G.UIT.R, config={align = "tm"}, nodes={
        {n=G.UIT.C,config={align = "tm", padding = 0.05, minw = 2.4}, nodes={}},
        {n=G.UIT.C,config={align = "tm", padding = 0.05}, nodes={
        UIBox_dyn_container({
          {n=G.UIT.C, config={align = "cm", padding = 0.05, minw = 4}, nodes={
            {n=G.UIT.R,config={align = "bm", padding = 0.05}, nodes={
              {n=G.UIT.O, config={object = DynaText({string = localize('k_spectral_pack'), colours = {G.C.WHITE},shadow = true, rotate = true, bump = true, spacing =2, scale = 0.7, maxw = 4, pop_in = 0.5})}}
            }},
            {n=G.UIT.R,config={align = "bm", padding = 0.05}, nodes={
              {n=G.UIT.O, config={object = DynaText({string = {localize('k_choose')..' '}, colours = {G.C.WHITE},shadow = true, rotate = true, bump = true, spacing =2, scale = 0.5, pop_in = 0.7})}},
              {n=G.UIT.O, config={object = DynaText({string = {{ref_table = G.GAME, ref_value = 'pack_choices'}}, colours = {G.C.WHITE},shadow = true, rotate = true, bump = true, spacing =2, scale = 0.5, pop_in = 0.7})}}
            }},
          }}
        }),
      }},
        {n=G.UIT.C,config={align = "tm", padding = 0.05, minw = 2.4}, nodes={
          {n=G.UIT.R,config={minh =0.2}, nodes={}},
          {n=G.UIT.R,config={align = "tm",padding = 0.2, minh = 1.2, minw = 1.8, r=0.15,colour = G.C.GREY, one_press = true, button = 'skip_booster', hover = true,shadow = true, func = 'can_skip_booster'}, nodes = {
            {n=G.UIT.T, config={text = localize('b_skip'), scale = 0.5, colour = G.C.WHITE, shadow = true, focus_args = {button = 'y', orientation = 'bm'}, func = 'set_button_pip'}}
          }}
        }}
      }}
    }}
  }}
  return t
end

function create_UIBox_standard_pack()
  local _size = G.GAME.pack_size
  G.pack_cards = CardArea(
    G.ROOM.T.x + 9 + G.hand.T.x, G.hand.T.y,
    _size*G.CARD_W*1.1,
    1.05*G.CARD_H, 
    {card_limit = _size, type = 'consumeable', highlight_limit = 1})

    local t = {n=G.UIT.ROOT, config = {align = 'tm', r = 0.15, colour = G.C.CLEAR, padding = 0.15}, nodes={
      {n=G.UIT.R, config={align = "cl", colour = G.C.CLEAR,r=0.15, padding = 0.1, minh = 2, shadow = true}, nodes={
        {n=G.UIT.R, config={align = "cm"}, nodes={
        {n=G.UIT.C, config={align = "cm", padding = 0.1}, nodes={
          {n=G.UIT.C, config={align = "cm", r=0.2, colour = G.C.CLEAR, shadow = true}, nodes={
            {n=G.UIT.O, config={object = G.pack_cards}},
          }}
        }}
      }},
      {n=G.UIT.R, config={align = "cm"}, nodes={
      }},
      {n=G.UIT.R, config={align = "tm"}, nodes={
        {n=G.UIT.C,config={align = "tm", padding = 0.05, minw = 2.4}, nodes={}},
        {n=G.UIT.C,config={align = "tm", padding = 0.05}, nodes={
        UIBox_dyn_container({
          {n=G.UIT.C, config={align = "cm", padding = 0.05, minw = 4}, nodes={
            {n=G.UIT.R,config={align = "bm", padding = 0.05}, nodes={
              {n=G.UIT.O, config={object = DynaText({string = localize('k_standard_pack'), colours = {G.C.WHITE},shadow = true, rotate = true, bump = true, spacing =2, scale = 0.7, maxw = 4, pop_in = 0.5})}}
            }},
            {n=G.UIT.R,config={align = "bm", padding = 0.05}, nodes={
              {n=G.UIT.O, config={object = DynaText({string = {localize('k_choose')..' '}, colours = {G.C.WHITE},shadow = true, rotate = true, bump = true, spacing =2, scale = 0.5, pop_in = 0.7})}},
              {n=G.UIT.O, config={object = DynaText({string = {{ref_table = G.GAME, ref_value = 'pack_choices'}}, colours = {G.C.WHITE},shadow = true, rotate = true, bump = true, spacing =2, scale = 0.5, pop_in = 0.7})}}
            }},
          }}
        }),
      }},
        {n=G.UIT.C,config={align = "tm", padding = 0.05, minw = 2.4}, nodes={
          {n=G.UIT.R,config={minh =0.2}, nodes={}},
          {n=G.UIT.R,config={align = "tm",padding = 0.2, minh = 1.2, minw = 1.8, r=0.15,colour = G.C.GREY, one_press = true, button = 'skip_booster', hover = true,shadow = true, func = 'can_skip_booster'}, nodes = {
            {n=G.UIT.T, config={text = localize('b_skip'), scale = 0.5, colour = G.C.WHITE, shadow = true, focus_args = {button = 'y', orientation = 'bm'}, func = 'set_button_pip'}}
          }}
        }}
      }}
    }}
  }}
  return t
end

function create_UIBox_buffoon_pack()
  local _size = G.GAME.pack_size
  G.pack_cards = CardArea(
    G.ROOM.T.x + 9 + G.hand.T.x, G.hand.T.y,
    _size*G.CARD_W*1.1,
    1.05*G.CARD_H, 
    {card_limit = _size, type = 'consumeable', highlight_limit = 1})

    local t = {n=G.UIT.ROOT, config = {align = 'tm', r = 0.15, colour = G.C.CLEAR, padding = 0.15}, nodes={
      {n=G.UIT.R, config={align = "cl", colour = G.C.CLEAR,r=0.15, padding = 0.1, minh = 2, shadow = true}, nodes={
        {n=G.UIT.R, config={align = "cm"}, nodes={
        {n=G.UIT.C, config={align = "cm", padding = 0.1}, nodes={
          {n=G.UIT.C, config={align = "cm", r=0.2, colour = G.C.CLEAR, shadow = true}, nodes={
            {n=G.UIT.O, config={object = G.pack_cards}},
          }}
        }}
      }},
      {n=G.UIT.R, config={align = "cm"}, nodes={
      }},
      {n=G.UIT.R, config={align = "tm"}, nodes={
        {n=G.UIT.C,config={align = "tm", padding = 0.05, minw = 2.4}, nodes={}},
        {n=G.UIT.C,config={align = "tm", padding = 0.05}, nodes={
        UIBox_dyn_container({
          {n=G.UIT.C, config={align = "cm", padding = 0.05, minw = 4}, nodes={
            {n=G.UIT.R,config={align = "bm", padding = 0.05}, nodes={
              {n=G.UIT.O, config={object = DynaText({string = localize('k_buffoon_pack'), colours = {G.C.WHITE},shadow = true, rotate = true, bump = true, spacing =2, scale = 0.7, maxw = 4, pop_in = 0.5})}}
            }},
            {n=G.UIT.R,config={align = "bm", padding = 0.05}, nodes={
              {n=G.UIT.O, config={object = DynaText({string = {localize('k_choose')..' '}, colours = {G.C.WHITE},shadow = true, rotate = true, bump = true, spacing =2, scale = 0.5, pop_in = 0.7})}},
              {n=G.UIT.O, config={object = DynaText({string = {{ref_table = G.GAME, ref_value = 'pack_choices'}}, colours = {G.C.WHITE},shadow = true, rotate = true, bump = true, spacing =2, scale = 0.5, pop_in = 0.7})}}
            }},
          }}
        }),
      }},
        {n=G.UIT.C,config={align = "tm", padding = 0.05, minw = 2.4}, nodes={
          {n=G.UIT.R,config={minh =0.2}, nodes={}},
          {n=G.UIT.R,config={align = "tm",padding = 0.2, minh = 1.2, minw = 1.8, r=0.15,colour = G.C.GREY, one_press = true, button = 'skip_booster', hover = true,shadow = true, func = 'can_skip_booster'}, nodes = {
            {n=G.UIT.T, config={text = localize('b_skip'), scale = 0.5, colour = G.C.WHITE, shadow = true, focus_args = {button = 'y', orientation = 'bm'}, func = 'set_button_pip'}}
          }}
        }}
      }}
    }}
  }}
  return t
end

function create_UIBox_celestial_pack()
  local _size = G.GAME.pack_size
  G.pack_cards = CardArea(
    G.ROOM.T.x + 9 + G.hand.T.x, G.hand.T.y,
    _size*G.CARD_W*1.1 + 0.5,
    1.05*G.CARD_H, 
    {card_limit = _size, type = 'consumeable', highlight_limit = 1})

    local t = {n=G.UIT.ROOT, config = {align = 'tm', r = 0.15, colour = G.C.CLEAR, padding = 0.15}, nodes={
      {n=G.UIT.R, config={align = "cl", colour = G.C.CLEAR,r=0.15, padding = 0.1, minh = 2, shadow = true}, nodes={
        {n=G.UIT.R, config={align = "cm"}, nodes={
        {n=G.UIT.C, config={align = "cm", padding = 0.1}, nodes={
          {n=G.UIT.C, config={align = "cm", r=0.2, colour = G.C.CLEAR, shadow = true}, nodes={
            {n=G.UIT.O, config={object = G.pack_cards}},
          }}
        }}
      }},
      {n=G.UIT.R, config={align = "cm"}, nodes={
      }},
      {n=G.UIT.R, config={align = "tm"}, nodes={
        {n=G.UIT.C,config={align = "tm", padding = 0.05, minw = 2.4}, nodes={}},
        {n=G.UIT.C,config={align = "tm", padding = 0.05}, nodes={
        UIBox_dyn_container({
          {n=G.UIT.C, config={align = "cm", padding = 0.05, minw = 4}, nodes={
            {n=G.UIT.R,config={align = "bm", padding = 0.05}, nodes={
              {n=G.UIT.O, config={object = DynaText({string = localize('k_celestial_pack'), colours = {G.C.WHITE},shadow = true, rotate = true, bump = true, spacing =2, scale = 0.7, maxw = 4, pop_in = 0.5})}}
            }},
            {n=G.UIT.R,config={align = "bm", padding = 0.05}, nodes={
              {n=G.UIT.O, config={object = DynaText({string = {localize('k_choose')..' '}, colours = {G.C.WHITE},shadow = true, rotate = true, bump = true, spacing =2, scale = 0.5, pop_in = 0.7})}},
              {n=G.UIT.O, config={object = DynaText({string = {{ref_table = G.GAME, ref_value = 'pack_choices'}}, colours = {G.C.WHITE},shadow = true, rotate = true, bump = true, spacing =2, scale = 0.5, pop_in = 0.7})}}
            }},
          }}
        }),
      }},
        {n=G.UIT.C,config={align = "tm", padding = 0.05, minw = 2.4}, nodes={
          {n=G.UIT.R,config={minh =0.2}, nodes={}},
          {n=G.UIT.R,config={align = "tm",padding = 0.2, minh = 1.2, minw = 1.8, r=0.15,colour = G.C.GREY, one_press = true, button = 'skip_booster', hover = true,shadow = true, func = 'can_skip_booster'}, nodes = {
            {n=G.UIT.T, config={text = localize('b_skip'), scale = 0.5, colour = G.C.WHITE, shadow = true, focus_args = {button = 'y', orientation = 'bm'}, func = 'set_button_pip'}}
          }}
        }}
      }}
    }}
  }}
  return t
end

function create_UIBox_card_alert(args)
  args = args or {}
  return {n=G.UIT.ROOT, config = {align = 'cm', colour = G.C.CLEAR, refresh_movement = true}, nodes={
      {n=G.UIT.R, config={align = "cm", r = 0.15, minw = 0.42, minh = 0.42, colour = args.no_bg and G.C.CLEAR or args.bg_col or (args.red_bad and darken(G.C.RED, 0.1) or G.C.RED), draw_layer = 1, emboss = 0.05, refresh_movement = true}, nodes={
        {n=G.UIT.O, config={object = DynaText({string = args.text or '!', colours = {G.C.WHITE},shadow = true, rotate = true,H_offset = args.y_offset or 0,bump_rate = args.text and 3 or 7, bump_amount = args.bump_amount or 3, bump = true,maxw = args.maxw, text_rot = args.text_rot or  0.2, spacing = 3*(args.scale or 1), scale = args.scale or 0.48})}}
      }},
  }}
end

function create_slider(args)
  args = args or {}
  args.colour = args.colour or G.C.RED
  args.w = args.w or 1
  args.h = args.h or 0.5
  args.label_scale = args.label_scale or 0.5
  args.text_scale = args.text_scale or 0.3
  args.min = args.min or 0
  args.max = args.max or 1
  args.decimal_places = args.decimal_places or 0
  args.text = string.format("%."..tostring(args.decimal_places).."f", args.ref_table[args.ref_value])
  local startval = args.w * (args.ref_table[args.ref_value] - args.min)/(args.max - args.min)

  local t = 
        {n=G.UIT.C, config={align = "cm", minw = args.w, min_h = args.h, padding = 0.1, r = 0.1, colour = G.C.CLEAR, focus_args = {type = 'slider'}}, nodes={
          {n=G.UIT.C, config={align = "cl", minw = args.w, r = 0.1,min_h = args.h,collideable = true, hover = true, colour = G.C.BLACK,emboss = 0.05,func = 'slider', refresh_movement = true}, nodes={
            {n=G.UIT.B, config={w=startval,h=args.h, r = 0.1, colour = args.colour, ref_table = args, refresh_movement = true}},
          }},
          {n=G.UIT.C, config={align = "cm", minh = args.h,r = 0.1, minw = 0.8, colour = args.colour,shadow = true}, nodes={
            {n=G.UIT.T, config={ref_table = args, ref_value = 'text', scale = args.text_scale, colour = G.C.UI.TEXT_LIGHT, decimal_places = args.decimal_places}}
          }},
        }}
  if args.label then 
    t = {n=G.UIT.R, config={align = "cm", minh = 1, minw = 1, padding = 0.1*args.label_scale, colour = G.C.CLEAR}, nodes={
      {n=G.UIT.R, config={align = "cm", padding = 0}, nodes={
        {n=G.UIT.T, config={text = args.label, scale = args.label_scale, colour = G.C.UI.TEXT_LIGHT}}
      }},
      {n=G.UIT.R, config={align = "cm", padding = 0}, nodes={
        t
      }}
    }}
  end
  return t
end

function create_toggle(args)
  args = args or {}
  args.active_colour = args.active_colour or G.C.RED
  args.inactive_colour = args.inactive_colour or G.C.BLACK
  args.w = args.w or 3
  args.h = args.h or 0.5
  args.scale = args.scale or 1
  args.label = args.label or 'TEST?'
  args.label_scale = args.label_scale or 0.4
  args.ref_table = args.ref_table or {}
  args.ref_value = args.ref_value or 'test'

  local check = Sprite(0,0,0.5*args.scale,0.5*args.scale,G.ASSET_ATLAS["icons"], {x=1, y=0})
  check.states.drag.can = false
  check.states.visible = false

  local info = nil
  if args.info then 
    info = {}
    for k, v in ipairs(args.info) do 
      table.insert(info, {n=G.UIT.R, config={align = "cm", minh = 0.05}, nodes={
        {n=G.UIT.T, config={text = v, scale = 0.25, colour = G.C.UI.TEXT_LIGHT}}
      }})
    end
    info =  {n=G.UIT.R, config={align = "cm", minh = 0.05}, nodes=info}
  end

  local t = 
        {n=args.col and G.UIT.C or G.UIT.R, config={align = "cm", padding = 0.1, r = 0.1, colour = G.C.CLEAR, focus_args = {funnel_from = true}}, nodes={
          {n=G.UIT.C, config={align = "cr", minw = args.w}, nodes={
            {n=G.UIT.T, config={text = args.label, scale = args.label_scale, colour = G.C.UI.TEXT_LIGHT}},
            {n=G.UIT.B, config={w = 0.1, h = 0.1}},
          }},
          {n=G.UIT.C, config={align = "cl", minw = 0.3*args.w}, nodes={
            {n=G.UIT.C, config={align = "cm", r = 0.1, colour = G.C.BLACK}, nodes={
              {n=G.UIT.C, config={align = "cm", r = 0.1, padding = 0.03, minw = 0.4*args.scale, minh = 0.4*args.scale, outline_colour = G.C.WHITE, outline = 1.2*args.scale, line_emboss = 0.5*args.scale, ref_table = args,
                  colour = args.inactive_colour,
                  button = 'toggle_button', button_dist = 0.2, hover = true, toggle_callback = args.callback, func = 'toggle', focus_args = {funnel_to = true}}, nodes={
                  {n=G.UIT.O, config={object = check}},
              }},
            }}
          }},
        }}
   if args.info then 
     t = {n=args.col and G.UIT.C or G.UIT.R, config={align = "cm"}, nodes={
       t,
       info,
     }}
   end
  return t
end

function create_option_cycle(args)
  args = args or {}
  args.colour = args.colour or G.C.RED
  args.options = args.options or {
    'Option 1',
    'Option 2'
  }
  args.current_option = args.current_option or 1
  args.current_option_val = args.options[args.current_option]
  args.opt_callback = args.opt_callback or nil
  args.scale = args.scale or 1
  args.ref_table = args.ref_table or nil
  args.ref_value = args.ref_value or nil
  args.w = (args.w or 2.5)*args.scale
  args.h = (args.h or 0.8)*args.scale
  args.text_scale = (args.text_scale or 0.5)*args.scale
  args.l = '<'
  args.r = '>'
  args.focus_args = args.focus_args or {}
  args.focus_args.type = 'cycle'

  local info = nil
  if args.info then 
    info = {}
    for k, v in ipairs(args.info) do 
      table.insert(info, {n=G.UIT.R, config={align = "cm", minh = 0.05}, nodes={
        {n=G.UIT.T, config={text = v, scale = 0.3*args.scale, colour = G.C.UI.TEXT_LIGHT}}
      }})
    end
    info =  {n=G.UIT.R, config={align = "cm", minh = 0.05}, nodes=info}
  end

  local disabled = #args.options < 2
  local pips = {}
  for i = 1, #args.options do 
    pips[#pips+1] = {n=G.UIT.B, config={w = 0.1*args.scale, h = 0.1*args.scale, r = 0.05, id = 'pip_'..i, colour = args.current_option == i and G.C.WHITE or G.C.BLACK}}
  end
  
  local choice_pips = not args.no_pips and {n=G.UIT.R, config={align = "cm", padding = (0.05 - (#args.options > 15 and 0.03 or 0))*args.scale}, nodes=pips} or nil

  local t = 
        {n=G.UIT.C, config={align = "cm", padding = 0.1, r = 0.1, colour = G.C.CLEAR, id = args.id and (not args.label and args.id or nil) or nil, focus_args = args.focus_args}, nodes={
          {n=G.UIT.C, config={align = "cm",r = 0.1, minw = 0.6*args.scale, hover = not disabled, colour = not disabled and args.colour or G.C.BLACK,shadow = not disabled, button = not disabled and 'option_cycle' or nil, ref_table = args, ref_value = 'l', focus_args = {type = 'none'}}, nodes={
            {n=G.UIT.T, config={ref_table = args, ref_value = 'l', scale = args.text_scale, colour = not disabled and G.C.UI.TEXT_LIGHT or G.C.UI.TEXT_INACTIVE}}
          }},
          args.mid and
          {n=G.UIT.C, config={id = 'cycle_main'}, nodes={
              {n=G.UIT.R, config={align = "cm", minh = 0.05}, nodes={
                args.mid
              }},
              not disabled and choice_pips or nil
          }}
          or {n=G.UIT.C, config={id = 'cycle_main', align = "cm", minw = args.w, minh = args.h, r = 0.1, padding = 0.05, colour = args.colour,emboss = 0.1, hover = true, can_collide = true, on_demand_tooltip = args.on_demand_tooltip}, nodes={
            {n=G.UIT.R, config={align = "cm"}, nodes={
              {n=G.UIT.R, config={align = "cm"}, nodes={
                {n=G.UIT.O, config={object = DynaText({string = {{ref_table = args, ref_value = "current_option_val"}}, colours = {G.C.UI.TEXT_LIGHT},pop_in = 0, pop_in_rate = 8, reset_pop_in = true,shadow = true, float = true, silent = true, bump = true, scale = args.text_scale, non_recalc = true})}},
              }},
              {n=G.UIT.R, config={align = "cm", minh = 0.05}, nodes={
              }},
              not disabled and choice_pips or nil
            }}
          }},
          {n=G.UIT.C, config={align = "cm",r = 0.1, minw = 0.6*args.scale, hover = not disabled, colour = not disabled and args.colour or G.C.BLACK,shadow = not disabled, button = not disabled and 'option_cycle' or nil, ref_table = args, ref_value = 'r', focus_args = {type = 'none'}}, nodes={
            {n=G.UIT.T, config={ref_table = args, ref_value = 'r', scale = args.text_scale, colour = not disabled and G.C.UI.TEXT_LIGHT or G.C.UI.TEXT_INACTIVE}}
          }},
        }}

  if args.cycle_shoulders then 
    t =    
    {n=G.UIT.R, config={align = "cm", colour = G.C.CLEAR}, nodes = {
      {n=G.UIT.C, config={minw = 0.7,align = "cm", colour = G.C.CLEAR,func = 'set_button_pip', focus_args = {button = 'leftshoulder', type = 'none', orientation = 'cm', scale = 0.7, offset = {x = -0.1, y = 0}}}, nodes = {}},
      {n=G.UIT.C, config={id = 'cycle_shoulders', padding = 0.1}, nodes={t}},
      {n=G.UIT.C, config={minw = 0.7,align = "cm", colour = G.C.CLEAR,func = 'set_button_pip', focus_args = {button = 'rightshoulder', type = 'none', orientation = 'cm', scale = 0.7, offset = {x = 0.1, y = 0}}}, nodes = {}},
    }}
  else
    t = 
    {n=G.UIT.R, config={align = "cm", colour = G.C.CLEAR, padding = 0.0}, nodes = {
      t
    }}
  end
  if args.label or args.info then 
    t = {n=G.UIT.R, config={align = "cm", padding = 0.05, id = args.id or nil}, nodes={
      args.label and {n=G.UIT.R, config={align = "cm"}, nodes={
        {n=G.UIT.T, config={text = args.label, scale = 0.5*args.scale, colour = G.C.UI.TEXT_LIGHT}}
      }} or nil,
      t,
      info,
    }}
  end
  return t
end

function create_tabs(args)
  args = args or {}
  args.colour = args.colour or G.C.RED
  args.tab_alignment = args.tab_alignment or 'cm'
  args.opt_callback = args.opt_callback or nil
  args.scale = args.scale or 1
  args.tab_w = args.tab_w or 0
  args.tab_h = args.tab_h or 0
  args.text_scale = (args.text_scale or 0.5)
  args.tabs = args.tabs or {
    {
      label = 'tab 1',
      chosen = true,
      func = nil,
      tab_definition_function = function() return  {n=G.UIT.ROOT, config={align = "cm"}, nodes={
        {n=G.UIT.T, config={text = 'A', scale = 1, colour = G.C.UI.TEXT_LIGHT}}
      }} end
    },
    {
      label = 'tab 2',
      chosen = false,
      tab_definition_function = function() return  {n=G.UIT.ROOT, config={align = "cm"}, nodes={
        {n=G.UIT.T, config={text = 'B', scale = 1, colour = G.C.UI.TEXT_LIGHT}}
      }} end
    },
    {
      label = 'tab 3',
      chosen = false,
      tab_definition_function = function() return  {n=G.UIT.ROOT, config={align = "cm"}, nodes={
        {n=G.UIT.T, config={text = 'C', scale = 1, colour = G.C.UI.TEXT_LIGHT}}
      }} end
    }
  }

  local tab_buttons = {}

  for k, v in ipairs(args.tabs) do
    if v.chosen then args.current = {k = k, v = v} end
    tab_buttons[#tab_buttons+1] = UIBox_button({id = 'tab_but_'..(v.label or ''), ref_table = v, button = 'change_tab', label = {v.label}, minh = 0.8*args.scale, minw = 2.5*args.scale, col = true, choice = true, scale = args.text_scale, chosen = v.chosen, func = v.func, focus_args = {type = 'none'}})
  end

  local t = 
  {n=G.UIT.R, config={padding = 0.0, align = "cm", colour = G.C.CLEAR}, nodes={
    {n=G.UIT.R, config={align = "cm", colour = G.C.CLEAR}, nodes = {
      (#args.tabs > 1 and not args.no_shoulders) and {n=G.UIT.C, config={minw = 0.7,align = "cm", colour = G.C.CLEAR,func = 'set_button_pip', focus_args = {button = 'leftshoulder', type = 'none', orientation = 'cm', scale = 0.7, offset = {x = -0.1, y = 0}}}, nodes = {}} or nil,
      {n=G.UIT.C, config={id = args.no_shoulders and 'no_shoulders' or 'tab_shoulders', ref_table = args, align = "cm", padding = 0.15, group = 1, collideable = true, focus_args = #args.tabs > 1 and {type = 'tab', nav = 'wide',snap_to = args.snap_to_nav, no_loop = args.no_loop} or nil}, nodes=tab_buttons},
      (#args.tabs > 1 and not args.no_shoulders) and {n=G.UIT.C, config={minw = 0.7,align = "cm", colour = G.C.CLEAR,func = 'set_button_pip', focus_args = {button = 'rightshoulder', type = 'none', orientation = 'cm', scale = 0.7, offset = {x = 0.1, y = 0}}}, nodes = {}} or nil,
    }},
    {n=G.UIT.R, config={align = args.tab_alignment, padding = args.padding or 0.1, no_fill = true, minh = args.tab_h, minw = args.tab_w}, nodes={
      {n=G.UIT.O, config={id = 'tab_contents', object = UIBox{definition = args.current.v.tab_definition_function(args.current.v.tab_definition_function_args), config = {offset = {x=0,y=0}}}}}
    }},
  }}

  return t
end

function create_text_input(args)
  args = args or {}
  args.colour = copy_table(args.colour) or copy_table(G.C.BLUE)
  args.hooked_colour = copy_table(args.hooked_colour) or darken(copy_table(G.C.BLUE), 0.3)
  args.w = args.w or 2.5
  args.h = args.h or 0.7
  args.text_scale = args.text_scale or 0.4
  args.max_length = args.max_length or 16
  args.all_caps = args.all_caps or false
  args.prompt_text = args.prompt_text or localize('k_enter_text')
  args.current_prompt_text = ''

  local text = {ref_table = args.ref_table, ref_value = args.ref_value, letters = {}, current_position = string.len(args.ref_table[args.ref_value])}
  local ui_letters = {}
  for i = 1, args.max_length do
    text.letters[i] = (args.ref_table[args.ref_value] and (string.sub(args.ref_table[args.ref_value], i, i) or '')) or ''
    ui_letters[i] = {n=G.UIT.T, config={ref_table = text.letters, ref_value = i, scale = args.text_scale, colour = G.C.UI.TEXT_LIGHT, id = 'letter_'..i}}
  end
  args.text = text

  local position_text_colour = lighten(copy_table(G.C.BLUE), 0.4)

  ui_letters[#ui_letters+1] = {n=G.UIT.T, config={ref_table = args, ref_value = 'current_prompt_text', scale = args.text_scale, colour = lighten(copy_table(args.colour), 0.4), id = 'prompt'}}
  ui_letters[#ui_letters+1] = {n=G.UIT.B, config={r = 0.03,w=0.1, h=0.4, colour = position_text_colour, id = 'position', func = 'flash'}}

  local t = 
       {n=G.UIT.C, config={align = "cm", draw_layer = 1, colour = G.C.CLEAR}, nodes = {
          {n=G.UIT.C, config={id = 'text_input', align = "cm", padding = 0.05, r = 0.1, draw_layer = 2, hover = true, colour = args.colour,minw = args.w, min_h = args.h, button = 'select_text_input', shadow = true}, nodes={
            {n=G.UIT.R, config={ref_table = args, padding = 0.05, align = "cm", r = 0.1, colour = G.C.CLEAR}, nodes={
              {n=G.UIT.R, config={ref_table = args, align = "cm", r = 0.1, colour = G.C.CLEAR, func = 'text_input'}, nodes=
                ui_letters
              }
            }}
          }}
        }}
  return t
end

function create_keyboard_input(args)
  local keyboard_rows = {
    '1234567890',
    'QWERTYUIOP',
    'ASDFGHJKL',
    'ZXCVBNM',
    args.space_key and ' ' or nil
  }
  local keyboard_button_rows = {
      {},{},{},{},{}
  }
  for k, v in ipairs(keyboard_rows) do
      for i = 1, #v do
          local c = v:sub(i,i)
          keyboard_button_rows[k][#keyboard_button_rows[k] +1] = create_keyboard_button(c, c == ' ' and 'y' or nil)
      end
  end
  return {n=G.UIT.ROOT, config={align = "cm", padding = 15, r = 0.1, colour = {G.C.GREY[1], G.C.GREY[2], G.C.GREY[3],0.7}}, nodes={
    {n=G.UIT.C, config={align = "cm", padding = 0.05, colour = G.C.CLEAR}, nodes = {
      {n=G.UIT.C, config={align = "cm", padding = 0.05, colour = G.C.BLACK, emboss = 0.05, r = 0.1, mid = true}, nodes = {
        {n=G.UIT.R, config={align = "cm", padding = 0.05}, nodes = {
          {n=G.UIT.C, config={align = "cm", padding = 0.05, colour = G.C.CLEAR}, nodes = {
              {n=G.UIT.R, config={align = "cm", padding = 0.07, colour = G.C.CLEAR}, nodes=keyboard_button_rows[1]},
              {n=G.UIT.R, config={align = "cm", padding = 0.07, colour = G.C.CLEAR}, nodes=keyboard_button_rows[2]},
              {n=G.UIT.R, config={align = "cm", padding = 0.07, colour = G.C.CLEAR}, nodes=keyboard_button_rows[3]},
              {n=G.UIT.R, config={align = "cm", padding = 0.07, colour = G.C.CLEAR}, nodes=keyboard_button_rows[4]},
              {n=G.UIT.R, config={align = "cm", padding = 0.07, colour = G.C.CLEAR}, nodes=keyboard_button_rows[5]}
          }},
          (args.backspace_key or args.return_key) and {n=G.UIT.C, config={align = "cm", padding = 0.05, colour = G.C.CLEAR}, nodes = {
              args.backspace_key and {n=G.UIT.R, config={align = "cm", padding = 0.05, colour = G.C.CLEAR}, nodes={create_keyboard_button('backspace', 'x')}} or nil,
              args.return_key and {n=G.UIT.R, config={align = "cm", padding = 0.05, colour = G.C.CLEAR}, nodes={create_keyboard_button('return', 'start')}} or nil,
              {n=G.UIT.R, config={align = "cm", padding = 0.05, colour = G.C.CLEAR}, nodes={create_keyboard_button('back', 'b')}}
          }} or nil
        }},
      }}
    }},
    
  }}
end

function create_keyboard_button(key, binding)
  local key_label = (key == 'backspace' and 'Backspace') or (key == ' ' and 'Space') or (key == 'back' and 'Back') or (key == 'return' and 'Enter') or key
  return UIBox_button{ label = {key_label}, button = "key_button", ref_table = {key = key == 'back' and 'return' or key},
      minw = key == ' ' and 6 or key == 'return' and 2.5 or key == 'backspace' and 2.5 or key == 'back' and 2.5 or 0.8,
      minh = key == 'return' and 1.5 or key == 'backspace' and 1.5 or key == 'back' and 0.8 or 0.7,
      col = true, colour = G.C.GREY, focus_args = binding and {button = binding, orientation = (key == ' ' or key == 'back') and 'cr' or 'bm', set_button_pip= true} or nil}
end

function create_dynatext_pips(args)
  args = args or {}

  args.active_colour = copy_table(args.colour) or G.C.RED
  args.inactive_colour = copy_table(args.inactive_colour) or {0,0,0,0.08}
  args.w = args.w or 0.07
  args.h = args.h or 0.07

  if not (args.dynatext) or not (#args.dynatext.strings > 1) then return end

  local pips = {}

  for i = 1, #args.dynatext.strings do
    pips[i] = {n=G.UIT.C, config={ref_table = args.dynatext, minw = args.w, minh = args.h, colour = G.C.UI.TEXT_INACTIVE, r = 0.1, id = 'pip_'..i, pipcol1 = args.active_colour, pipcol2 = args.inactive_colour, func = 'pip_dynatext'}}
  end

  return {n=G.UIT.R, config={padding = 0.05, align = "cm"}, nodes=pips}
end

function create_UIBox_options()  
  local current_seed = nil
  local restart = nil
  local main_menu = nil
  local your_collection = nil
  local credits = nil
  local customize = nil

  G.E_MANAGER:add_event(Event({
    blockable = false,
    func = function()
      G.REFRESH_ALERTS = true
    return true
    end
  }))

  if G.STAGE == G.STAGES.RUN then
    restart = UIBox_button{id = 'restart_button', label = {localize('b_start_new_run')}, button = "setup_run", minw = 5}
    main_menu = UIBox_button{ label = {localize('b_main_menu')}, button = "go_to_menu", minw = 5}
    your_collection = UIBox_button{ label = {localize('b_collection')}, button = "your_collection", minw = 5, id = 'your_collection'}
    current_seed = {n=G.UIT.R, config={align = "cm", padding = 0.05}, nodes={
        {n=G.UIT.C, config={align = "cm", padding = 0}, nodes={
        {n=G.UIT.T, config={text = localize('b_seed')..": ", scale = 0.4, colour = G.C.WHITE}}
      }},
      {n=G.UIT.C, config={align = "cm", padding = 0, minh = 0.8}, nodes={
        {n=G.UIT.C, config={align = "cm", padding = 0, minh = 0.8}, nodes={
          {n=G.UIT.R, config={align = "cm", r = 0.1, colour = G.GAME.seeded and G.C.RED or G.C.BLACK, minw = 1.8, minh = 0.5, padding = 0.1, emboss = 0.05}, nodes={
            {n=G.UIT.C, config={align = "cm"}, nodes={
              {n=G.UIT.T, config={ text = tostring(G.GAME.pseudorandom.seed), scale = 0.43, colour = G.C.UI.TEXT_LIGHT, shadow = true}}
            }}
          }}
        }}
      }},
      UIBox_button({col = true, button = 'copy_seed', label = {localize('b_copy')}, colour = G.C.BLUE, scale = 0.3, minw = 1.3, minh = 0.5,}),
    }}
  end
  if G.STAGE == G.STAGES.MAIN_MENU then
    credits = UIBox_button{ label = {localize('b_credits')}, button = "show_credits", minw = 5}
  end

  local settings = UIBox_button({button = 'settings', label = {localize('b_settings')}, minw = 5, focus_args = {snap_to = true}})
  local high_scores = UIBox_button{ label = {localize('b_stats')}, button = "high_scores", minw = 5}
  local customize = UIBox_button{ label = {localize('b_customize_deck')}, button = "customize_deck", minw = 5}

  local t = create_UIBox_generic_options({ contents = {
      settings,
      G.GAME.seeded and current_seed or nil,
      restart,
      main_menu,
      high_scores,
      your_collection,
      customize,
      credits
    }})
  return t
end

function create_UIBox_settings()
  local tabs = {}
  tabs[#tabs+1] = {
    label = localize('b_set_game'),
    chosen = true,
    tab_definition_function = G.UIDEF.settings_tab,
    tab_definition_function_args = 'Game'
  }
  if G.F_VIDEO_SETTINGS then   tabs[#tabs+1] = {
      label = localize('b_set_video'),
      tab_definition_function = G.UIDEF.settings_tab,
      tab_definition_function_args = 'Video'
    }
  end
  tabs[#tabs+1] = {
    label = localize('b_set_graphics'),
    tab_definition_function = G.UIDEF.settings_tab,
    tab_definition_function_args = 'Graphics'
  }
  tabs[#tabs+1] = {
    label = localize('b_set_audio'),
    tab_definition_function = G.UIDEF.settings_tab,
    tab_definition_function_args = 'Audio'
  }

  local t = create_UIBox_generic_options({back_func = 'options',contents = {create_tabs(
    {tabs = tabs,
    tab_h = 7.05,
    tab_alignment = 'tm',
    snap_to_nav = true}
    )}})
return t
end

function G.UIDEF.settings_tab(tab)
  if tab == 'Game' then
    return {n=G.UIT.ROOT, config={align = "cm", padding = 0.05, colour = G.C.CLEAR}, nodes={
      create_option_cycle({label = localize('b_set_gamespeed'),scale = 0.8, options = {0.5, 1, 2, 4}, opt_callback = 'change_gamespeed', current_option = (G.SETTINGS.GAMESPEED == 0.5 and 1 or G.SETTINGS.GAMESPEED == 4 and 4 or G.SETTINGS.GAMESPEED + 1)}),
      create_option_cycle({w = 5, label = localize('b_set_play_discard_pos'),scale = 0.8, options = localize('ml_play_discard_pos_opt'), opt_callback = 'change_play_discard_position', current_option = (G.SETTINGS.play_button_pos)}),
      G.F_RUMBLE and create_toggle({label = localize('b_set_rumble'), ref_table = G.SETTINGS, ref_value = 'rumble'}) or nil,
      create_slider({label = localize('b_set_screenshake'),w = 4, h = 0.4, ref_table = G.SETTINGS, ref_value = 'screenshake', min = 0, max = 100}),
      create_toggle({label = localize('ph_display_stickers'), ref_table = G.SETTINGS, ref_value = 'run_stake_stickers'}),
      create_toggle({label = localize('b_high_contrast_cards'), ref_table = G.SETTINGS, ref_value = 'colourblind_option', callback = G.FUNCS.refresh_contrast_mode}),
      create_toggle({label = localize('b_reduced_motion'), ref_table = G.SETTINGS, ref_value = 'reduced_motion'}),
      G.F_CRASH_REPORTS and create_toggle({label = localize('b_set_crash_reports'), ref_table = G.SETTINGS, ref_value = 'crashreports', info = localize('ml_crash_report_info')}) or nil,
    }}
  elseif tab == 'Video' then
    --Reset the queue so there are no pending changes
    G.SETTINGS.QUEUED_CHANGE = {}
  
    --Refresh the display information for all displays based on the screenmode selected
    local res_option = GET_DISPLAYINFO(G.SETTINGS.WINDOW.screenmode, G.SETTINGS.WINDOW.selected_display)
  
    return 
    {n=G.UIT.ROOT, config={align = "cm", padding = 0.05, colour = G.C.CLEAR}, nodes={
        create_option_cycle({w = 4,scale = 0.8, label = localize('b_set_monitor'), options = G.SETTINGS.WINDOW.display_names, opt_callback = 'change_display', current_option = (G.SETTINGS.WINDOW.selected_display)}),
        create_option_cycle({w = 4,scale = 0.8, label = localize('b_set_windowmode'), options = localize('ml_windowmode_opt'), opt_callback = 'change_screenmode', current_option = (({Windowed = 1, Fullscreen = 2, Borderless = 3})[G.SETTINGS.WINDOW.screenmode] or 1)}),
        {n=G.UIT.R, config={align = "cm", id = 'resolution_cycle'}, nodes={create_option_cycle({w = 4,scale = 0.8, options = G.SETTINGS.WINDOW.DISPLAYS[G.SETTINGS.WINDOW.selected_display].screen_resolutions.strings, opt_callback = 'change_screen_resolution',current_option = res_option or 1})}},
        {n=G.UIT.R, config={align = "cm"}, nodes={create_option_cycle({w = 4,scale = 0.8, options = localize('ml_vsync_opt'), opt_callback = 'change_vsync',current_option = G.SETTINGS.WINDOW.vsync == 0 and 2 or 1})}},
        UIBox_button({button = 'apply_window_changes', label = {localize('b_set_apply')}, minw = 3, func = 'can_apply_window_changes'}),
    }}
  elseif tab == 'Audio' then
    return {n=G.UIT.ROOT, config={align = "cm", padding = 0.05, colour = G.C.CLEAR}, nodes={
      create_slider({label = localize('b_set_master_vol'), w = 5, h = 0.4, ref_table = G.SETTINGS.SOUND, ref_value = 'volume', min = 0, max = 100}),
      create_slider({label = localize('b_set_music_vol'), w = 5, h = 0.4, ref_table = G.SETTINGS.SOUND, ref_value = 'music_volume', min = 0, max = 100}),
      create_slider({label = localize('b_set_game_vol'), w = 5, h = 0.4, ref_table = G.SETTINGS.SOUND, ref_value = 'game_sounds_volume', min = 0, max = 100}),
    }}
  elseif tab == 'Graphics' then 
    return {n=G.UIT.ROOT, config={align = "cm", padding = 0.05, colour = G.C.CLEAR}, nodes={
      create_option_cycle({w = 4,scale = 0.8, label = localize("b_set_shadows"),options = localize('ml_shadow_opt'), opt_callback = 'change_shadows', current_option = (G.SETTINGS.GRAPHICS.shadows == 'On' and 1 or 2)}),
      create_option_cycle({w = 4,scale = 0.8, label = localize("b_set_pixel_smoothing"),options = localize('ml_smoothing_opt'), opt_callback = 'change_pixel_smoothing', current_option = G.SETTINGS.GRAPHICS.texture_scaling}),
      create_slider({label = localize('b_set_CRT'),w = 4, h = 0.4, ref_table = G.SETTINGS.GRAPHICS, ref_value = 'crt', min = 0, max = 100}),
      create_option_cycle({w = 4,scale = 0.8, label = localize("b_set_CRT_bloom"),options = localize('ml_bloom_opt'), opt_callback = 'change_crt_bloom', current_option = G.SETTINGS.GRAPHICS.bloom}),
    }}
  end

  return {n=G.UIT.ROOT, config={align = "cm", padding = 0.05, colour = G.C.CLEAR, minh = 5, minw = 5}, nodes={}}
end

function create_UIBox_test_framework(variables)
  variables = variables or {};
  local nodes = {}
  for k, v in pairs(variables) do
    if v.type == 'cycle' then
      table.insert(nodes, 
      {n=G.UIT.R, config={align = "cm", padding = 0.05}, nodes={
        {n=G.UIT.R, config={align = "cm"}, nodes={
          {n=G.UIT.T, config={text = v.label or '', scale = 0.5, colour = G.C.UI.TEXT_DARK}}
        }},
        {n=G.UIT.R, config={align = "cm"}, nodes={
          create_option_cycle({options = v.options, opt_callback = 'test_framework_cycle_callback', ref_table = v.ref_table, ref_value = v.ref_value})
        }},
      }})
    elseif v.type == 'slider' then
      table.insert(nodes, 
      {n=G.UIT.R, config={align = "cm", minh = 1, minw = 1, padding = 0.05, colour = G.C.CLEAR}, nodes={
        {n=G.UIT.R, config={align = "cm", padding = 0}, nodes={
          {n=G.UIT.T, config={text = v.label, scale = 0.5, colour = G.C.UI.TEXT_DARK}}
        }},
        {n=G.UIT.R, config={align = "cm", padding = 0}, nodes={
          create_slider({w = 5, h = 0.4, ref_table = v.ref_table, ref_value = v.ref_value, min = v.min or 0, max = v.max or 1}),
        }},
      }})
    elseif v.type == 'text_input' then
      table.insert(nodes, 
      {n=G.UIT.R, config={align = "cm", minh = 1, minw = 1, padding = 0.05, colour = G.C.CLEAR}, nodes={
        {n=G.UIT.R, config={align = "cm", padding = 0}, nodes={
          {n=G.UIT.T, config={text = v.label, scale = 0.5, colour = G.C.UI.TEXT_DARK}}
        }},
        {n=G.UIT.R, config={align = "cm", padding = 0}, nodes={
          create_text_input(v.options),
        }},
      }})
    end
  end
  local t = {n=G.UIT.ROOT, config = {align = "cm", minw = G.ROOM.T.w*5, minh = G.ROOM.T.h*5,padding = 0.15, r = 0.1, colour = {G.C.BLACK[1], G.C.BLACK[2], G.C.BLACK[3],0.6}}, nodes={
    {n=G.UIT.C, config={align = "cm", minh = 1,r = 0.3, padding = 0.1, minw = 1, colour = G.C.WHITE, shadow = true}, nodes={
      {n=G.UIT.C, config={align = "cm", minh = 1,r = 0.2, padding = 0.2, minw = 1, colour = G.C.CLEAR, outline = 1, outline_colour = G.C.BLACK}, nodes={
        {n=G.UIT.R, config={align = "cm", padding = 0.05}, nodes=
          nodes
        },
        {n=G.UIT.R, config={align = "cm", minw = 2.5, padding = 0.1, r = 0.1, hover = true, colour = G.C.ORANGE, button = "exit_overlay_menu", shadow = true}, nodes={
            {n=G.UIT.R, config={align = "cm", padding = 0, no_fill = true}, nodes={
              {n=G.UIT.T, config={text = "Back", scale = 0.5, colour = G.C.UI.TEXT_LIGHT}}
            }}
        }},
      }}
    }}
  }}
return t                                      
end

function G.UIDEF.usage_tabs()
  return create_UIBox_generic_options({back_func = 'high_scores', contents ={create_tabs(
    {tabs = {
        {
          label = localize('b_stat_jokers'),
          chosen = true,
          tab_definition_function = create_UIBox_usage,
          tab_definition_function_args = {'joker_usage'},
        },
        {
          label = localize('b_stat_consumables'),
          tab_definition_function = create_UIBox_usage,
          tab_definition_function_args = {'consumeable_usage'},
        },
        {
          label = localize('b_stat_tarots'),
          tab_definition_function = create_UIBox_usage,
          tab_definition_function_args = {'consumeable_usage', 'Tarot'},
        },
        {
          label = localize('b_stat_planets'),
          tab_definition_function = create_UIBox_usage,
          tab_definition_function_args = {'consumeable_usage', 'Planet'},
        },
        {
          label = localize('b_stat_spectrals'),
          tab_definition_function = create_UIBox_usage,
          tab_definition_function_args = {'consumeable_usage', 'Spectral'},
        },
        {
          label = localize('b_stat_vouchers'),
          tab_definition_function = create_UIBox_usage,
          tab_definition_function_args = {'voucher_usage', 'Voucher'},
        },
    },
    tab_h = 8,
    snap_to_nav = true})}})
end

function create_UIBox_usage(args)
  args = args or {}
  _type, _set = args[1], args[2]
  local used_cards = {}
  local max_amt = 0
  for k, v in pairs(G.PROFILES[G.SETTINGS.profile][_type]) do
    if G.P_CENTERS[k] and (not _set or G.P_CENTERS[k].set == _set) and G.P_CENTERS[k].discovered then
      used_cards[#used_cards + 1] = {count = v.count, key = k}
      if v.count > max_amt then max_amt = v.count end
    end
  end

  local _col = G.C.SECONDARY_SET[_set] or G.C.RED

  table.sort(used_cards, function (a, b) return a.count > b.count end )

  local histograms = {}

  for i = 1, 10 do
    local v = used_cards[i]
    if v then 
      local card = Card(0,0, 0.7*G.CARD_W, 0.7*G.CARD_H, nil, G.P_CENTERS[v.key])
      card.ambient_tilt = 0.8
      local cardarea = CardArea(
        G.ROOM.T.x + 0.2*G.ROOM.T.w/2,G.ROOM.T.h,
        G.CARD_W*0.7,
        G.CARD_H*0.7, 
        {card_limit = 2, type = 'title', highlight_limit = 0})
      cardarea:emplace(card)

      histograms[#histograms +1] = 
      {n=G.UIT.C, config={align = "bm",minh = 6.2,  colour = G.C.UI.TRANSPARENT_DARK, r = 0.1}, nodes={
        
        {n=G.UIT.R, config={align = "bm"}, nodes={
          {n=G.UIT.R, config={align = "cm", minh = 0.7*G.CARD_H+0.1} , nodes={
            {n=G.UIT.O, config={object = cardarea}}
          }},
          {n=G.UIT.R, config={align = "cm", padding = 0.1}, nodes={
            {n=G.UIT.T, config={text = v.count, scale = 0.35, colour = mix_colours(G.C.FILTER, G.C.WHITE, 0.8), shadow = true}}
          }},
          {n=G.UIT.R, config={align = "cm"}, nodes={
            {n=G.UIT.R, config={align = "cm", minh = v.count/max_amt*3.6, minw = 0.8, colour = G.C.SECONDARY_SET[G.P_CENTERS[v.key].set] or G.C.RED, res = 0.15, r = 0.001}, nodes={}},
          }},
        }},
      }}
    else
      histograms[#histograms +1] = 
      {n=G.UIT.C, config={align = "bm",minh = 6.2,  colour = G.C.UI.TRANSPARENT_DARK, r = 0.1}, nodes={
        {n=G.UIT.R, config={align = "bm"}, nodes={
          {n=G.UIT.R, config={align = "cm", minh = 0.7*G.CARD_H+0.1, minw = 0.7*G.CARD_W} , nodes={
          }},
          {n=G.UIT.R, config={align = "cm", padding = 0.1}, nodes={
            {n=G.UIT.T, config={text = '-', scale = 0.35, colour = mix_colours(G.C.FILTER, G.C.WHITE, 0.8), shadow = true}}
          }},
          {n=G.UIT.R, config={align = "cm"}, nodes={
            {n=G.UIT.R, config={align = "cm", minh = 0.2, minw = 0.8, colour = G.C.UI.TRANSPARENT_LIGHT, res = 0.15, r = 0.001}, nodes={}},
          }},
        }},
      }}
    end
  end

  local t = {n=G.UIT.ROOT, config={align = "cm", minw = 3, padding = 0.1, r = 0.1, colour = G.C.UI.TRANSPARENT_DARK}, nodes={
    {n=G.UIT.R, config={align = "cm", padding = 0.1}, nodes={
      {n=G.UIT.B, config={w=0.2,h=0.2,r =0.1,colour = G.C.FILTER}},
      {n=G.UIT.T, config={text = 
        _type == 'joker_usage' and localize('ph_stat_joker') or
        _type == 'consumeable_usage' and localize('ph_stat_consumable') or
        _type == 'voucher_usage' and localize('ph_stat_voucher'),
       scale = 0.35, colour = G.C.WHITE}}
    }},
    {n=G.UIT.R, config={align = "cm", padding = 0.1}, nodes=histograms},
  }}

  return t
end

function create_UIBox_customize_deck()
  local t = create_UIBox_generic_options({ back_func = 'options', snap_back = nil, contents = {
    {n=G.UIT.R, config={align = "cm", padding = 0}, nodes={
      create_tabs(
        {tabs = {
            {
                label = localize('Spades', 'suits_plural'),
                chosen = true,
                tab_definition_function = G.UIDEF.custom_deck_tab,
                tab_definition_function_args = 'Spades'
            },
            {
              label = localize('Hearts', 'suits_plural'),
              tab_definition_function = G.UIDEF.custom_deck_tab,
              tab_definition_function_args = 'Hearts'
            },
            {
              label = localize('Clubs', 'suits_plural'),
              tab_definition_function = G.UIDEF.custom_deck_tab,
              tab_definition_function_args = 'Clubs'
            },
            {
              label = localize('Diamonds', 'suits_plural'),
              tab_definition_function = G.UIDEF.custom_deck_tab,
              tab_definition_function_args = 'Diamonds'
            }
        },snap_to_nav = true, no_shoulders = true}
    )}}}
  })
  return t
end

function G.UIDEF.custom_deck_tab(_suit)
  local t = {}

  local face_cards = CardArea(
    0,0,
    4*G.CARD_W,
    1.4*G.CARD_H, 
    {card_limit = 3, type = 'title', highlight_limit = 0})

  table.insert(t, 
    {n=G.UIT.R, config={align = "cm", colour = G.C.BLACK, r = 0.1, padding = 0.07, no_fill = true}, nodes={
      {n=G.UIT.O, config={object = face_cards}}
    }}
  )

  local loc_options = localize(_suit, 'collabs')
  local conv_loc_options = {}
  for k, v in pairs(loc_options) do
    conv_loc_options[tonumber(k)] = v
  end

  loc_options = conv_loc_options

  local current_option = 1
  for k, v in pairs(G.COLLABS.options[_suit]) do
    if G.SETTINGS.CUSTOM_DECK.Collabs[_suit] == v then current_option = k end
  end

  table.insert(t, 
    {n=G.UIT.R, config={align = "cm"}, nodes={
      create_option_cycle({options = loc_options, w = 5.5, cycle_shoulders = true, curr_suit = _suit, opt_callback = 'change_collab', current_option = current_option, colour = G.C.RED, focus_args = {snap_to = true, nav = 'wide'}}),
    }}
  )
  table.insert(t, create_toggle({label = localize('b_high_contrast_cards'), ref_table = G.SETTINGS, ref_value = 'colourblind_option', callback = G.FUNCS.refresh_contrast_mode}))

  local faces = {'K','Q','J'}
  for i = 1, 3 do
    local card_code = (string.sub(_suit, 1, 1))..'_'..faces[i]
    local card = Card(0,0, G.CARD_W*1.2, G.CARD_H*1.2, G.P_CARDS[card_code], G.P_CENTERS.c_base)
    card.no_ui = true
    face_cards:emplace(card)
  end

  return {n=G.UIT.ROOT, config={align = "cm", padding = 0, colour = G.C.CLEAR, r = 0.1, minw = 7, minh = 4.2}, nodes=t}
end

function create_UIBox_high_scores()
  fetch_achievements()
  set_profile_progress()
  set_discover_tallies()

  local scores = {
    create_UIBox_high_scores_row("hand"),
    create_UIBox_high_scores_row("furthest_round"),
    create_UIBox_high_scores_row("furthest_ante"),
    create_UIBox_high_scores_row("poker_hand"),
    create_UIBox_high_scores_row("most_money"),
    create_UIBox_high_scores_row("win_streak"),
  }
  G.focused_profile = G.SETTINGS.profile
  local cheevs = {}
  
  local t = create_UIBox_generic_options({ back_func = 'options', snap_back = true, contents = {
    {n=G.UIT.C, config={align = "cm", minw = 3, padding = 0.2, r = 0.1, colour = G.C.CLEAR}, nodes={
      {n=G.UIT.R, config={align = "cm", padding = 0.1}, nodes=
        scores
      },
    }},
    {n=G.UIT.C, config={align = "cm", padding = 0.1, r = 0.1, colour = G.C.CLEAR}, nodes={
      create_progress_box(),
      UIBox_button({button = 'usage', label = {localize('k_card_stats')}, minw = 7.5, minh =1, focus_args = {nav = 'wide'}}),
    }},
    not G.F_NO_ACHIEVEMENTS and {n=G.UIT.C, config={align = "cm", r = 0.1, colour = G.C.CLEAR}, nodes=cheevs} or nil
  }})

  return t
end

function create_progress_box(_profile_progress, smaller)
  local rows, protos = {}, {'collection', 'challenges', 'joker_stickers', 'deck_stake_wins'}
  _profile_progress = _profile_progress or G.PROFILES[G.SETTINGS.profile].progress

  
  _profile_progress.overall_tally, _profile_progress.overall_of = 
  _profile_progress.discovered.tally/_profile_progress.discovered.of +
  _profile_progress.deck_stakes.tally/_profile_progress.deck_stakes.of +
  _profile_progress.joker_stickers.tally/_profile_progress.joker_stickers.of +
  _profile_progress.challenges.tally/_profile_progress.challenges.of,
  4

  local text_scale = smaller and 0.7 or 1
  local bar_colour = G.PROFILES[G.focused_profile].all_unlocked and G.C.RED or G.C.BLUE

  for _, v in ipairs(protos) do
    local tab, val, max = nil,nil,nil
    if v == 'collection' then
      tab, val, max = _profile_progress.discovered, 'tally', _profile_progress.discovered.of
    elseif v == 'deck_stake_wins' then
      tab, val, max = _profile_progress.deck_stakes, 'tally', _profile_progress.deck_stakes.of
    elseif v == 'joker_stickers' then
      tab, val, max = _profile_progress.joker_stickers, 'tally', _profile_progress.joker_stickers.of
    elseif v == 'challenges' then
      tab, val, max = _profile_progress.challenges, 'tally', _profile_progress.challenges.of
    end
    local filling = v == 'collection' and {
      {n=G.UIT.O, config={object = DynaText({string = {math.floor(0.01+100*_profile_progress.discovered.tally/_profile_progress.discovered.of)..'%'}, colours = {G.C.WHITE},shadow = true, float = true, scale = 0.55*text_scale})}},
      {n=G.UIT.T, config={text = " (".._profile_progress.discovered.tally..'/'.._profile_progress.discovered.of..")", scale = 0.35, colour = G.C.JOKER_GREY}}
    } or v == 'deck_stake_wins' and {
      {n=G.UIT.O, config={object = DynaText({string = {math.floor(0.01+100*_profile_progress.deck_stakes.tally/_profile_progress.deck_stakes.of)..'%'}, colours = {G.C.WHITE},shadow = true, float = true, scale = 0.55*text_scale})}},
      {n=G.UIT.T, config={text = " (".._profile_progress.deck_stakes.tally..'/'.._profile_progress.deck_stakes.of..")", scale = 0.35, colour = G.C.JOKER_GREY}}
    } or v == 'joker_stickers' and {
      {n=G.UIT.O, config={object = DynaText({string = {math.floor(0.01+100*_profile_progress.joker_stickers.tally/_profile_progress.joker_stickers.of)..'%'}, colours = {G.C.WHITE},shadow = true, float = true, scale = 0.55*text_scale})}},
      {n=G.UIT.T, config={text = " (".._profile_progress.joker_stickers.tally..'/'.._profile_progress.joker_stickers.of..")", scale = 0.35, colour = G.C.JOKER_GREY}}
    } or v == 'challenges' and {
      {n=G.UIT.O, config={object = DynaText({string = {math.floor(0.01+100*_profile_progress.challenges.tally/_profile_progress.challenges.of)..'%'}, colours = {G.C.WHITE},shadow = true, float = true, scale = 0.55*text_scale})}},
      {n=G.UIT.T, config={text = " (".._profile_progress.challenges.tally..'/'.._profile_progress.challenges.of..")", scale = 0.35, colour = G.C.JOKER_GREY}}
    }

    rows[#rows+1] = {n=G.UIT.R, config={align = "cm", padding = 0.05, r = 0.1, colour = darken(G.C.JOKER_GREY, 0.1), emboss = 0.05}, nodes={
      {n=G.UIT.C, config={align = "cm", padding = 0.05, minw = 3.5*text_scale, maxw = 3.5*text_scale}, nodes={
          {n=G.UIT.T, config={text = localize('k_'..v), scale = 0.5*text_scale, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
      }},
      {n=G.UIT.C, config={align = "cl", minh =smaller and 0.5 or 0.8, r = 0.1, minw = 3.5*text_scale, colour = G.C.BLACK, emboss = 0.05,
      progress_bar = {
        max = max, ref_table = tab, ref_value = val, empty_col = G.C.BLACK, filled_col = adjust_alpha(bar_colour, 0.5)
      }}, nodes={
        {n=G.UIT.C, config={align = "cm", padding = 0.05, r = 0.1, minw = 3.5*text_scale}, nodes=filling},
      }},
    }}
  end

  return {n=G.UIT.R, config={align = "cm", padding = 0.05, r = 0.1, colour = G.C.BLACK, emboss = 0.05}, nodes={
    {n=G.UIT.R, config={align = "cm", padding = 0.05}, nodes={
      {n=G.UIT.C, config={align = "cm", padding = 0.05, minw = 3.5*text_scale, maxw = 3.5*text_scale}, nodes={
        {n=G.UIT.T, config={text = localize('k_progress'), scale = 0.5, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
      }},
      {n=G.UIT.C, config={align = "cl", minh = 0.6, r = 0.1, minw = 3.5*text_scale, colour = G.C.BLACK, emboss = 0.05,
      progress_bar = {
        max = _profile_progress.overall_of, ref_table = _profile_progress, ref_value = 'overall_tally', empty_col = G.C.BLACK, filled_col = adjust_alpha(bar_colour, 0.5)
      }}, nodes={
        {n=G.UIT.C, config={align = "cm", padding = 0.05, r = 0.1, minw = 3.5*text_scale}, nodes={
          {n=G.UIT.O, config={object = DynaText({string = {math.floor(0.01+100*_profile_progress.overall_tally/_profile_progress.overall_of)..'%'}, colours = {G.C.WHITE},shadow = true, float = true, scale = 0.55})}},
        }},
      }}
    }},
    {n=G.UIT.R, config={align = "cm", padding = 0.05}, nodes=rows},
    }}
end

function create_UIBox_high_scores_row(score)
  if not G.PROFILES[G.SETTINGS.profile].high_scores[score] then return nil end
  local label_scale = 0.65 - 0.025*math.max(string.len(G.PROFILES[G.SETTINGS.profile].high_scores[score].label)-8, 0)
  local label_w, score_w, h = 3.5, 4, 0.8
  local score_tab = {}
 
  if score == 'poker_hand' then 
    local handname, amount = localize('k_none'), 0
    for k, v in pairs(G.PROFILES[G.SETTINGS.profile].hand_usage) do if v.count > amount then handname = v.order; amount = v.count end end
    score_tab = {
      {n=G.UIT.O, config={object = DynaText({string = {amount < 1 and handname or localize(handname,'poker_hands')}, colours = {G.C.WHITE},shadow = true, float = true, scale = 0.55})}},
      {n=G.UIT.T, config={text = " ("..amount..")", scale = 0.45, colour = G.C.JOKER_GREY}}
    }
  elseif score == 'most_money' then 
    score_tab = {
      {n=G.UIT.O, config={object = DynaText({string = {localize('$')..number_format(G.PROFILES[G.SETTINGS.profile].high_scores[score].amt)}, colours = {G.C.MONEY},shadow = true, float = true, scale = score_number_scale(0.85, G.PROFILES[G.SETTINGS.profile].high_scores[score].amt)})}},
    }
  elseif score == 'win_streak' then 
    score_tab = {
      {n=G.UIT.O, config={object = DynaText({string = {number_format(G.PROFILES[G.SETTINGS.profile].high_scores[score].amt)}, colours = {G.C.WHITE},shadow = true, float = true, scale = score_number_scale(0.85, G.PROFILES[G.SETTINGS.profile].high_scores[score].amt)})}},
      {n=G.UIT.T, config={text = " ("..G.PROFILES[G.SETTINGS.profile].high_scores["current_streak"].amt..")", scale = 0.45, colour = G.C.JOKER_GREY}}
    }
  elseif score == 'hand' then 
    local chip_sprite = Sprite(0,0,0.4,0.4,G.ASSET_ATLAS["ui_"..(G.SETTINGS.colourblind_option and 2 or 1)], {x=0, y=0})
    chip_sprite.states.drag.can = false
    score_tab = {
      {n=G.UIT.C, config={align = "cm"}, nodes={
        {n=G.UIT.O, config={w=0.4,h=0.4 , object = chip_sprite}}
      }},
      {n=G.UIT.C, config={align = "cm"}, nodes={
        {n=G.UIT.O, config={object = DynaText({string = {number_format(G.PROFILES[G.SETTINGS.profile].high_scores[score].amt)}, colours = {G.C.RED},shadow = true, float = true, scale = math.min(0.75, score_number_scale(1.5, G.PROFILES[G.SETTINGS.profile].high_scores[score].amt))})}},
      }},
    }
  elseif score == 'collection' then 
    score_tab = {
      {n=G.UIT.C, config={align = "cm"}, nodes={
        {n=G.UIT.O, config={object = DynaText({string = {'%'..math.floor(0.01+100*G.PROFILES[G.SETTINGS.profile].high_scores[score].amt/G.PROFILES[G.SETTINGS.profile].high_scores[score].tot)}, colours = {G.C.WHITE},shadow = true, float = true, scale = math.min(0.75, score_number_scale(1.5, G.PROFILES[G.SETTINGS.profile].high_scores[score].amt))})}},
        {n=G.UIT.T, config={text = " ("..G.PROFILES[G.SETTINGS.profile].high_scores[score].amt..'/'..G.PROFILES[G.SETTINGS.profile].high_scores[score].tot..")", scale = 0.45, colour = G.C.JOKER_GREY}}
      }},
    }
  else
    score_tab = {
      {n=G.UIT.O, config={object = DynaText({string = {number_format(G.PROFILES[G.SETTINGS.profile].high_scores[score].amt)}, colours = {G.C.FILTER},shadow = true, float = true, scale = score_number_scale(0.85, G.PROFILES[G.SETTINGS.profile].high_scores[score].amt)})}},
    }
  end
  return {n=G.UIT.R, config={align = "cm", padding = 0.05, r = 0.1, colour = darken(G.C.JOKER_GREY, 0.1), emboss = 0.05}, nodes={
    {n=G.UIT.C, config={align = "cm", padding = 0.05, minw = label_w, maxw = label_w}, nodes={
        {n=G.UIT.T, config={text = localize(score, 'high_scores'), scale = label_scale, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
    }},
    {n=G.UIT.C, config={align = "cl", minh = h, r = 0.1, minw = score_w, colour = G.C.BLACK, emboss = 0.05}, nodes={
      {n=G.UIT.C, config={align = "cm", padding = 0.05, r = 0.1, minw = score_w, maxw = score_w}, nodes=score_tab},
    }},
  }}
end

function create_UIBox_win()
  local show_lose_cta = false
  local eased_green = copy_table(G.C.GREEN)
  eased_green[4] = 0
  ease_value(eased_green, 4, 0.5, nil, nil, true)
  local t = create_UIBox_generic_options({ padding = 0, bg_colour = eased_green , colour = G.C.BLACK, outline_colour = G.C.EDITION, no_back = true, no_esc = true, contents = {
    {n=G.UIT.R, config={align = "cm"}, nodes={
      {n=G.UIT.O, config={object = DynaText({string = {localize('ph_you_win')}, colours = {G.C.EDITION},shadow = true, float = true, spacing = 10, rotate = true, scale = 1.5, pop_in = 0.4, maxw = 6.5})}},
    }},
    {n=G.UIT.R, config={align = "cm", padding = 0.15}, nodes={
      {n=G.UIT.C, config={align = "cm"}, nodes={
    {n=G.UIT.R, config={align = "cm", padding = 0.08}, nodes={
      create_UIBox_round_scores_row('hand'),
      create_UIBox_round_scores_row('poker_hand'),
    }},
    {n=G.UIT.R, config={align = "cm"}, nodes={
      {n=G.UIT.C, config={align = "cm", padding = 0.08}, nodes={
        create_UIBox_round_scores_row('cards_played', G.C.BLUE),
        create_UIBox_round_scores_row('cards_discarded', G.C.RED),
        create_UIBox_round_scores_row('cards_purchased', G.C.MONEY),
        create_UIBox_round_scores_row('times_rerolled', G.C.GREEN),
        create_UIBox_round_scores_row('new_collection', G.C.WHITE),
        create_UIBox_round_scores_row('seed', G.C.WHITE),
        UIBox_button({button = 'copy_seed', label = {localize('b_copy')}, colour = G.C.BLUE, scale = 0.3, minw = 2.3, minh = 0.4,}),
      }},
      {n=G.UIT.C, config={align = "tr", padding = 0.08}, nodes={
        create_UIBox_round_scores_row('furthest_ante', G.C.FILTER),
        create_UIBox_round_scores_row('furthest_round', G.C.FILTER),
        {n=G.UIT.R, config={align = "cm", minh = 0.4, minw = 0.1}, nodes={}},
        show_win_cta and UIBox_button({id = 'win_cta', button = 'show_main_cta', label = {localize('b_next')}, colour = G.C.GREEN, scale = 0.8, minw = 2.5, minh = 2.5, focus_args = {nav = 'wide', snap_to = true}}) or nil,
        not show_win_cta and UIBox_button({id = 'from_game_won', button = 'notify_then_setup_run', label = {localize('b_start_new_run')}, minw = 2.5, maxw = 2.5, minh = 1, focus_args = {nav = 'wide', snap_to = true}}) or nil,
        not show_win_cta and {n=G.UIT.R, config={align = "cm", minh = 0.2, minw = 0.1}, nodes={}} or nil,
        not show_win_cta and UIBox_button({button = 'go_to_menu', label = {localize('b_main_menu')}, minw = 2.5, maxw = 2.5, minh = 1, focus_args = {nav = 'wide'}}) or nil,
      }}
    }},
    {n=G.UIT.R, config={align = "cm", padding = 0.08}, nodes={
      UIBox_button({button = 'exit_overlay_menu', label = {localize('b_endless')}, minw = 6.5, maxw = 5, minh = 1.2, scale = 0.7, shadow = true, colour = G.C.BLUE, focus_args = {nav = 'wide', button = 'x',set_button_pip = true}}),
    }},
  }}
  }}
  }}) 
  t.nodes[1] = {n=G.UIT.R, config={align = "cm", padding = 0.1}, nodes={
      {n=G.UIT.C, config={align = "cm", padding = 2}, nodes={
        {n=G.UIT.O, config={padding = 0, id = 'jimbo_spot', object = Moveable(0,0,G.CARD_W*1.1, G.CARD_H*1.1)}},
      }},
      {n=G.UIT.C, config={align = "cm", padding = 0.1}, nodes={t.nodes[1]}
    }}
  }
  --t.nodes[1].config.mid = true
  t.config.id = 'you_win_UI'
  return t
end

function create_UIBox_exit_CTA()

  local t = create_UIBox_generic_options({ back_label = 'Quit Game', back_func = 'quit' , colour = G.C.BLACK, back_colour = G.C.RED, padding = 0, contents = {
    {n=G.UIT.C, config={align = "tm", padding = 0.15}, nodes={
      {n=G.UIT.R, config={align = "cm", padding = 0}, nodes={
        {n=G.UIT.O, config={object = DynaText({string = {localize('ph_demo_thanks_1')}, colours = {G.C.WHITE},shadow = true, float = true, scale = 0.9})}},
      }},
      {n=G.UIT.R, config={align = "cm", padding = 0}, nodes={
        {n=G.UIT.O, config={object = DynaText({string = {localize('ph_demo_thanks_2')}, colours = {G.C.WHITE},shadow = true, bump = true, rotate = true, pop_in = 0.2, scale = 1.4})}},
      }},
      {n=G.UIT.R, config={align = "tm", padding = 0.12, emboss = 0.1, colour = G.C.L_BLACK, r = 0.1}, nodes={
        simple_text_container('ml_demo_thanks_message',{colour = G.C.UI.TEXT_LIGHT, scale = 0.55, shadow = true}),
        {n=G.UIT.R, config={align = "cm", padding = 0.2}, nodes={
          UIBox_button({button = 'wishlist_steam', label = {localize('b_wishlist')}, minw = 5.9, minh = 1.1, scale = 0.5, shadow = true, colour = G.C.GREEN, focus_args = {nav = 'wide', button = 'x',set_button_pip = true, snap_to = true}}),
          UIBox_button({button = 'go_to_playbalatro', label = {localize('b_playbalatro')}, minw = 4.9, minh = 0.8, scale = 0.4, shadow = true, colour = G.C.BLUE, focus_args = {nav = 'wide', button = 'y',set_button_pip = true}}),
        }},
      }},
    }}
  }})
  t.nodes[2] = t.nodes[1]
  t.nodes[1] = {n=G.UIT.C, config={align = "cm", padding = 2}, nodes={
    {n=G.UIT.O, config={padding = 0, id = 'jimbo_spot', object = Moveable(0,0,G.CARD_W*1.1, G.CARD_H*1.1)}},
  }}   
  --t.nodes[1].config.mid = true
  return t
end

function create_UIBox_small_cta()
  return {n=G.UIT.ROOT, config={align = "cm", minw = 4, minh = 3}, nodes={
    {n=G.UIT.O, config={object = DynaText({string = {localize('ph_demo_thanks_1')}, colours = {G.C.WHITE},shadow = true, float = true, scale = 0.3})}},
  }}
end

function create_UIBox_demo_video_CTA()
  G.E_MANAGER:add_event(Event({
    trigger = 'after',
    delay = 21.7,
    blockable = false,
    blocking = false,
    func = (function()
        G.exception_queue = 'other'
        G.FUNCS.go_to_demo_cta()
        G.exception_queue = nil
        return true
  end)}), 'other')

  RESTART_MUSIC()

  local video_file = love.graphics.newVideo('resources/democta.ogv')
  local vid_sprite = Sprite(0,0,11*16/9,11,G.ASSET_ATLAS["ui_"..(G.SETTINGS.colourblind_option and 2 or 1)], {x=0, y=0})
  video_file:getSource():setVolume(G.SETTINGS.SOUND.volume*G.SETTINGS.SOUND.game_sounds_volume/(100*100))
  vid_sprite.video = video_file
  video_file:play()

  local t = create_UIBox_generic_options({ back_delay = 7, back_label = localize('b_skip'), back_func = 'go_to_demo_cta' , colour = G.C.BLACK, padding = 0, contents = {
    {n=G.UIT.O, config={object = vid_sprite}},
  }})
  return t
end

function create_UIBox_game_over()
  local show_lose_cta = false


  local eased_red = copy_table(G.GAME.round_resets.ante <= G.GAME.win_ante and G.C.RED or G.C.BLUE)
  eased_red[4] = 0
  ease_value(eased_red, 4, 0.8, nil, nil, true)
  local t = create_UIBox_generic_options({ bg_colour = eased_red ,no_back = true, padding = 0, contents = {
    {n=G.UIT.R, config={align = "cm"}, nodes={
      {n=G.UIT.O, config={object = DynaText({string = {localize('ph_game_over')}, colours = {G.C.RED},shadow = true, float = true, scale = 1.5, pop_in = 0.4, maxw = 6.5})}},
    }},
    {n=G.UIT.R, config={align = "cm", padding = 0.15}, nodes={
      {n=G.UIT.C, config={align = "cm"}, nodes={
        {n=G.UIT.R, config={align = "cm", padding = 0.05, colour = G.C.BLACK, emboss = 0.05, r = 0.1}, nodes={
          {n=G.UIT.R, config={align = "cm", padding = 0.08}, nodes={
            create_UIBox_round_scores_row('hand'),
            create_UIBox_round_scores_row('poker_hand'),
          }},
          {n=G.UIT.R, config={align = "cm"}, nodes={
            {n=G.UIT.C, config={align = "cm", padding = 0.08}, nodes={
              create_UIBox_round_scores_row('cards_played', G.C.BLUE),
              create_UIBox_round_scores_row('cards_discarded', G.C.RED),
              create_UIBox_round_scores_row('cards_purchased', G.C.MONEY),
              create_UIBox_round_scores_row('times_rerolled', G.C.GREEN),
              create_UIBox_round_scores_row('new_collection', G.C.WHITE),
              create_UIBox_round_scores_row('seed', G.C.WHITE),
              UIBox_button({button = 'copy_seed', label = {localize('b_copy')}, colour = G.C.BLUE, scale = 0.3, minw = 2.3, minh = 0.4, focus_args = {nav = 'wide'}}),
            }},
            {n=G.UIT.C, config={align = "tr", padding = 0.08}, nodes={
              create_UIBox_round_scores_row('furthest_ante', G.C.FILTER),
              create_UIBox_round_scores_row('furthest_round', G.C.FILTER),
              create_UIBox_round_scores_row('defeated_by'),
            }}
          }}
        }},
        show_lose_cta and 
        {n=G.UIT.R, config={align = "cm", padding = 0.1}, nodes={
          {n=G.UIT.C, config={id = 'lose_cta', align = "cm", minw = 5, padding = 0.1, r = 0.1, hover = true, colour = G.C.GREEN, button = "show_main_cta", shadow = true}, nodes={
            {n=G.UIT.R, config={align = "cm", padding = 0, no_fill = true}, nodes={
              {n=G.UIT.T, config={text = localize('b_next'), scale = 0.5, colour = G.C.UI.TEXT_LIGHT, focus_args = {nav = 'wide', snap_to = true}}}
            }}
          }}
        }} or
        {n=G.UIT.R, config={align = "cm", padding = 0.1}, nodes={
          {n=G.UIT.R, config={id = 'from_game_over', align = "cm", minw = 5, padding = 0.1, r = 0.1, hover = true, colour = G.C.RED, button = "notify_then_setup_run", shadow = true, focus_args = {nav = 'wide', snap_to = true}}, nodes={
            {n=G.UIT.R, config={align = "cm", padding = 0, no_fill = true, maxw = 4.8}, nodes={
              {n=G.UIT.T, config={text = localize('b_start_new_run'), scale = 0.5, colour = G.C.UI.TEXT_LIGHT}}
            }}
          }},
          {n=G.UIT.R, config={align = "cm", minw = 5, padding = 0.1, r = 0.1, hover = true, colour = G.C.RED, button = "go_to_menu", shadow = true, focus_args = {nav = 'wide'}}, nodes={
            {n=G.UIT.R, config={align = "cm", padding = 0, no_fill = true, maxw = 4.8}, nodes={
              {n=G.UIT.T, config={text = localize('b_main_menu'), scale = 0.5, colour = G.C.UI.TEXT_LIGHT}}
            }}
          }}
        }}
      }},
    }}
}})
  t.nodes[1] = {n=G.UIT.R, config={align = "cm", padding = 0.1}, nodes={
    {n=G.UIT.C, config={align = "cm", padding = 2}, nodes={
      {n=G.UIT.R, config={align = "cm"}, nodes={
        {n=G.UIT.O, config={padding = 0, id = 'jimbo_spot', object = Moveable(0,0,G.CARD_W*1.1, G.CARD_H*1.1)}},
      }},
    }},
    {n=G.UIT.C, config={align = "cm", padding = 0.1}, nodes={t.nodes[1]}}}
}

  --t.nodes[1].config.mid = true
  return t
end

function create_UIBox_round_scores_row(score, text_colour)
  local label = G.GAME.round_scores[score] and localize('ph_score_'..score) or ''
  local check_high_score = false
  local score_tab = {}
  local label_w, score_w, h = ({hand=true,poker_hand=true})[score] and 3.5 or 2.9, ({hand=true,poker_hand=true})[score] and 3.5 or 1, 0.5

  if score == 'furthest_ante' then
    label_w = 1.9
    check_high_score = true
    label = localize('k_ante')
    score_tab = {
      {n=G.UIT.O, config={object = DynaText({string = {number_format(G.GAME.round_resets.ante)}, colours = {text_colour or G.C.FILTER},shadow = true, float = true, scale = 0.45})}},
    }
  end
  if score == 'furthest_round' then 
    label_w = 1.9
    check_high_score = true
    label = localize('k_round')
    score_tab = {
      {n=G.UIT.O, config={object = DynaText({string = {number_format(G.GAME.round)}, colours = {text_colour or G.C.FILTER},shadow = true, float = true, scale = 0.45})}},
    }
  end
  if score == 'seed' then 
    label_w = 1.9
    score_w = 1.9
    label = localize('k_seed')
    score_tab = {
      {n=G.UIT.O, config={object = DynaText({string = {G.GAME.pseudorandom.seed}, colours = {text_colour or G.C.WHITE},shadow = true, float = true, scale = 0.45})}},
    }
  end
  if score == 'defeated_by' then 
    label = localize('k_defeated_by')
    local blind_choice = {config = G.GAME.blind.config.blind or G.P_BLINDS.bl_small}
    blind_choice.animation = AnimatedSprite(0,0, 1.4, 1.4, G.ANIMATION_ATLAS['blind_chips'],  blind_choice.config.pos)
    blind_choice.animation:define_draw_steps({
      {shader = 'dissolve', shadow_height = 0.05},
      {shader = 'dissolve'}
    })
    
    score_tab = {
      {n=G.UIT.R, config={align = "cm", minh = 0.6}, nodes={
        {n=G.UIT.O, config={object = DynaText({string = localize{type ='name_text', key = blind_choice.config.key, set = 'Blind'}, colours = {G.C.WHITE},shadow = true, float = true,maxw = 2.2, scale = 0.45})}}
      }},
      {n=G.UIT.R, config={align = "cm", padding = 0.1}, nodes={
        {n=G.UIT.O, config={object = blind_choice.animation}}
      }},
    }
  end

  local label_scale = 0.5

  if score == 'poker_hand' then 
    local handname, amount = localize('k_none'), 0
    for k, v in pairs(G.GAME.hand_usage) do if v.count > amount then handname = v.order; amount = v.count end end
    score_tab = {
      {n=G.UIT.O, config={object = DynaText({string = {amount <1 and handname or localize(handname,'poker_hands')}, colours = {text_colour or G.C.WHITE},shadow = true, float = true, scale = 0.45, maxw = 2.5})}},
      {n=G.UIT.T, config={text = " ("..amount..")", scale = 0.35, colour = G.C.JOKER_GREY}}
    }
  elseif score == 'hand' then
    check_high_score = true
    local chip_sprite = Sprite(0,0,0.3,0.3,G.ASSET_ATLAS["ui_"..(G.SETTINGS.colourblind_option and 2 or 1)], {x=0, y=0})
    chip_sprite.states.drag.can = false
    score_tab = {
      {n=G.UIT.C, config={align = "cm"}, nodes={
        {n=G.UIT.O, config={w=0.3,h=0.3 , object = chip_sprite}}
      }},
      {n=G.UIT.C, config={align = "cm"}, nodes={
        {n=G.UIT.O, config={object = DynaText({string = {number_format(G.GAME.round_scores[score].amt)}, colours = {text_colour or G.C.RED},shadow = true, float = true, scale = math.min(0.6, score_number_scale(1.2, G.GAME.round_scores[score].amt))})}},
      }},
    }
  elseif G.GAME.round_scores[score] and not score_tab[1] then 
    score_tab = {
      {n=G.UIT.O, config={object = DynaText({string = {number_format(G.GAME.round_scores[score].amt)}, colours = {text_colour or G.C.FILTER},shadow = true, float = true, scale = score_number_scale(0.6, G.GAME.round_scores[score].amt)})}},
    }
  end
  return {n=G.UIT.R, config={align = "cm", padding = 0.05, r = 0.1, colour = darken(G.C.JOKER_GREY, 0.1), emboss = 0.05, func = check_high_score and 'high_score_alert' or nil, id = score}, nodes={
    {n=score=='defeated_by' and G.UIT.R or G.UIT.C, config={align = "cm", padding = 0.02, minw = label_w, maxw = label_w}, nodes={
        {n=G.UIT.T, config={text = label, scale = label_scale, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
    }},
    {n=score=='defeated_by' and G.UIT.R or G.UIT.C, config={align = "cr"}, nodes={
      {n=G.UIT.C, config={align = "cm", minh = h, r = 0.1, minw = score=='defeated_by' and label_w or score_w, colour = (score == 'seed' and G.GAME.seeded) and G.C.RED or G.C.BLACK, emboss = 0.05}, nodes={
        {n=G.UIT.C, config={align = "cm", padding = 0.05, r = 0.1, minw = score_w}, nodes=score_tab},
      }}
    }},
  }}
end

function create_UIBox_hand_tip(handname)
  if not G.GAME.hands[handname].example then return {n=G.UIT.R, config={align = "cm"},nodes = {}} end 
  local cardarea = CardArea(
    2,2,
    3.5*G.CARD_W,
    0.75*G.CARD_H, 
    {card_limit = 5, type = 'title', highlight_limit = 0})
  for k, v in ipairs(G.GAME.hands[handname].example) do
      local card = Card(0,0, 0.5*G.CARD_W, 0.5*G.CARD_H, G.P_CARDS[v[1]], G.P_CENTERS.c_base)
      if v[2] then card:juice_up(0.3, 0.2) end
      if k == 1 then play_sound('paper1',0.95 + math.random()*0.1, 0.3) end
      ease_value(card.T, 'scale',v[2] and 0.25 or -0.15,nil,'REAL',true,0.2)
      cardarea:emplace(card)
  end

  return {n=G.UIT.R, config={align = "cm", colour = G.C.WHITE, r = 0.1}, nodes={
    {n=G.UIT.C, config={align = "cm"}, nodes={
      {n=G.UIT.O, config={object = cardarea}}
    }}
  }}
end

function create_UIBox_current_hand_row(handname, simple)
  return (G.GAME.hands[handname].visible) and
  (not simple and
    {n=G.UIT.R, config={align = "cm", padding = 0.05, r = 0.1, colour = darken(G.C.JOKER_GREY, 0.1), emboss = 0.05, hover = true, force_focus = true, on_demand_tooltip = {text = localize(handname, 'poker_hand_descriptions'), filler = {func = create_UIBox_hand_tip, args = handname}}}, nodes={
      {n=G.UIT.C, config={align = "cl", padding = 0, minw = 5}, nodes={
        {n=G.UIT.C, config={align = "cm", padding = 0.01, r = 0.1, colour = G.C.HAND_LEVELS[math.min(7, G.GAME.hands[handname].level)], minw = 1.5, outline = 0.8, outline_colour = G.C.WHITE}, nodes={
          {n=G.UIT.T, config={text = localize('k_level_prefix')..G.GAME.hands[handname].level, scale = 0.5, colour = G.C.UI.TEXT_DARK}}
        }},
        {n=G.UIT.C, config={align = "cm", minw = 4.5, maxw = 4.5}, nodes={
          {n=G.UIT.T, config={text = ' '..localize(handname,'poker_hands'), scale = 0.45, colour = G.C.UI.TEXT_LIGHT, shadow = true}}
        }}
      }},
      {n=G.UIT.C, config={align = "cm", padding = 0.05, colour = G.C.BLACK,r = 0.1}, nodes={
        {n=G.UIT.C, config={align = "cr", padding = 0.01, r = 0.1, colour = G.C.CHIPS, minw = 1.1}, nodes={
          {n=G.UIT.T, config={text = G.GAME.hands[handname].chips, scale = 0.45, colour = G.C.UI.TEXT_LIGHT}},
          {n=G.UIT.B, config={w = 0.08, h = 0.01}}
        }},
        {n=G.UIT.T, config={text = "X", scale = 0.45, colour = G.C.MULT}},
        {n=G.UIT.C, config={align = "cl", padding = 0.01, r = 0.1, colour = G.C.MULT, minw = 1.1}, nodes={
          {n=G.UIT.B, config={w = 0.08,h = 0.01}},
          {n=G.UIT.T, config={text = G.GAME.hands[handname].mult, scale = 0.45, colour = G.C.UI.TEXT_LIGHT}}
        }}
      }},
      {n=G.UIT.C, config={align = "cm"}, nodes={
          {n=G.UIT.T, config={text = '  #', scale = 0.45, colour = G.C.UI.TEXT_LIGHT, shadow = true}}
        }},
      {n=G.UIT.C, config={align = "cm", padding = 0.05, colour = G.C.L_BLACK,r = 0.1, minw = 0.9}, nodes={
        {n=G.UIT.T, config={text = G.GAME.hands[handname].played, scale = 0.45, colour = G.C.FILTER, shadow = true}},
      }}
    }}
  or {n=G.UIT.R, config={align = "cm", padding = 0.05, r = 0.1, colour = darken(G.C.JOKER_GREY, 0.1), force_focus = true, emboss = 0.05, hover = true, on_demand_tooltip = {text = localize(handname, 'poker_hand_descriptions'), filler = {func = create_UIBox_hand_tip, args = handname}}, focus_args = {snap_to = (simple and handname == 'Straight Flush')}}, nodes={
    {n=G.UIT.C, config={align = "cm", padding = 0, minw = 5}, nodes={
        {n=G.UIT.T, config={text = localize(handname,'poker_hands'), scale = 0.5, colour = G.C.UI.TEXT_LIGHT, shadow = true}}
    }}
  }})
  or nil
end

function create_UIBox_current_hands(simple)
  local hands = {
    create_UIBox_current_hand_row("Flush Five", simple),
    create_UIBox_current_hand_row("Flush House", simple),
    create_UIBox_current_hand_row("Five of a Kind", simple),
    create_UIBox_current_hand_row("Straight Flush", simple),
    create_UIBox_current_hand_row("Four of a Kind", simple),
    create_UIBox_current_hand_row("Full House", simple),
    create_UIBox_current_hand_row("Flush", simple),
    create_UIBox_current_hand_row("Straight", simple),
    create_UIBox_current_hand_row("Three of a Kind", simple),
    create_UIBox_current_hand_row("Two Pair", simple),
    create_UIBox_current_hand_row("Pair", simple),
    create_UIBox_current_hand_row("High Card", simple)
  }

  local t = {n=G.UIT.ROOT, config={align = "cm", minw = 3, padding = 0.1, r = 0.1, colour = G.C.CLEAR}, nodes={
    {n=G.UIT.R, config={align = "cm", padding = 0.04}, nodes=
      hands
    },
  }}

  return t
end

function G.UIDEF.deck_info(_show_remaining)
  return create_UIBox_generic_options({contents ={create_tabs(
    {tabs = _show_remaining and {
        {
          label = localize('b_remaining'),
          chosen = true,
          tab_definition_function = G.UIDEF.view_deck,
          tab_definition_function_args = true,
        },
        {
            label = localize('b_full_deck'),
            tab_definition_function = G.UIDEF.view_deck
        },
    } or {
      {
        label = localize('b_full_deck'),
        chosen = true,
        tab_definition_function = G.UIDEF.view_deck
      },
    },
    tab_h = 8,
    snap_to_nav = true})}})
end

function G.UIDEF.run_info()
  return create_UIBox_generic_options({contents ={create_tabs(
    {tabs = {
          {
            label = localize('b_poker_hands'),
            chosen = true,
            tab_definition_function = create_UIBox_current_hands,
        },
        {
          label = localize('b_blinds'),
          tab_definition_function = G.UIDEF.current_blinds,
        },
        {
            label = localize('b_vouchers'),
            tab_definition_function = G.UIDEF.used_vouchers,
        },
        G.GAME.stake > 1 and {
          label = localize('b_stake'),
          tab_definition_function = G.UIDEF.current_stake,
        } or nil,
    },
    tab_h = 8,
    snap_to_nav = true})}})
end

function G.UIDEF.current_blinds()
  return {n=G.UIT.ROOT, config={align = "cm", colour = G.C.CLEAR, padding = 0.2}, nodes={
    G.GAME.round_resets.blind_states['Small'] ~= 'Hide' and {n=G.UIT.C, config={align = "tm", padding = 0.1, outline = 2, r = 0.1, line_emboss = 0.2, outline_colour = G.C.BLACK}, nodes={
      create_UIBox_blind_choice('Small', true)
    }} or nil,
    G.GAME.round_resets.blind_states['Big'] ~= 'Hide' and {n=G.UIT.C, config={align = "tm", padding = 0.1, outline = 2, r = 0.1, line_emboss = 0.2, outline_colour = G.C.BLACK}, nodes={
      create_UIBox_blind_choice('Big', true)
    }} or nil,
    G.GAME.round_resets.blind_states['Boss'] ~= 'Hide' and {n=G.UIT.C, config={align = "tm", padding = 0.1, outline = 2, r = 0.1, line_emboss = 0.2, outline_colour = G.C.BLACK}, nodes={
      create_UIBox_blind_choice('Boss', true)
    }} or nil
  }}
end

function G.UIDEF.deck_stake_column(_deck_key)
  local deck_usage = G.PROFILES[G.SETTINGS.profile].deck_usage[_deck_key]
  local stake_col = {}
  local valid_option = nil
    for i = #G.P_CENTER_POOLS['Stake'], 1, -1 do
      local _wins = deck_usage and deck_usage.wins[i] or 0
      if (deck_usage and deck_usage.wins[i-1]) or i == 1 or G.PROFILES[G.SETTINGS.profile].all_unlocked then valid_option = true end
      stake_col[#stake_col+1] = {n=G.UIT.R, config={id = i, align = "cm", colour = _wins > 0 and G.C.GREY or G.C.CLEAR, outline = 0, outline_colour = G.C.WHITE, r = 0.1, minh = 0.25, minw = valid_option and 0.45 or 0.25, func = 'RUN_SETUP_check_back_stake_highlight'}, nodes={
        {n=G.UIT.R, config={align = "cm", minh = valid_option and 0.17 or 0.13, minw = valid_option and 0.37 or 0.13, colour = _wins > 0 and get_stake_col(i) or G.C.UI.TRANSPARENT_LIGHT, r = 0.1},nodes={}}
      }}
      if i > 1 then stake_col[#stake_col+1] = {n=G.UIT.R, config={align = "cm", minh = 0.1, minw = 0.04},nodes={}} end
    end
    return {n=G.UIT.ROOT, config={align = 'cm', colour = G.C.CLEAR}, nodes =stake_col}
end

function G.UIDEF.current_stake()
  local other_col = nil
  if G.GAME.stake > 2 then
    local stake_desc_rows = {{n=G.UIT.R, config={align = "cm", padding = 0.05}, nodes={
      {n=G.UIT.T, config={text = localize('k_also_applied'), scale = 0.4, colour = G.C.WHITE}}
    }}
  }
    for i = G.GAME.stake-1, 2, -1 do
      local _stake_desc = {}
      local _stake_center = G.P_CENTER_POOLS.Stake[i]
      localize{type = 'descriptions', key = _stake_center.key, set = _stake_center.set, nodes = _stake_desc}
      local _full_desc = {}
      for k, v in ipairs(_stake_desc) do
        _full_desc[#_full_desc+1] = {n=G.UIT.R, config={align = "cm"}, nodes=v}
      end
      _full_desc[#_full_desc] = nil
      stake_desc_rows[#stake_desc_rows+1] = {n=G.UIT.R, config={align = "cm"}, nodes={
        {n=G.UIT.C, config={align = 'cm'}, nodes ={{n=G.UIT.C, config={align = "cm", colour = get_stake_col(i), r = 0.1, minh = 0.35, minw = 0.35, emboss = 0.05}, nodes={}}, {n=G.UIT.B, config={w=0.1,h=0.1}}}},
        {n=G.UIT.C, config={align = "cm", padding = 0.03, colour = G.C.WHITE, r = 0.1, minh = 0.7, minw = 4.8}, nodes=_full_desc},
      }}
    end
    other_col = {n=G.UIT.R, config={align = "cm", padding = 0.05, r = 0.1, colour = G.C.L_BLACK}, nodes=stake_desc_rows}
  end

  local stake_sprite = get_stake_sprite(G.GAME.stake, 0.8)
  local _stake_desc = {}
  local _stake_center = G.P_CENTER_POOLS.Stake[G.GAME.stake]
  localize{type = 'descriptions', key = _stake_center.key, set = _stake_center.set, nodes = _stake_desc}
  local _full_desc = {}
  for k, v in ipairs(_stake_desc) do
    _full_desc[#_full_desc+1] = {n=G.UIT.R, config={align = "cm"}, nodes=v}
  end
  _full_desc[#_full_desc] = nil
  local current_col = {n=G.UIT.R, config={align = "cm"}, nodes={
    {n=G.UIT.R, config={align = "cm", padding = 0.1, minw = 4}, nodes={
      {n=G.UIT.O, config={colour = G.C.BLUE, object = stake_sprite, hover = true, can_collide = false}},
      {n=G.UIT.T, config={text = localize{type = 'name_text', key = G.P_CENTER_POOLS.Stake[G.GAME.stake].key, set = 'Stake'}, scale = 0.45, colour = G.C.WHITE}}
    }},
    {n=G.UIT.R, config={align = "cm", padding = 0.05, colour = get_stake_col(G.GAME.stake), r = 0.05}, nodes={
      {n=G.UIT.R, config={align = "cm", padding = 0.05, colour = G.C.WHITE, r = 0.05}, nodes={
        {n=G.UIT.R, config={align = "cm", padding = 0.03, minh = 0.7, minw = 3.8}, nodes=_full_desc}
      }}
    }}
  }}

  return {n=G.UIT.ROOT, config={align = "cm", colour = G.C.BLACK, r = 0.1, padding = 0.1}, nodes={
    current_col,other_col
  }}
end

function G.UIDEF.view_deck(unplayed_only)
  local deck_tables = {}
  remove_nils(G.playing_cards)
  G.VIEWING_DECK = true
  table.sort(G.playing_cards, function (a, b) return a:get_nominal('suit') > b:get_nominal('suit') end )
  local SUITS = {
    Spades = {},
    Hearts = {},
    Clubs = {},
    Diamonds = {},
  }
  local suit_map = {'Spades', 'Hearts', 'Clubs', 'Diamonds'}
  for k, v in ipairs(G.playing_cards) do
    table.insert(SUITS[v.base.suit], v)
  end
  for j = 1, 4 do
    if SUITS[suit_map[j]][1] then
      local view_deck = CardArea(
        G.ROOM.T.x + 0.2*G.ROOM.T.w/2,G.ROOM.T.h,
        6.5*G.CARD_W,
        0.6*G.CARD_H,
        {card_limit = #SUITS[suit_map[j]], type = 'title', view_deck = true, highlight_limit = 0, card_w = G.CARD_W*0.7, draw_layers = {'card'}})
      table.insert(deck_tables, 
      {n=G.UIT.R, config={align = "cm", padding = 0}, nodes={
        {n=G.UIT.O, config={object = view_deck}}
      }}
      )

      for i = 1, #SUITS[suit_map[j]] do
        if SUITS[suit_map[j]][i] then
          local greyed, _scale = nil, 0.7
          if unplayed_only and not ((SUITS[suit_map[j]][i].area and SUITS[suit_map[j]][i].area == G.deck) or SUITS[suit_map[j]][i].ability.wheel_flipped) then
            greyed = true
          end
          local copy = copy_card(SUITS[suit_map[j]][i],nil, _scale)
          copy.greyed = greyed
          copy.T.x = view_deck.T.x + view_deck.T.w/2
          copy.T.y = view_deck.T.y

          copy:hard_set_T()
          view_deck:emplace(copy)
        end
      end
    end
  end

  local flip_col = G.C.WHITE

  local suit_tallies = {['Spades']  = 0, ['Hearts'] = 0, ['Clubs'] = 0, ['Diamonds'] = 0}
  local mod_suit_tallies = {['Spades']  = 0, ['Hearts'] = 0, ['Clubs'] = 0, ['Diamonds'] = 0}
  local rank_tallies = {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}
  local mod_rank_tallies = {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}
  local rank_name_mapping = {2, 3, 4, 5, 6, 7, 8, 9, 10, 'J', 'Q', 'K', 'A'}
  local face_tally = 0
  local mod_face_tally = 0
  local num_tally = 0
  local mod_num_tally = 0
  local ace_tally = 0
  local mod_ace_tally = 0
  local wheel_flipped = 0

  for k, v in ipairs(G.playing_cards) do
    if v.ability.name ~= 'Stone Card' and (not unplayed_only or ((v.area and v.area == G.deck) or v.ability.wheel_flipped)) then 
      if v.ability.wheel_flipped and unplayed_only then wheel_flipped = wheel_flipped + 1 end
      --For the suits
      suit_tallies[v.base.suit] = (suit_tallies[v.base.suit] or 0) + 1
      mod_suit_tallies['Spades'] = (mod_suit_tallies['Spades'] or 0) + (v:is_suit('Spades') and 1 or 0)
      mod_suit_tallies['Hearts'] = (mod_suit_tallies['Hearts'] or 0) + (v:is_suit('Hearts') and 1 or 0)
      mod_suit_tallies['Clubs'] = (mod_suit_tallies['Clubs'] or 0) + (v:is_suit('Clubs') and 1 or 0)
      mod_suit_tallies['Diamonds'] = (mod_suit_tallies['Diamonds'] or 0) + (v:is_suit('Diamonds') and 1 or 0)

      --for face cards/numbered cards/aces
      local card_id = v:get_id()
      face_tally = face_tally + ((card_id ==11 or card_id ==12 or card_id ==13) and 1 or 0)
      mod_face_tally = mod_face_tally + (v:is_face() and 1 or 0)
      if card_id > 1 and card_id < 11 then
        num_tally = num_tally + 1
        if not v.debuff then mod_num_tally = mod_num_tally + 1 end 
      end
      if card_id == 14 then
        ace_tally = ace_tally + 1
        if not v.debuff then mod_ace_tally = mod_ace_tally + 1 end 
      end

      --ranks
      rank_tallies[card_id - 1] = rank_tallies[card_id - 1] + 1
      if not v.debuff then mod_rank_tallies[card_id - 1] = mod_rank_tallies[card_id - 1] + 1 end 
    end
  end

  local modded = (face_tally ~= mod_face_tally) or
    (mod_suit_tallies['Spades'] ~= suit_tallies['Spades']) or
    (mod_suit_tallies['Hearts'] ~= suit_tallies['Hearts']) or
    (mod_suit_tallies['Clubs'] ~= suit_tallies['Clubs']) or
    (mod_suit_tallies['Diamonds'] ~= suit_tallies['Diamonds'])

  if wheel_flipped > 0 then flip_col = mix_colours(G.C.FILTER, G.C.WHITE,0.7) end

  local rank_cols = {}
  for i = 13, 1, -1 do
    local mod_delta = mod_rank_tallies[i] ~= rank_tallies[i]
    rank_cols[#rank_cols+1] = {n=G.UIT.R, config={align = "cm", padding = 0.07}, nodes={
      {n=G.UIT.C, config={align = "cm", r = 0.1, padding = 0.04, emboss = 0.04, minw = 0.5, colour = G.C.L_BLACK}, nodes={
        {n=G.UIT.T, config={text = rank_name_mapping[i],colour = G.C.JOKER_GREY, scale = 0.35, shadow = true}},
      }},
      {n=G.UIT.C, config={align = "cr", minw = 0.4}, nodes={
        mod_delta and {n=G.UIT.O, config={object = DynaText({string = {{string = ''..rank_tallies[i], colour = flip_col},{string =''..mod_rank_tallies[i], colour = G.C.BLUE}}, colours = {G.C.RED}, scale = 0.4, y_offset = -2, silent = true, shadow = true, pop_in_rate = 10, pop_delay = 4})}} or
        {n=G.UIT.T, config={text = rank_tallies[i] or 'NIL',colour = flip_col, scale = 0.45, shadow = true}},
      }}
    }}
  end


  local t = 
  {n=G.UIT.ROOT, config={align = "cm", colour = G.C.CLEAR}, nodes={
    {n=G.UIT.R, config={align = "cm", padding = 0.05}, nodes={}},
    {n=G.UIT.R, config={align = "cm"}, nodes={
      {n=G.UIT.C, config={align = "cm", minw = 1.5, minh = 2, r = 0.1, colour = G.C.BLACK, emboss = 0.05}, nodes={
        {n=G.UIT.C, config={align = "cm", padding = 0.1}, nodes={
          {n=G.UIT.R, config={align = "cm", r = 0.1, colour = G.C.L_BLACK, emboss = 0.05, padding = 0.15}, nodes={
            {n=G.UIT.R, config={align = "cm"}, nodes={
              {n=G.UIT.O, config={object = DynaText({string = G.GAME.selected_back.loc_name, colours = {G.C.WHITE}, bump = true, rotate = true, shadow = true, scale = 0.6 - string.len(G.GAME.selected_back.loc_name)*0.01})}},
            }},
            {n=G.UIT.R, config={align = "cm", r = 0.1, padding = 0.1, minw = 2.5, minh = 1.3, colour = G.C.WHITE, emboss = 0.05}, nodes={
              {n=G.UIT.O, config={object = UIBox{
                definition = G.GAME.selected_back:generate_UI(nil,0.7, 0.5, G.GAME.challenge),
                config = {offset = {x=0,y=0}}
              }}}
            }}
          }},
          {n=G.UIT.R, config={align = "cm", r = 0.1, outline_colour = G.C.L_BLACK, line_emboss = 0.05, outline = 1.5}, nodes={
            {n=G.UIT.R, config={align = "cm", minh = 0.05, padding = 0.07}, nodes={
                {n=G.UIT.O, config={object = DynaText({string = {{string = localize('k_base_cards'), colour = G.C.RED}, modded and {string = localize('k_effective'), colour = G.C.BLUE} or nil}, colours = {G.C.RED}, silent = true,scale = 0.4,pop_in_rate = 10, pop_delay = 4})}}
            }},
            {n=G.UIT.R, config={align = "cm", minh = 0.05, padding = 0.1}, nodes={
              tally_sprite({x=1,y=0},{{string = ''..ace_tally, colour = flip_col},{string =''..mod_ace_tally, colour = G.C.BLUE}}, {localize('k_aces')}),--Aces
              tally_sprite({x=2,y=0},{{string = ''..face_tally, colour = flip_col},{string =''..mod_face_tally, colour = G.C.BLUE}}, {localize('k_face_cards')}),--Face
              tally_sprite({x=3,y=0},{{string = ''..num_tally, colour = flip_col},{string =''..mod_num_tally, colour = G.C.BLUE}}, {localize('k_numbered_cards')}),--Numbers
            }},
            {n=G.UIT.R, config={align = "cm", minh = 0.05, padding = 0.1}, nodes={
              tally_sprite({x=3,y=1}, {{string = ''..suit_tallies['Spades'], colour = flip_col},{string =''..mod_suit_tallies['Spades'], colour = G.C.BLUE}}, {localize('Spades', 'suits_plural')}),
              tally_sprite({x=0,y=1}, {{string = ''..suit_tallies['Hearts'], colour = flip_col},{string =''..mod_suit_tallies['Hearts'], colour = G.C.BLUE}}, {localize('Hearts', 'suits_plural')}),
            }},
            {n=G.UIT.R, config={align = "cm", minh = 0.05, padding = 0.1}, nodes={
              tally_sprite({x=2,y=1}, {{string = ''..suit_tallies['Clubs'], colour = flip_col},{string =''..mod_suit_tallies['Clubs'], colour = G.C.BLUE}}, {localize('Clubs', 'suits_plural')}),
              tally_sprite({x=1,y=1}, {{string = ''..suit_tallies['Diamonds'], colour = flip_col},{string =''..mod_suit_tallies['Diamonds'], colour = G.C.BLUE}}, {localize('Diamonds', 'suits_plural')}),
            }},
          }}
        }},
        {n=G.UIT.C, config={align = "cm"}, nodes=rank_cols},
        {n=G.UIT.B, config={w = 0.1, h = 0.1}},
      }},
      {n=G.UIT.B, config={w = 0.2, h = 0.1}},
      {n=G.UIT.C, config={align = "cm", padding = 0.1, r = 0.1, colour = G.C.BLACK, emboss = 0.05}, nodes=deck_tables}
    }},
    {n=G.UIT.R, config={align = "cm", minh = 0.8, padding = 0.05}, nodes={
      modded and {n=G.UIT.R, config={align = "cm"}, nodes={
        {n=G.UIT.C, config={padding = 0.3, r = 0.1, colour = mix_colours(G.C.BLUE, G.C.WHITE,0.7)}, nodes = {}},
        {n=G.UIT.T, config={text =' '..localize('ph_deck_preview_effective'),colour = G.C.WHITE, scale =0.3}},
      }} or nil,
      wheel_flipped > 0 and {n=G.UIT.R, config={align = "cm"}, nodes={
        {n=G.UIT.C, config={padding = 0.3, r = 0.1, colour = flip_col}, nodes = {}},
        {n=G.UIT.T, config={text =' '..(wheel_flipped > 1 and
          localize{type = 'variable', key = 'deck_preview_wheel_plural', vars = {wheel_flipped}} or
          localize{type = 'variable', key = 'deck_preview_wheel_singular', vars = {wheel_flipped}}),colour = G.C.WHITE, scale =0.3}},
      }} or nil,
    }}
  }}
  return t
end

function tally_sprite(pos, value, tooltip)
  local text_colour = G.C.BLACK
  if type(value) == "table" and value[1].string==value[2].string then 
    text_colour = value[1].colour or G.C.WHITE
    value = value[1].string
  end
  local t_s = Sprite(0,0,0.5,0.5,G.ASSET_ATLAS["ui_"..(G.SETTINGS.colourblind_option and 2 or 1)], {x=pos.x or 0, y=pos.y or 0})
  t_s.states.drag.can = false
  t_s.states.hover.can = false
  t_s.states.collide.can = false
  return 
  {n=G.UIT.C, config={align = "cm", padding = 0.07,force_focus = true,  focus_args = {type = 'tally_sprite'}, tooltip = {text = tooltip}}, nodes={
    {n=G.UIT.R, config={align = "cm", r = 0.1, padding = 0.04, emboss = 0.05, colour = G.C.JOKER_GREY}, nodes={
      {n=G.UIT.O, config={w=0.5,h=0.5 ,can_collide = false, object = t_s, tooltip = {text = tooltip}}}
    }},
    {n=G.UIT.R, config={align = "cm"}, nodes={
      type(value) == "table" and {n=G.UIT.O, config={object = DynaText({string = value, colours = {G.C.RED}, scale = 0.4, silent = true, shadow = true, pop_in_rate = 10, pop_delay = 4})}} or
      {n=G.UIT.T, config={text = value or 'NIL',colour = text_colour, scale = 0.4, shadow = true}},
    }},
  }}
end

function G.UIDEF.used_vouchers()

  local silent = false
  local keys_used = {}
  local area_count = 0
  local voucher_areas = {}
  local voucher_tables = {}
  local voucher_table_rows = {}
  for k, v in ipairs(G.P_CENTER_POOLS["Voucher"]) do
    local key = 1 + math.floor((k-0.1)/2)
    keys_used[key] = keys_used[key] or {}
    if G.GAME.used_vouchers[v.key] then 
      keys_used[key][#keys_used[key]+1] = v
    end
  end
  for k, v in ipairs(keys_used) do 
    if next(v) then
      area_count = area_count + 1
    end
  end
  for k, v in ipairs(keys_used) do 
    if next(v) then
      if #voucher_areas == 5 or #voucher_areas == 10 then 
        table.insert(voucher_table_rows, 
        {n=G.UIT.R, config={align = "cm", padding = 0, no_fill = true}, nodes=voucher_tables}
        )
        voucher_tables = {}
      end
      voucher_areas[#voucher_areas + 1] = CardArea(
      G.ROOM.T.x + 0.2*G.ROOM.T.w/2,G.ROOM.T.h,
      (#v == 1 and 1 or 1.33)*G.CARD_W,
      (area_count >=10 and 0.75 or 1.07)*G.CARD_H, 
      {card_limit = 2, type = 'voucher', highlight_limit = 0})
      for kk, vv in ipairs(v) do 
        local center = G.P_CENTERS[vv.key]
        local card = Card(voucher_areas[#voucher_areas].T.x + voucher_areas[#voucher_areas].T.w/2, voucher_areas[#voucher_areas].T.y, G.CARD_W, G.CARD_H, nil, center, {bypass_discovery_center=true,bypass_discovery_ui=true,bypass_lock=true})
        card.ability.order = vv.order
        card:start_materialize(nil, silent)
        silent = true
        voucher_areas[#voucher_areas]:emplace(card)
      end
      table.insert(voucher_tables, 
      {n=G.UIT.C, config={align = "cm", padding = 0, no_fill = true}, nodes={
        {n=G.UIT.O, config={object = voucher_areas[#voucher_areas]}}
      }}
      )
    end
  end
  table.insert(voucher_table_rows,
          {n=G.UIT.R, config={align = "cm", padding = 0, no_fill = true}, nodes=voucher_tables}
        )

  
  local t = silent and {n=G.UIT.ROOT, config={align = "cm", colour = G.C.CLEAR}, nodes={
    {n=G.UIT.R, config={align = "cm"}, nodes={
      {n=G.UIT.O, config={object = DynaText({string = {localize('ph_vouchers_redeemed')}, colours = {G.C.UI.TEXT_LIGHT}, bump = true, scale = 0.6})}}
    }},
    {n=G.UIT.R, config={align = "cm", minh = 0.5}, nodes={
    }},
    {n=G.UIT.R, config={align = "cm", colour = G.C.BLACK, r = 1, padding = 0.15, emboss = 0.05}, nodes={
      {n=G.UIT.R, config={align = "cm"}, nodes=voucher_table_rows},
    }}
  }} or 
  {n=G.UIT.ROOT, config={align = "cm", colour = G.C.CLEAR}, nodes={
    {n=G.UIT.O, config={object = DynaText({string = {localize('ph_no_vouchers')}, colours = {G.C.UI.TEXT_LIGHT}, bump = true, scale = 0.6})}}
  }}
  return t
end



function create_UIBox_your_collection()
  set_discover_tallies()
  G.E_MANAGER:add_event(Event({
    blockable = false,
    func = function()
      G.REFRESH_ALERTS = true
    return true
    end
  }))
  local t = create_UIBox_generic_options({ back_func = G.STAGE == G.STAGES.RUN and 'options' or 'exit_overlay_menu', contents = {
    {n=G.UIT.C, config={align = "cm", padding = 0.15}, nodes={
      UIBox_button({button = 'your_collection_jokers', label = {localize('b_jokers')}, count = G.DISCOVER_TALLIES.jokers,  minw = 5, minh = 1.7, scale = 0.6, id = 'your_collection_jokers'}),
      UIBox_button({button = 'your_collection_decks', label = {localize('b_decks')}, count = G.DISCOVER_TALLIES.backs, minw = 5}),
      UIBox_button({button = 'your_collection_vouchers', label = {localize('b_vouchers')}, count = G.DISCOVER_TALLIES.vouchers, minw = 5, id = 'your_collection_vouchers'}),
      {n=G.UIT.R, config={align = "cm", padding = 0.1, r=0.2, colour = G.C.BLACK}, nodes={
        {n=G.UIT.C, config={align = "cm", maxh=2.9}, nodes={
          {n=G.UIT.T, config={text = localize('k_cap_consumables'), scale = 0.45, colour = G.C.L_BLACK, vert = true, maxh=2.2}},
        }},
        {n=G.UIT.C, config={align = "cm", padding = 0.15}, nodes={
          UIBox_button({button = 'your_collection_tarots', label = {localize('b_tarot_cards')}, count = G.DISCOVER_TALLIES.tarots, minw = 4, id = 'your_collection_tarots', colour = G.C.SECONDARY_SET.Tarot}),
          UIBox_button({button = 'your_collection_planets', label = {localize('b_planet_cards')}, count = G.DISCOVER_TALLIES.planets, minw = 4, id = 'your_collection_planets', colour = G.C.SECONDARY_SET.Planet}),
          UIBox_button({button = 'your_collection_spectrals', label = {localize('b_spectral_cards')}, count = G.DISCOVER_TALLIES.spectrals, minw = 4, id = 'your_collection_spectrals', colour = G.C.SECONDARY_SET.Spectral}),
        }}
      }},
    }},
    {n=G.UIT.C, config={align = "cm", padding = 0.15}, nodes={
      UIBox_button({button = 'your_collection_enhancements', label = {localize('b_enhanced_cards')}, minw = 5}),
      UIBox_button({button = 'your_collection_seals', label = {localize('b_seals')}, minw = 5, id = 'your_collection_seals'}),
      UIBox_button({button = 'your_collection_editions', label = {localize('b_editions')}, count = G.DISCOVER_TALLIES.editions, minw = 5, id = 'your_collection_editions'}),
      UIBox_button({button = 'your_collection_boosters', label = {localize('b_booster_packs')}, count = G.DISCOVER_TALLIES.boosters, minw = 5, id = 'your_collection_boosters'}),
      UIBox_button({button = 'your_collection_tags', label = {localize('b_tags')}, count = G.DISCOVER_TALLIES.tags, minw = 5, id = 'your_collection_tags'}),
      UIBox_button({button = 'your_collection_blinds', label = {localize('b_blinds')}, count = G.DISCOVER_TALLIES.blinds, minw = 5, minh = 2.0, id = 'your_collection_blinds', focus_args = {snap_to = true}}),
    }},
    
  }})
  return t
end

function create_UIBox_your_collection_jokers()
  local deck_tables = {}

  G.your_collection = {}
  for j = 1, 3 do
    G.your_collection[j] = CardArea(
      G.ROOM.T.x + 0.2*G.ROOM.T.w/2,G.ROOM.T.h,
      5*G.CARD_W,
      0.95*G.CARD_H, 
      {card_limit = 5, type = 'title', highlight_limit = 0, collection = true})
    table.insert(deck_tables, 
    {n=G.UIT.R, config={align = "cm", padding = 0.07, no_fill = true}, nodes={
      {n=G.UIT.O, config={object = G.your_collection[j]}}
    }}
    )
  end

  local joker_options = {}
  for i = 1, math.ceil(#G.P_CENTER_POOLS.Joker/(5*#G.your_collection)) do
    table.insert(joker_options, localize('k_page')..' '..tostring(i)..'/'..tostring(math.ceil(#G.P_CENTER_POOLS.Joker/(5*#G.your_collection))))
  end

  for i = 1, 5 do
    for j = 1, #G.your_collection do
      local center = G.P_CENTER_POOLS["Joker"][i+(j-1)*5]
      local card = Card(G.your_collection[j].T.x + G.your_collection[j].T.w/2, G.your_collection[j].T.y, G.CARD_W, G.CARD_H, nil, center)
      card.sticker = get_joker_win_sticker(center)
      G.your_collection[j]:emplace(card)
    end
  end

  INIT_COLLECTION_CARD_ALERTS()
  
  local t =  create_UIBox_generic_options({ back_func = 'your_collection', contents = {
        {n=G.UIT.R, config={align = "cm", r = 0.1, colour = G.C.BLACK, emboss = 0.05}, nodes=deck_tables}, 
        {n=G.UIT.R, config={align = "cm"}, nodes={
          create_option_cycle({options = joker_options, w = 4.5, cycle_shoulders = true, opt_callback = 'your_collection_joker_page', current_option = 1, colour = G.C.RED, no_pips = true, focus_args = {snap_to = true, nav = 'wide'}})
        }}
    }})
  return t
end

function create_UIBox_your_collection_tarots()
  local deck_tables = {}

  G.your_collection = {}
  for j = 1, 2 do
    G.your_collection[j] = CardArea(
      G.ROOM.T.x + 0.2*G.ROOM.T.w/2,G.ROOM.T.h,
      (4.25+j)*G.CARD_W,
      1*G.CARD_H, 
      {card_limit = 4 + j, type = 'title', highlight_limit = 0, collection = true})
    table.insert(deck_tables, 
    {n=G.UIT.R, config={align = "cm", padding = 0, no_fill = true}, nodes={
      {n=G.UIT.O, config={object = G.your_collection[j]}}
    }}
    )
  end

  local tarot_options = {}
  for i = 1, math.floor(#G.P_CENTER_POOLS.Tarot/11) do
    table.insert(tarot_options, localize('k_page')..' '..tostring(i)..'/'..tostring(math.floor(#G.P_CENTER_POOLS.Tarot/11)))
  end

    for j = 1, #G.your_collection do
      for i = 1, 4+j do
      local center = G.P_CENTER_POOLS["Tarot"][i+(j-1)*(5)]
      local card = Card(G.your_collection[j].T.x + G.your_collection[j].T.w/2, G.your_collection[j].T.y, G.CARD_W, G.CARD_H, nil, center)
      card:start_materialize(nil, i>1 or j>1)
      G.your_collection[j]:emplace(card)
    end
  end

  INIT_COLLECTION_CARD_ALERTS()
  
  local t = create_UIBox_generic_options({ back_func = 'your_collection', contents = {
            {n=G.UIT.R, config={align = "cm", minw = 2.5, padding = 0.1, r = 0.1, colour = G.C.BLACK, emboss = 0.05}, nodes=deck_tables},
                  {n=G.UIT.R, config={align = "cm"}, nodes={
                    create_option_cycle({options = tarot_options, w = 4.5, cycle_shoulders = true, opt_callback = 'your_collection_tarot_page', focus_args = {snap_to = true, nav = 'wide'},current_option = 1, colour = G.C.RED, no_pips = true})
                  }}
          }})
  return t
end

function create_UIBox_your_collection_boosters()
  local deck_tables = {}

  G.your_collection = {}
  for j = 1, 2 do
    G.your_collection[j] = CardArea(
      G.ROOM.T.x + 0.2*G.ROOM.T.w/2,G.ROOM.T.h,
      (5.25)*G.CARD_W,
      1.3*G.CARD_H, 
      {card_limit = 4, type = 'title', highlight_limit = 0, collection = true})
    table.insert(deck_tables, 
    {n=G.UIT.R, config={align = "cm", padding = 0, no_fill = true}, nodes={
      {n=G.UIT.O, config={object = G.your_collection[j]}}
    }}
    )
  end

  local booster_options = {}
  for i = 1, math.ceil(#G.P_CENTER_POOLS.Booster/8) do
    table.insert(booster_options, localize('k_page')..' '..tostring(i)..'/'..tostring(math.ceil(#G.P_CENTER_POOLS.Booster/8)))
  end

    for j = 1, #G.your_collection do
      for i = 1, 4 do
      local center = G.P_CENTER_POOLS["Booster"][i+(j-1)*4]
      local card = Card(G.your_collection[j].T.x + G.your_collection[j].T.w/2, G.your_collection[j].T.y, G.CARD_W*1.27, G.CARD_H*1.27, nil, center)
      card:start_materialize(nil, i>1 or j>1)
      G.your_collection[j]:emplace(card)
    end
  end

  INIT_COLLECTION_CARD_ALERTS()
  
  local t = create_UIBox_generic_options({ back_func = 'your_collection', contents = {
            {n=G.UIT.R, config={align = "cm", minw = 2.5, padding = 0.1, r = 0.1, colour = G.C.BLACK, emboss = 0.05}, nodes=deck_tables},
                  {n=G.UIT.R, config={align = "cm"}, nodes={
                    create_option_cycle({options = booster_options, w = 4.5, cycle_shoulders = true, opt_callback = 'your_collection_booster_page', focus_args = {snap_to = true, nav = 'wide'},current_option = 1, colour = G.C.RED, no_pips = true})
                  }}
          }})
  return t
end

function create_UIBox_your_collection_planets()
  local deck_tables = {}

  G.your_collection = {}
  for j = 1, 2 do
    G.your_collection[j] = CardArea(
      G.ROOM.T.x + 0.2*G.ROOM.T.w/2,G.ROOM.T.h,
      (6.25)*G.CARD_W,
      1*G.CARD_H, 
      {card_limit = 6, type = 'title', highlight_limit = 0, collection = true})
    table.insert(deck_tables, 
    {n=G.UIT.R, config={align = "cm", padding = 0, no_fill = true}, nodes={
      {n=G.UIT.O, config={object = G.your_collection[j]}}
    }}
    )
  end

    for j = 1, #G.your_collection do
      for i = 1, 6 do
      local center = G.P_CENTER_POOLS["Planet"][i+(j-1)*(6)]
      local card = Card(G.your_collection[j].T.x + G.your_collection[j].T.w/2, G.your_collection[j].T.y, G.CARD_W, G.CARD_H, nil, center)
      card:start_materialize(nil, i>1 or j>1)
      G.your_collection[j]:emplace(card)
    end
  end

  INIT_COLLECTION_CARD_ALERTS()
  
  local t = create_UIBox_generic_options({ back_func = 'your_collection', contents = {
            {n=G.UIT.R, config={align = "cm", minw = 2.5, padding = 0.1, r = 0.1, colour = G.C.BLACK, emboss = 0.05}, nodes=deck_tables},
            {n=G.UIT.R, config={align = "cm", padding = 0.7}, nodes={}},
          }})
  return t
end

function create_UIBox_your_collection_spectrals()
  local deck_tables = {}

  G.your_collection = {}
  for j = 1, 2 do
    G.your_collection[j] = CardArea(
      G.ROOM.T.x + 0.2*G.ROOM.T.w/2,G.ROOM.T.h,
      (3.25+j)*G.CARD_W,
      1*G.CARD_H, 
      {card_limit = 3+j, type = 'title', highlight_limit = 0, collection = true})
    table.insert(deck_tables, 
    {n=G.UIT.R, config={align = "cm", padding = 0, no_fill = true}, nodes={
      {n=G.UIT.O, config={object = G.your_collection[j]}}
    }}
    )
  end

    for j = 1, #G.your_collection do
      for i = 1, 3+j do
      local center = G.P_CENTER_POOLS["Spectral"][i+(j-1)*3 + j - 1]
      
      local card = Card(G.your_collection[j].T.x + G.your_collection[j].T.w/2, G.your_collection[j].T.y, G.CARD_W, G.CARD_H, nil, center)
      card:start_materialize(nil, i>1 or j>1)
      G.your_collection[j]:emplace(card)
    end
  end

  local spectral_options = {}
  for i = 1, math.floor(#G.P_CENTER_POOLS.Tarot/9) do
    table.insert(spectral_options, localize('k_page')..' '..tostring(i)..'/'..tostring(math.floor(#G.P_CENTER_POOLS.Spectral/9)))
  end

  INIT_COLLECTION_CARD_ALERTS()
  
  local t = create_UIBox_generic_options({ back_func = 'your_collection', contents = {
            {n=G.UIT.R, config={align = "cm", minw = 2.5, padding = 0.1, r = 0.1, colour = G.C.BLACK, emboss = 0.05}, nodes=deck_tables},
            {n=G.UIT.R, config={align = "cm", padding = 0}, nodes={
              create_option_cycle({options = spectral_options, w = 4.5, cycle_shoulders = true, opt_callback = 'your_collection_spectral_page', focus_args = {snap_to = true, nav = 'wide'},current_option = 1, colour = G.C.RED, no_pips = true})
            }},
          }})
  return t
end

function create_UIBox_your_collection_vouchers(exit)
  local deck_tables = {}

  G.your_collection = {}
  for j = 1, 2 do
    G.your_collection[j] = CardArea(
      G.ROOM.T.x + 0.2*G.ROOM.T.w/2,G.ROOM.T.h,
      4.25*G.CARD_W,
      1*G.CARD_H, 
      {card_limit = 4, type = 'voucher', highlight_limit = 0, collection = true})
    table.insert(deck_tables, 
    {n=G.UIT.R, config={align = "cm", padding = 0, no_fill = true}, nodes={
      {n=G.UIT.O, config={object = G.your_collection[j]}}
    }}
    )
  end

  local voucher_options = {}
  for i = 1, math.ceil(#G.P_CENTER_POOLS.Voucher/(4*#G.your_collection)) do
    table.insert(voucher_options, localize('k_page')..' '..tostring(i)..'/'..tostring(math.ceil(#G.P_CENTER_POOLS.Voucher/(4*#G.your_collection))))
  end

  for i = 1, 4 do
    for j = 1, #G.your_collection do
      local center = G.P_CENTER_POOLS["Voucher"][i+(j-1)*4]
      local card = Card(G.your_collection[j].T.x + G.your_collection[j].T.w/2, G.your_collection[j].T.y, G.CARD_W, G.CARD_H, nil, center)
      card.ability.order = i+(j-1)*4
      card:start_materialize(nil, i>1 or j>1)
      G.your_collection[j]:emplace(card)
    end
  end

  INIT_COLLECTION_CARD_ALERTS()
  
  local t = create_UIBox_generic_options({ back_func = exit or 'your_collection', contents = {
            {n=G.UIT.R, config={align = "cm", minw = 2.5, padding = 0.1, r = 0.1, colour = G.C.BLACK, emboss = 0.05}, nodes=deck_tables},
            {n=G.UIT.R, config={align = "cm"}, nodes={
              create_option_cycle({options = voucher_options, w = 4.5, cycle_shoulders = true, opt_callback = 'your_collection_voucher_page', focus_args = {snap_to = true, nav = 'wide'}, current_option = 1, colour = G.C.RED, no_pips = true})
            }}
          }})
  return t
end

function create_UIBox_your_collection_seals(exit)
  local deck_tables = {}

  G.your_collection = CardArea(
      G.ROOM.T.x + 0.2*G.ROOM.T.w/2,G.ROOM.T.h,
      4.25*G.CARD_W,
      1.03*G.CARD_H, 
      {card_limit = 4, type = 'title', highlight_limit = 0})
    table.insert(deck_tables, 
    {n=G.UIT.R, config={align = "cm", padding = 0, no_fill = true}, nodes={
      {n=G.UIT.O, config={object = G.your_collection}}
    }}
    )

  for k, v in ipairs(G.P_CENTER_POOLS['Seal']) do
    local center = G.P_CENTERS.c_base
    local card = Card(G.your_collection.T.x + G.your_collection.T.w/2, G.your_collection.T.y, G.CARD_W, G.CARD_H, G.P_CARDS.empty, center)
    card:set_seal(v.key, true)
    G.your_collection:emplace(card)
  end
  
  local t = create_UIBox_generic_options({ infotip = localize('ml_edition_seal_enhancement_explanation'), back_func = exit or 'your_collection', snap_back = true, contents = {
            {n=G.UIT.R, config={align = "cm", minw = 2.5, padding = 0.1, r = 0.1, colour = G.C.BLACK, emboss = 0.05}, nodes=deck_tables},
          }})
  return t
end

function create_UIBox_your_collection_enhancements(exit)
  local deck_tables = {}

  G.your_collection = {}
  for j = 1, 2 do
    G.your_collection[j] = CardArea(
      G.ROOM.T.x + 0.2*G.ROOM.T.w/2,G.ROOM.T.h,
      4.25*G.CARD_W,
      1.03*G.CARD_H, 
      {card_limit = 4, type = 'title', highlight_limit = 0})
    table.insert(deck_tables, 
    {n=G.UIT.R, config={align = "cm", padding = 0, no_fill = true}, nodes={
      {n=G.UIT.O, config={object = G.your_collection[j]}}
    }}
    )
  end

  for i = 1, 4 do
    for j = 1, #G.your_collection do
      local center = G.P_CENTER_POOLS["Enhanced"][i+(j-1)*4]
      local card = Card(G.your_collection[j].T.x + G.your_collection[j].T.w/2, G.your_collection[j].T.y, G.CARD_W, G.CARD_H, G.P_CARDS.empty, center)
      G.your_collection[j]:emplace(card)
    end
  end
  
  local t = create_UIBox_generic_options({ infotip = localize('ml_edition_seal_enhancement_explanation'), back_func = exit or 'your_collection', snap_back = true, contents = {
            {n=G.UIT.R, config={align = "cm", minw = 2.5, padding = 0.1, r = 0.1, colour = G.C.BLACK, emboss = 0.05}, nodes=deck_tables},
          }})
  return t
end

function create_UIBox_your_collection_editions()
  G.your_collection = {}
  G.your_collection[1] = CardArea(
    G.ROOM.T.x + 0.2*G.ROOM.T.w/2,G.ROOM.T.h,
    5.3*G.CARD_W,
    1.03*G.CARD_H, 
    {card_limit = 5, type = 'title', highlight_limit = 0, collection = true})
  local deck_tables = 
  {n=G.UIT.R, config={align = "cm", padding = 0, no_fill = true}, nodes={
    {n=G.UIT.O, config={object = G.your_collection[1]}}
  }}

  local editions = {'base', 'foil','holo','polychrome','negative'}

  for i = 1, 5 do
      local card = Card(G.your_collection[1].T.x + G.your_collection[1].T.w/2, G.your_collection[1].T.y, G.CARD_W, G.CARD_H, G.P_CARDS.empty, G.P_CENTERS['e_'..editions[i]])
      card:start_materialize()
      if G.P_CENTERS['e_'..editions[i]].discovered then card:set_edition({[editions[i]] = true}, true, true) end
      G.your_collection[1]:emplace(card)
  end

  INIT_COLLECTION_CARD_ALERTS()
  
  local t = create_UIBox_generic_options({ infotip = localize('ml_edition_seal_enhancement_explanation'), back_func = 'your_collection', snap_back = true, contents = {
            {n=G.UIT.R, config={align = "cm", minw = 2.5, padding = 0.1, r = 0.1, colour = G.C.BLACK, emboss = 0.05}, nodes={deck_tables}},
          }})
  return t
end

function create_UIBox_your_collection_decks()
  G.GAME.viewed_back = Back(G.P_CENTERS.b_red)
  
  local area = CardArea(
    G.ROOM.T.x + 0.2*G.ROOM.T.w/2,G.ROOM.T.h,
    1.2*G.CARD_W,
    1.2*G.CARD_H, 
    {card_limit = 52, type = 'deck', highlight_limit = 0})

  for i = 1, 52 do
    local card = Card(G.ROOM.T.x + 0.2*G.ROOM.T.w/2,G.ROOM.T.h, G.CARD_W*1.2, G.CARD_H*1.2, pseudorandom_element(G.P_CARDS), G.P_CENTERS.c_base, {playing_card = i, viewed_back = true})
    card.sprite_facing = 'back'
    card.facing = 'back'
    area:emplace(card)
    if i == 52 then G.sticker_card = card; card.sticker = get_deck_win_sticker(G.GAME.viewed_back.effect.center) end
  end

  local ordered_names = {}
  for k, v in ipairs(G.P_CENTER_POOLS.Back) do
    ordered_names[#ordered_names+1] = v.name
  end
  
  local t = create_UIBox_generic_options({ back_func = 'your_collection', contents = {
    create_option_cycle({options = ordered_names, opt_callback = 'change_viewed_back', current_option = 1, colour = G.C.RED, w = 4.5, focus_args = {snap_to = true}, mid = 
            {n=G.UIT.R, config={align = "cm", minw = 2.5, padding = 0.1, r = 0.1, colour = G.C.BLACK, emboss = 0.05}, nodes={
              {n=G.UIT.R, config={align = "cm", padding = 0.2, colour = G.C.BLACK, r = 0.2}, nodes={
                {n=G.UIT.C, config={align = "cm", padding = 0}, nodes={
                  {n=G.UIT.O, config={object = area}}
                }},
                {n=G.UIT.C, config={align = "tm", minw = 3.7, minh = 2.1, r = 0.1, colour = G.C.L_BLACK, padding = 0.1}, nodes={
                  {n=G.UIT.R, config={align = "cm", emboss = 0.1, r = 0.1, minw = 4, maxw = 4, minh = 0.6}, nodes={
                    {n=G.UIT.O, config={id = nil, func = 'RUN_SETUP_check_back_name', object = Moveable()}},
                  }},
                  {n=G.UIT.R, config={align = "cm", colour = G.C.WHITE, emboss = 0.1, minh = 2.2, r = 0.1}, nodes={
                    {n=G.UIT.O, config={id = G.GAME.viewed_back.name, func = 'RUN_SETUP_check_back', object = UIBox{definition = G.GAME.viewed_back:generate_UI(), config = {offset = {x=0,y=0}}}}}
                  }}       
                }},
              }},
            }}}),
          }})
  return t
end

function create_UIBox_your_collection_tags()
  local tag_matrix = {
    {},{},{},{},
  }
  local tag_tab = {}
  for k, v in pairs(G.P_TAGS) do
    tag_tab[#tag_tab+1] = v
  end

  table.sort(tag_tab, function (a, b) return a.order < b.order end)

  local tags_to_be_alerted = {}
  for k, v in ipairs(tag_tab) do
    local discovered = v.discovered
    local temp_tag = Tag(v.key, true)
    if not v.discovered then temp_tag.hide_ability = true end
    local temp_tag_ui, temp_tag_sprite = temp_tag:generate_UI()
    tag_matrix[math.ceil((k-1)/6+0.001)][1+((k-1)%6)] = {n=G.UIT.C, config={align = "cm", padding = 0.1}, nodes={
      temp_tag_ui,
    }}
    if discovered and not v.alerted then 
      tags_to_be_alerted[#tags_to_be_alerted+1] = temp_tag_sprite
    end
  end

  G.E_MANAGER:add_event(Event({
    trigger = 'immediate',
    func = (function()
        for _, v in ipairs(tags_to_be_alerted) do
          v.children.alert = UIBox{
            definition = create_UIBox_card_alert(), 
            config = { align="tri", offset = {x = 0.1, y = 0.1}, parent = v}
          }
          v.children.alert.states.collide.can = false
        end
        return true
    end)
  }))


  local t = create_UIBox_generic_options({ back_func = 'your_collection', contents = {
    {n=G.UIT.C, config={align = "cm", r = 0.1, colour = G.C.BLACK, padding = 0.1, emboss = 0.05}, nodes={
      {n=G.UIT.C, config={align = "cm"}, nodes={
        {n=G.UIT.R, config={align = "cm"}, nodes={
          {n=G.UIT.R, config={align = "cm"}, nodes=tag_matrix[1]},
          {n=G.UIT.R, config={align = "cm"}, nodes=tag_matrix[2]},
          {n=G.UIT.R, config={align = "cm"}, nodes=tag_matrix[3]},
          {n=G.UIT.R, config={align = "cm"}, nodes=tag_matrix[4]},
        }}
      }} 
    }}  
  }})
  return t
end

function create_UIBox_your_collection_blinds(exit)
  local blind_matrix = {
    {},{},{}, {}, {}, {}
  }
  local blind_tab = {}
  for k, v in pairs(G.P_BLINDS) do
    blind_tab[#blind_tab+1] = v
  end

  table.sort(blind_tab, function (a, b) return a.order < b.order end)

  local blinds_to_be_alerted = {}
  for k, v in ipairs(blind_tab) do
    local discovered = v.discovered
    local temp_blind = AnimatedSprite(0,0,1.3,1.3, G.ANIMATION_ATLAS['blind_chips'], discovered and v.pos or G.b_undiscovered.pos)
    temp_blind:define_draw_steps({
      {shader = 'dissolve', shadow_height = 0.05},
      {shader = 'dissolve'}
    })
    if k == 1 then 
      G.E_MANAGER:add_event(Event({
        trigger = 'immediate',
        func = (function()
          G.CONTROLLER:snap_to{node = temp_blind}
            return true
        end)
      }))
    end
    temp_blind.float = true
    temp_blind.states.hover.can = true
    temp_blind.states.drag.can = false
    temp_blind.states.collide.can = true
    temp_blind.config = {blind = v, force_focus = true}
    if discovered and not v.alerted then 
      blinds_to_be_alerted[#blinds_to_be_alerted+1] = temp_blind
    end
    temp_blind.hover = function()
      if not G.CONTROLLER.dragging.target or G.CONTROLLER.using_touch then 
          if not temp_blind.hovering and temp_blind.states.visible then
            temp_blind.hovering = true
            temp_blind.hover_tilt = 3
            temp_blind:juice_up(0.05, 0.02)
            play_sound('chips1', math.random()*0.1 + 0.55, 0.12)
            temp_blind.config.h_popup = create_UIBox_blind_popup(v, discovered)
            temp_blind.config.h_popup_config ={align = 'cl', offset = {x=-0.1,y=0},parent = temp_blind}
            Node.hover(temp_blind)
            if temp_blind.children.alert then 
              temp_blind.children.alert:remove()
              temp_blind.children.alert = nil
              temp_blind.config.blind.alerted = true
              G:save_progress()
            end
          end
      end
    temp_blind.stop_hover = function() temp_blind.hovering = false; Node.stop_hover(temp_blind); temp_blind.hover_tilt = 0 end
  end
    blind_matrix[math.ceil((k-1)/5+0.001)][1+((k-1)%5)] = {n=G.UIT.C, config={align = "cm", padding = 0.1}, nodes={
      (k==6 or k ==16 or k == 26) and {n=G.UIT.B, config={h=0.2,w=0.5}} or nil,
      {n=G.UIT.O, config={object = temp_blind, focus_with_object = true}},
      (k==5 or k ==15 or k == 25) and {n=G.UIT.B, config={h=0.2,w=0.5}} or nil,
    }}
  end

  G.E_MANAGER:add_event(Event({
    trigger = 'immediate',
    func = (function()
        for _, v in ipairs(blinds_to_be_alerted) do
          v.children.alert = UIBox{
            definition = create_UIBox_card_alert(), 
            config = { align="tri", offset = {x = 0.1, y = 0.1}, parent = v}
          }
          v.children.alert.states.collide.can = false
        end
        return true
    end)
  }))

  local ante_amounts = {}
  for i = 1, math.min(16, math.max(16, G.PROFILES[G.SETTINGS.profile].high_scores.furthest_ante.amt)) do 
    local spacing = 1 - math.min(20, math.max(15, G.PROFILES[G.SETTINGS.profile].high_scores.furthest_ante.amt))*0.06
    if spacing > 0 and i > 1 then 
      ante_amounts[#ante_amounts+1] = {n=G.UIT.R, config={minh = spacing}, nodes={}}
    end
    local blind_chip = Sprite(0,0,0.2,0.2,G.ASSET_ATLAS["ui_"..(G.SETTINGS.colourblind_option and 2 or 1)], {x=0, y=0})
      blind_chip.states.drag.can = false
      ante_amounts[#ante_amounts+1] = {n=G.UIT.R, config={align = "cm", padding = 0.03}, nodes={
        {n=G.UIT.C, config={align = "cm", minw = 0.7}, nodes={
          {n=G.UIT.T, config={text = i, scale = 0.4, colour = G.C.FILTER, shadow = true}},
        }},
        {n=G.UIT.C, config={align = "cr", minw = 2.8}, nodes={
          {n=G.UIT.O, config={object = blind_chip}},
          {n=G.UIT.C, config={align = "cm", minw = 0.03, minh = 0.01}, nodes={}},
          {n=G.UIT.T, config={text =number_format(get_blind_amount(i)), scale = 0.4, colour = i <= G.PROFILES[G.SETTINGS.profile].high_scores.furthest_ante.amt and G.C.RED or G.C.JOKER_GREY, shadow = true}},
        }}
      }}
  end
  
  local extras = nil
  local t = create_UIBox_generic_options({ back_func = exit or 'your_collection', contents = {
    {n=G.UIT.C, config={align = "cm", r = 0.1, colour = G.C.BLACK, padding = 0.1, emboss = 0.05}, nodes={
      {n=G.UIT.C, config={align = "cm", r = 0.1, colour = G.C.L_BLACK, padding = 0.1, force_focus = true, focus_args = {nav = 'tall'}}, nodes={
        {n=G.UIT.R, config={align = "cm", padding = 0.05}, nodes={
          {n=G.UIT.C, config={align = "cm", minw = 0.7}, nodes={
            {n=G.UIT.T, config={text = localize('k_ante_cap'), scale = 0.4, colour = lighten(G.C.FILTER, 0.2), shadow = true}},
          }},
          {n=G.UIT.C, config={align = "cr", minw = 2.8}, nodes={
            {n=G.UIT.T, config={text = localize('k_base_cap'), scale = 0.4, colour = lighten(G.C.RED, 0.2), shadow = true}},
          }}
        }},
        {n=G.UIT.R, config={align = "cm"}, nodes=ante_amounts}
    }},
    {n=G.UIT.C, config={align = "cm"}, nodes={
      {n=G.UIT.R, config={align = "cm"}, nodes={
        {n=G.UIT.R, config={align = "cm"}, nodes=blind_matrix[1]},
        {n=G.UIT.R, config={align = "cm"}, nodes=blind_matrix[2]},
        {n=G.UIT.R, config={align = "cm"}, nodes=blind_matrix[3]},
        {n=G.UIT.R, config={align = "cm"}, nodes=blind_matrix[4]},
        {n=G.UIT.R, config={align = "cm"}, nodes=blind_matrix[5]},
        {n=G.UIT.R, config={align = "cm"}, nodes=blind_matrix[6]},
      }}
    }} 
  }}  
  }})
  return t
end

function create_UIBox_blind_popup(blind, discovered, vars)
  local blind_text = {}
  
  local _dollars = blind.dollars
  local loc_target = localize{type = 'raw_descriptions', key = blind.key, set = 'Blind', vars = vars or blind.vars}
  local loc_name = localize{type = 'name_text', key = blind.key, set = 'Blind'}

  if discovered then 
    local ability_text = {}
    if loc_target then 
      for k, v in ipairs(loc_target) do
        ability_text[#ability_text + 1] = {n=G.UIT.R, config={align = "cm"}, nodes={{n=G.UIT.T, config={text = (k ==1 and blind.name == 'The Wheel' and '1' or '')..v, scale = 0.35, shadow = true, colour = G.C.WHITE}}}}
      end
    end
    local stake_sprite = get_stake_sprite(G.GAME.stake or 1, 0.4)
    blind_text[#blind_text + 1] =
      {n=G.UIT.R, config={align = "cm", emboss = 0.05, r = 0.1, minw = 2.5, padding = 0.07, colour = G.C.WHITE}, nodes={
        {n=G.UIT.R, config={align = "cm", maxw = 2.4}, nodes={
          {n=G.UIT.T, config={text = localize('ph_blind_score_at_least'), scale = 0.35, colour = G.C.UI.TEXT_DARK}},
        }},
        {n=G.UIT.R, config={align = "cm"}, nodes={
          {n=G.UIT.O, config={object = stake_sprite}},
          {n=G.UIT.T, config={text = blind.mult..localize('k_x_base'), scale = 0.4, colour = G.C.RED}},
        }},
        {n=G.UIT.R, config={align = "cm"}, nodes={
          {n=G.UIT.T, config={text = localize('ph_blind_reward'), scale = 0.35, colour = G.C.UI.TEXT_DARK}},
          {n=G.UIT.O, config={object = DynaText({string = {_dollars and string.rep(localize('$'),_dollars) or '-'}, colours = {G.C.MONEY}, rotate = true, bump = true, silent = true, scale = 0.45})}},
        }},
        ability_text[1] and {n=G.UIT.R, config={align = "cm", padding = 0.08, colour = mix_colours(blind.boss_colour, G.C.GREY, 0.4), r = 0.1, emboss = 0.05, minw = 2.5, minh = 0.9}, nodes=ability_text} or nil
      }}
  else
    blind_text[#blind_text + 1] =
      {n=G.UIT.R, config={align = "cm", emboss = 0.05, r = 0.1, minw = 2.5, padding = 0.1, colour = G.C.WHITE}, nodes={
        {n=G.UIT.R, config={align = "cm"}, nodes={
          {n=G.UIT.T, config={text = localize('ph_defeat_this_blind_1'), scale = 0.4, colour = G.C.UI.TEXT_DARK}},
        }},
        {n=G.UIT.R, config={align = "cm"}, nodes={
          {n=G.UIT.T, config={text = localize('ph_defeat_this_blind_2'), scale = 0.4, colour = G.C.UI.TEXT_DARK}},
        }},
      }}
  end
 return {n=G.UIT.ROOT, config={align = "cm", padding = 0.05, colour = lighten(G.C.JOKER_GREY, 0.5), r = 0.1, emboss = 0.05}, nodes={
  {n=G.UIT.R, config={align = "cm", emboss = 0.05, r = 0.1, minw = 2.5, padding = 0.1, colour = not discovered and G.C.JOKER_GREY or blind.boss_colour or G.C.GREY}, nodes={
    {n=G.UIT.O, config={object = DynaText({string = discovered and loc_name or localize('k_not_discovered'), colours = {G.C.UI.TEXT_LIGHT}, shadow = true, rotate = not discovered, spacing = discovered and 2 or 0, bump = true, scale = 0.4})}},
  }},
  {n=G.UIT.R, config={align = "cm"}, nodes=blind_text},
 }}
end 


function create_UIBox_card_unlock(card_center)
  G.your_collection = CardArea(
    G.ROOM.T.x + G.ROOM.T.w/2,G.ROOM.T.h,
    1*G.CARD_W,
    1*G.CARD_H, 
    {card_limit = 2, type = 'consumeable', highlight_limit = 0})
  
  local card = Card(G.your_collection.T.x + G.your_collection.T.w/2 - G.CARD_W/2, G.your_collection.T.y, G.CARD_W, G.CARD_H, G.P_CARDS.empty, card_center, {bypass_discovery_center = true, bypass_discovery_ui = true})
  local locked_card = Card(G.your_collection.T.x + G.your_collection.T.w/2 - G.CARD_W/2, G.your_collection.T.y, G.CARD_W, G.CARD_H, G.P_CARDS.empty, card_center.set == 'Voucher' and G.v_locked or G.j_locked)
  locked_card:remove_UI()
  locked_card.ID = card.ID
  card.states.click.can = false
  locked_card.states.click.can = false
  card.states.visible = false
  card.no_ui = true

  G.E_MANAGER:add_event(Event({timer = 'REAL',blockable = false,blocking = false,
    func = (function() G.OVERLAY_MENU.joker_unlock_table = card.ID return true end) }))
  G.E_MANAGER:add_event(Event({timer = 'REAL',blockable = false,blocking = false, trigger = 'after', delay = 0.6,
    func = (function() if G.OVERLAY_MENU and G.OVERLAY_MENU.joker_unlock_table == card.ID then locked_card:juice_up(0.3, 0.2); play_sound('cancel', 0.8) end; return true end) }))
  G.E_MANAGER:add_event(Event({timer = 'REAL',blockable = false,blocking = false, trigger = 'after', delay = 1.15,
    func = (function() if G.OVERLAY_MENU and G.OVERLAY_MENU.joker_unlock_table == card.ID then locked_card:juice_up(0.45, 0.3); play_sound('cancel', 0.92) end; return true end) }))
  G.E_MANAGER:add_event(Event({timer = 'REAL',blockable = false,blocking = false, trigger = 'after', delay = 1.8,
    func = (function() if G.OVERLAY_MENU and G.OVERLAY_MENU.joker_unlock_table == card.ID then locked_card:juice_up(0.6, 0.4); play_sound('cancel', 1.03) end; return true end) }))

  G.E_MANAGER:add_event(Event({
    timer = 'REAL',
    blockable = false,
    blocking = false,
    trigger = 'after', 
    delay = 2.3,
    func = (function() 
      if G.OVERLAY_MENU and G.OVERLAY_MENU.joker_unlock_table == card.ID then locked_card:start_dissolve({G.C.BLACK}) end
      return true end)
  }))
  G.E_MANAGER:add_event(Event({
    timer = 'REAL',
    blockable = false,
    blocking = false,
    trigger = 'after', 
    delay = 2.7,
    func = (function() 
      if G.OVERLAY_MENU and G.OVERLAY_MENU.joker_unlock_table == card.ID then 
        card:start_materialize({G.C.BLUE}, true)
        play_sound('crumple1', 0.8, 1);
      end
      return true end)
  }))
  G.E_MANAGER:add_event(Event({timer = 'REAL',blockable = false,blocking = false, trigger = 'after', delay = 2.78,
  func = (function() if G.OVERLAY_MENU and G.OVERLAY_MENU.joker_unlock_table == card.ID then card.no_ui = nil; play_sound('timpani', 0.8, 1.8) end return true end) }))
  G.E_MANAGER:add_event(Event({timer = 'REAL',blockable = false,blocking = false, trigger = 'after', delay = 2.95,
  func = (function() if G.OVERLAY_MENU and G.OVERLAY_MENU.joker_unlock_table == card.ID then play_sound('timpani', 1, 1.8)  end return true end) }))
  
  G.your_collection:emplace(card)
  G.your_collection:emplace(locked_card)

  local t = create_UIBox_generic_options({padding = 0,back_label = localize('b_continue'), no_pip = true, snap_back = true, back_func = 'continue_unlock', minw = 4.5, contents = {
      {n=G.UIT.R, config={align = "cm", padding = 0}, nodes={
        {n=G.UIT.R, config={align = "cm", padding = 0.1}, nodes={
          {n=G.UIT.R, config={align = "cm", padding = 0.1}, nodes={
            {n=G.UIT.R, config={align = "cm", padding = 0}, nodes={
              {n=G.UIT.O, config={object = DynaText({string = {card_center.set == 'Voucher' and localize('k_voucher') or localize('k_joker')}, colours = {G.C.BLUE},shadow = true, rotate = true, bump = true, pop_in = 0.3, pop_in_rate = 2, scale = 1.2})}}
            }},
            {n=G.UIT.R, config={align = "cm", padding = 0}, nodes={
              {n=G.UIT.O, config={object = DynaText({string = {localize('k_unlocked_ex')}, colours = {G.C.RED},shadow = true, rotate = true, bump = true, pop_in = 0.6, pop_in_rate = 2, scale = 0.8})}}
            }},
          }},
          {n=G.UIT.R, config={align = "cm", padding = 0, draw_layer = 1}, nodes={
            {n=G.UIT.O, config={object = G.your_collection}}
          }},
          {n=G.UIT.R, config={align = "cm", padding = 0.2}, nodes={
            {n=G.UIT.R, config={align = "cm", padding = 0.05, emboss = 0.05, colour = G.C.WHITE, r = 0.1}, nodes={
              desc_from_rows(card:generate_UIBox_unlock_table(true).main)
            }}
          }}
        }}
      }}
    }})
  return t
end

function create_UIBox_deck_unlock(deck_center)
  G.GAME.viewed_back = Back(deck_center)
  local area = CardArea(
    G.ROOM.T.x + 0.2*G.ROOM.T.w/2,G.ROOM.T.h,
    1.2*G.CARD_W,
    1.2*G.CARD_H, 
    {card_limit = 52, type = 'deck', highlight_limit = 0})

  for i = 1, 52 do
    local card = Card(G.ROOM.T.x + 0.2*G.ROOM.T.w/2,G.ROOM.T.h, G.CARD_W*1.2, G.CARD_H*1.2, pseudorandom_element(G.P_CARDS), G.P_CENTERS.c_base, {bypass_back = deck_center.pos, playing_card = i, viewed_back = true})
    area:emplace(card)
    card[deck_center.key] = true
    card.sprite_facing = 'back'
    card.facing = 'back'
  end
  local deck_criteria = {}
  if deck_center.unlock_condition.type == 'win_deck' then
    local other_name = localize{type = 'name_text', set = 'Back', key = deck_center.unlock_condition.deck}
    localize{type = 'descriptions', key = 'deck_locked_win', set = "Other", nodes = deck_criteria, vars = {other_name}, default_col = G.C.WHITE, shadow = true}
  elseif deck_center.unlock_condition.type == 'win_stake' then
    local other_name = localize{type = 'name_text', set = 'Stake', key = G.P_CENTER_POOLS.Stake[deck_center.unlock_condition.stake].key}
    localize{type = 'descriptions', key = 'deck_locked_stake', set = "Other", nodes = deck_criteria, vars = {other_name, colours = {get_stake_col(deck_center.unlock_condition.stake)}}, default_col = G.C.WHITE, shadow = true}
  elseif deck_center.unlock_condition.type == 'discover_amount' then 
    localize{type = 'descriptions', key = 'deck_locked_discover', set = "Other", nodes = deck_criteria, vars = {deck_center.unlock_condition.amount}, default_col = G.C.WHITE, shadow = true}
  end

  local deck_criteria_cols = {}
  for k, v in ipairs(deck_criteria) do
    if k > 1 then deck_criteria_cols[#deck_criteria_cols+1] = {n=G.UIT.C, config={align = "cm", padding = 0, minw = 0.1}, nodes={}} end
    deck_criteria_cols[#deck_criteria_cols+1] = {n=G.UIT.C, config={align = "cm", padding = 0}, nodes=v}
  end

  local t = create_UIBox_generic_options({ back_label = localize('b_continue'), no_pip = true, snap_back = true, back_func = 'continue_unlock', minw = 7, contents = {
    {n=G.UIT.R, config={align = "cm", padding = 0}, nodes={
      {n=G.UIT.O, config={object = DynaText({string = {{string = localize{type = 'name_text', set = 'Back', key = deck_center.key}, suffix = ' '..localize('k_unlocked_ex'), outer_colour = G.C.UI.TEXT_LIGHT}}, colours = {G.C.BLUE},shadow = true, rotate = true, float = true, scale = 0.7, pop_in = 0.1})}}
    }},
    {n=G.UIT.R, config={align = "cm", padding = 0}, nodes=deck_criteria_cols},
    {n=G.UIT.R, config={align = "cm", padding = 0.2, colour = G.C.BLACK, r = 0.2}, nodes={
        {n=G.UIT.C, config={align = "cm", padding = 0}, nodes={
          {n=G.UIT.O, config={object = area}}
        }},
        {n=G.UIT.C, config={align = "cm", r = 0.2, colour = G.C.WHITE, emboss = 0.05, padding = 0.2, minw = 4}, nodes={
          {n=G.UIT.R, config={align = "cm", padding = 0}, nodes=G.GAME.viewed_back:generate_UI(deck_center).nodes}
        }}
      }}
  }})
  return t
end

function G.UIDEF.multiline_credit_text(_lines)
  local t = {}
  for k, v in ipairs(_lines) do
    t[#t+1] = {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
      {n=G.UIT.T, config={text = v, scale = 0.28, colour = G.C.WHITE}},
    }}
  end

  return t
end

function G.UIDEF.viewed_collab_option(_new_option)
  G.viewed_collab = G.viewed_collab or 'The Binding of Isaac'

  local curr_collab = G.collab_credits[G.viewed_collab] or G.collab_credits['The Binding of Isaac']
  local collab_sprite = Sprite(0,0,0.8*G.CARD_W,0.8*G.CARD_H,G.ASSET_ATLAS[curr_collab.art..'_1'], {x=2,y=0})

  return  {n=G.UIT.ROOT, config={align = "cm", colour = G.C.BLACK, r = 0.1}, nodes={
    {n=G.UIT.R, config={align = "cm", padding = 0.1}, nodes={
      {n=G.UIT.T, config={text = G.viewed_collab, scale = 0.5, colour = G.C.WHITE}}
    }},
    {n=G.UIT.R, config={align = "cm", padding = 0}, nodes={
      {n=G.UIT.C, config={align = "cm", padding = 0.1, minw = 9, minh = 4.2}, nodes={
        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes=G.UIDEF.multiline_credit_text({
          'All rights reserved. No part of this work may be',
          'reproduced in any form or by any means— graphic,',
          'electronic, or mechanical, including recording,',
          'online distribution, or information storage and retrieval',
          'systems—without the written permission of the publisher',
          'or the designated rightsholder, as applicable.'
        })},
        curr_collab.ml_text and {n=G.UIT.R, config={align = "cl", padding = 0}, nodes=G.UIDEF.multiline_credit_text(curr_collab.ml_text)} or nil,
      }},
      {n=G.UIT.C, config={align = "cm", padding = 0.1, minw = 3, minh = 4.2}, nodes={
        {n=G.UIT.R, config={align = "cm", padding = 0.0}, nodes={
          {n=G.UIT.R, config={align = "cm", colour = G.C.WHITE, r = 0.3}, nodes={
            {n=G.UIT.O, config={colour = G.C.BLUE, object = collab_sprite, hover = true, can_collide = false}},
          }},
        }},
        curr_collab.artist and {n=G.UIT.R, config={align = "cm", padding = 0.07, r = 0.1, outline = 0.7, outline_colour = G.C.WHITE}, nodes={
          {n=G.UIT.R, config={align = "cm", padding = 0}, nodes={
            {n=G.UIT.T, config={text = "Art created by:", scale = 0.3, colour = G.C.WHITE}},
          }},
          {n=G.UIT.R, config={align = "cm", padding = 0}, nodes={
            {n=G.UIT.T, config={text = curr_collab.artist, scale = 0.3, colour = G.C.GOLD}}
          }},
          curr_collab.artist_link and {n=G.UIT.R, config={align = "cm", padding = 0}, nodes={
            {n=G.UIT.T, config={text = curr_collab.artist_link, scale = 0.3, colour = G.C.BLUE}}
          }} or nil
        }} or nil
      }}
    }}
  }}
end

function G.UIDEF.credits()
  local text_scale = 0.75
  local t =   create_UIBox_generic_options({contents ={
      {n=G.UIT.R, config={align = "cm", padding = 0}, nodes={
        create_tabs(
        {tabs = {
            {
              label = "Production",
              chosen = true,
              tab_definition_function = function() return 
                {n=G.UIT.ROOT, config={align = "cm", padding = 0.2, colour = G.C.BLACK, r = 0.1, emboss = 0.05, minh = 6, minw = 10}, nodes={
                      {n=G.UIT.C, config={align = "cm", padding = 0.2,outline_colour = G.C.JOKER_GREY, r = 0.1, outline = 1}, nodes={
                      {n=G.UIT.R, config={align = "cm", padding = 0}, nodes={
                        {n=G.UIT.T, config={text = "Original Soundtrack", scale = text_scale*0.8, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                      }},
                      {n=G.UIT.R, config={align = "cm", padding = 0}, nodes={
                        {n=G.UIT.T, config={text = "composed by ", scale = text_scale*0.8, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                        {n=G.UIT.T, config={text = "LouisF", scale = text_scale*0.8, colour = G.C.BLUE, shadow = true}}
                      }},
                      G.F_EXTERNAL_LINKS and {n=G.UIT.R, config={align = "cm", padding = 0}, nodes={
                        UIBox_button({label = {'Instagram'}, button = 'louisf_insta'})
                      }} or nil,
                      {n=G.UIT.R, config={align = "cm", padding = 0.2}, nodes={
                        {n=G.UIT.T, config={text = "Modified with their permission", scale = text_scale*0.5, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                      }},
                    }},
                    {n=G.UIT.C, config={align = "tm", padding = 0.1,outline_colour = G.C.JOKER_GREY, r = 0.1, outline = 1}, nodes={
                      {n=G.UIT.R, config={align = "cm", padding = 0}, nodes={
                        {n=G.UIT.T, config={text = "Porting", scale = text_scale*0.6, colour = G.C.WHITE, shadow = true}},
                      }},
                      {n=G.UIT.R, config={align = "cm", padding = 0}, nodes={
                        {n=G.UIT.T, config={text = "PlayStation", scale = text_scale*0.45, colour = G.C.GOLD, shadow = true}},
                      }},
                      {n=G.UIT.R, config={align = "tm", padding = 0}, nodes={
                        {n=G.UIT.C, config={align = "tl", padding = 0.03}, nodes={
                          {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                            {n=G.UIT.T, config={text = 'Maarten De Meyer', scale = text_scale*0.35, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                          }},
                        }},
                      }},
                      {n=G.UIT.R, config={align = "cm", padding = 0}, nodes={
                        {n=G.UIT.T, config={text = "Xbox", scale = text_scale*0.45, colour = G.C.GOLD, shadow = true}},
                      }},
                      {n=G.UIT.R, config={align = "tm", padding = 0}, nodes={
                        {n=G.UIT.C, config={align = "tl", padding = 0.03}, nodes={
                          {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                            {n=G.UIT.T, config={text = 'Maarten De Meyer', scale = text_scale*0.35, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                          }},
                        }},
                      }},
                      {n=G.UIT.R, config={align = "cm", padding = 0}, nodes={
                        {n=G.UIT.T, config={text = "Android", scale = text_scale*0.45, colour = G.C.GOLD, shadow = true}},
                      }},
                      {n=G.UIT.R, config={align = "tm", padding = 0}, nodes={
                        {n=G.UIT.C, config={align = "tl", padding = 0.03}, nodes={
                          {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                            {n=G.UIT.T, config={text = 'Maarten De Meyer', scale = text_scale*0.35, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                          }},
                        }},
                      }},
                      {n=G.UIT.R, config={align = "cm", padding = 0}, nodes={
                        {n=G.UIT.T, config={text = "Apple Platforms", scale = text_scale*0.45, colour = G.C.GOLD, shadow = true}},
                      }},
                      {n=G.UIT.R, config={align = "tm", padding = 0}, nodes={
                        {n=G.UIT.C, config={align = "tl", padding = 0.03}, nodes={
                          {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                            {n=G.UIT.T, config={text = 'Maarten De Meyer', scale = text_scale*0.35, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                          }},
                        }},
                      }},
                      {n=G.UIT.R, config={align = "cm", padding = 0}, nodes={
                        {n=G.UIT.T, config={text = "Mac (Steam)", scale = text_scale*0.45, colour = G.C.GOLD, shadow = true}},
                      }},
                      {n=G.UIT.R, config={align = "tm", padding = 0}, nodes={
                        {n=G.UIT.C, config={align = "tl", padding = 0.03}, nodes={
                          {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                            {n=G.UIT.T, config={text = 'william341', scale = text_scale*0.35, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                          }},
                        }},
                      }},
                    }},
                  {n=G.UIT.C, config={align = "cm", padding = 0.1,outline_colour = G.C.JOKER_GREY, r = 0.1, outline = 1}, nodes={
                    {n=G.UIT.R, config={align = "cm", padding = 0}, nodes={
                      {n=G.UIT.T, config={text = "Localization", scale = text_scale*0.6, colour = G.C.WHITE, shadow = true}},
                    }},
                    {n=G.UIT.R, config={align = "cm", padding = 0}, nodes={
                      {n=G.UIT.T, config={text = "Universally Speaking", scale = text_scale*0.6, colour = G.C.FILTER, shadow = true}},
                    }},
                    {n=G.UIT.R, config={align = "tm", padding = 0}, nodes={
                      {n=G.UIT.C, config={align = "tl", padding = 0.05}, nodes={
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'German', scale = text_scale*0.35, colour = G.C.FILTER, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Spanish Latam', scale = text_scale*0.35, colour = G.C.FILTER, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'French', scale = text_scale*0.35, colour = G.C.FILTER, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Indonesian', scale = text_scale*0.35, colour = G.C.FILTER, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Italian', scale = text_scale*0.35, colour = G.C.FILTER, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Japanese', scale = text_scale*0.35, colour = G.C.FILTER, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Korean', scale = text_scale*0.35, colour = G.C.FILTER, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Dutch', scale = text_scale*0.35, colour = G.C.FILTER, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Polish', scale = text_scale*0.35, colour = G.C.FILTER, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Portuguese Brasilian', scale = text_scale*0.35, colour = G.C.FILTER, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Russian', scale = text_scale*0.35, colour = G.C.FILTER, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Simplified Chinese', scale = text_scale*0.35, colour = G.C.FILTER, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Traditional Chinese', scale = text_scale*0.35, colour = G.C.FILTER, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Project managers', scale = text_scale*0.35, colour = G.C.FILTER, shadow = true}},
                        }},
                      }},
                      {n=G.UIT.C, config={align = "tl", padding = 0.05}, nodes={
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Dominik May, Lisa-Marie Beck', scale = text_scale*0.35, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Román René Orozco, Javier Gómez', scale = text_scale*0.35, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Romain Vervaecke, Claire Gérard', scale = text_scale*0.35, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Yopi Jalu Paksi, Sutarto Mohammad', scale = text_scale*0.35, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Oliver Cozzio, Giulia Benassi', scale = text_scale*0.35, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Takashi Fujimoto, Ai Parlow', scale = text_scale*0.35, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Haejung Lee, Sanghyun Bae', scale = text_scale*0.35, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Ellis Jongsma, Erik Nusselder', scale = text_scale*0.35, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Mariusz Wlodarczyk, Bartosz Klofik', scale = text_scale*0.35, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Samuel Modesto, R. Cali', scale = text_scale*0.35, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Yuliia Tatsenko, Natalia Rudane', scale = text_scale*0.35, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Shuai Fang, Liqi Ye', scale = text_scale*0.35, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Pauline Lin, AngelRabbitBB', scale = text_scale*0.35, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Ruoyang Yuan, Tania Carè', scale = text_scale*0.35, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                        }},
                      }},
                    }},
                  }},
                    {n=G.UIT.C, config={align = "tm", padding = 0.1,outline_colour = G.C.JOKER_GREY, r = 0.1, outline = 1}, nodes={
                      {n=G.UIT.R, config={align = "cm", padding = 0}, nodes={
                        {n=G.UIT.T, config={text = "Testing/QA", scale = text_scale*0.6, colour = G.C.WHITE, shadow = true}},
                      }},
                      {n=G.UIT.R, config={align = "tm", padding = 0}, nodes={
                        {n=G.UIT.C, config={align = "tl", padding = 0.03}, nodes={
                          {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                            {n=G.UIT.T, config={text = 'Vishwak Kondapalli', scale = text_scale*0.35, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                          }},
                          {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                            {n=G.UIT.T, config={text = 'Basha Syed', scale = text_scale*0.35, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                          }},
                          {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                            {n=G.UIT.T, config={text = 'CampfireCollective', scale = text_scale*0.35, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                          }},
                          {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                            {n=G.UIT.T, config={text = 'drspectred', scale = text_scale*0.35, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                          }},
                          {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                            {n=G.UIT.T, config={text = 'TheRealEvab', scale = text_scale*0.35, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                          }},
                          {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                            {n=G.UIT.T, config={text = 'Brightqwerty', scale = text_scale*0.35, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                          }},
                          {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                            {n=G.UIT.T, config={text = 'MrWizzrd', scale = text_scale*0.35, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                          }},
                          {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                            {n=G.UIT.T, config={text = 'mcpower', scale = text_scale*0.35, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                          }},
                        }},
                      
                  }},
                  }},
                  
                }}
              end,
            },
            {
              label = "Publishing",
              tab_definition_function = function() return 
                {n=G.UIT.ROOT, config={align = "cm", padding = 0.2, colour = G.C.BLACK, r = 0.1, emboss = 0.05, minh = 6, minw = 10}, nodes={
                  {n=G.UIT.C, config={align = "cm", padding = 0.1,outline_colour = G.C.JOKER_GREY, r = 0.1, outline = 1}, nodes={
                    {n=G.UIT.R, config={align = "cm", padding = 0}, nodes={
                      {n=G.UIT.T, config={text = "Playstack", scale = text_scale*0.6, colour = G.C.RED, shadow = true}},
                    }},
                    {n=G.UIT.R, config={align = "tm", padding = 0}, nodes={
                      {n=G.UIT.C, config={align = "tl", padding = 0.05}, nodes={
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Harvey Elliott', scale = text_scale*0.42, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Kevin Shrapnell', scale = text_scale*0.42, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Rob Crossley', scale = text_scale*0.42, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Liz Cheng-Moore', scale = text_scale*0.42, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Will Newell', scale = text_scale*0.42, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Charlotte Riley', scale = text_scale*0.42, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Alexander Saunders', scale = text_scale*0.42, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Naman Budhwar', scale = text_scale*0.42, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Tomasz Wisniowski', scale = text_scale*0.42, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Patrick Johnson', scale = text_scale*0.42, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Tom Verney', scale = text_scale*0.42, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Wouter van Halderen', scale = text_scale*0.42, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Shawn Cotter', scale = text_scale*0.42, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                        }},
                      }},
                      {n=G.UIT.C, config={align = "tl", padding = 0.093}, nodes={
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'CEO', scale = text_scale*0.35, colour = G.C.GOLD, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'COO', scale = text_scale*0.35, colour = G.C.GOLD, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'VP of Publishing', scale = text_scale*0.35, colour = G.C.GOLD, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Lead Marketing Manager', scale = text_scale*0.35, colour = G.C.GOLD, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Producer', scale = text_scale*0.35, colour = G.C.GOLD, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Producer', scale = text_scale*0.35, colour = G.C.GOLD, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Producer', scale = text_scale*0.35, colour = G.C.GOLD, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Lead Visual Marketing Manager', scale = text_scale*0.35, colour = G.C.GOLD, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Producer', scale = text_scale*0.35, colour = G.C.GOLD, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Senior Discovery Scout', scale = text_scale*0.35, colour = G.C.GOLD, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Discovery Scout', scale = text_scale*0.35, colour = G.C.GOLD, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'PR Manager', scale = text_scale*0.35, colour = G.C.GOLD, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Marketing Manager', scale = text_scale*0.35, colour = G.C.GOLD, shadow = true}},
                        }},
                      }},
                      {n=G.UIT.B, config={align = "tl", w=0.25, h=0}, nodes={}},
                      {n=G.UIT.C, config={align = "tl", padding = 0.05}, nodes={
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Marta Matyjewicz', scale = text_scale*0.42, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Rebecca Bell', scale = text_scale*0.42, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Alex Flynn', scale = text_scale*0.42, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Justas Pugaciauskas', scale = text_scale*0.42, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Jessica Chu', scale = text_scale*0.42, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Millicent Su', scale = text_scale*0.42, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Carla Malavasi', scale = text_scale*0.42, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Pawel Kwietniak', scale = text_scale*0.42, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Ela Müller', scale = text_scale*0.42, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Edgar Khoo', scale = text_scale*0.42, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Dami Ajiboye', scale = text_scale*0.42, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Aaron Ludlow', scale = text_scale*0.42, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Jenny Quintero', scale = text_scale*0.42, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                        }},
                      }},
                      {n=G.UIT.C, config={align = "tl", padding = 0.093}, nodes={
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Marketing Manager', scale = text_scale*0.35, colour = G.C.GOLD, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Finance', scale = text_scale*0.35, colour = G.C.GOLD, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Creative Director', scale = text_scale*0.35, colour = G.C.GOLD, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Graphic Designer', scale = text_scale*0.35, colour = G.C.GOLD, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Lead Video Artist', scale = text_scale*0.35, colour = G.C.GOLD, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Senior User Acquisition Manager', scale = text_scale*0.35, colour = G.C.GOLD, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Director of Publishing Services', scale = text_scale*0.35, colour = G.C.GOLD, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Front-end Developer', scale = text_scale*0.35, colour = G.C.GOLD, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Graphic Designer', scale = text_scale*0.35, colour = G.C.GOLD, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Video Editor', scale = text_scale*0.35, colour = G.C.GOLD, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Data Analyst', scale = text_scale*0.35, colour = G.C.GOLD, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Product Director', scale = text_scale*0.35, colour = G.C.GOLD, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Senior Partnerships Manager', scale = text_scale*0.35, colour = G.C.GOLD, shadow = true}},
                        }},
                      }},
                      {n=G.UIT.B, config={align = "tl", w=0.25, h=0}, nodes={}},
                      {n=G.UIT.C, config={align = "tl", padding = 0.05}, nodes={
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Stephanie Marti', scale = text_scale*0.42, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Emma Smith-Bodie', scale = text_scale*0.42, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Moe Abrams', scale = text_scale*0.42, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Piotr Kowalik', scale = text_scale*0.42, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Carmen Martino', scale = text_scale*0.42, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Rong Lin', scale = text_scale*0.42, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Bea Gomez', scale = text_scale*0.42, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Jose Olivares', scale = text_scale*0.42, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Joanna Kieronska', scale = text_scale*0.42, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Zuzanna Dawidowska', scale = text_scale*0.42, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Jean-Claude Vidanes ', scale = text_scale*0.42, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'AJ Purnell', scale = text_scale*0.42, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                        }},
                      }},
                      {n=G.UIT.C, config={align = "tl", padding = 0.093}, nodes={
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Senior Video Artist', scale = text_scale*0.35, colour = G.C.GOLD, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Community Manager', scale = text_scale*0.35, colour = G.C.GOLD, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Customer Support', scale = text_scale*0.35, colour = G.C.GOLD, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Software Engineer', scale = text_scale*0.35, colour = G.C.GOLD, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'HR & Office Manager', scale = text_scale*0.35, colour = G.C.GOLD, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Finance Manager', scale = text_scale*0.35, colour = G.C.GOLD, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Video Editor', scale = text_scale*0.35, colour = G.C.GOLD, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'QA & Localisation Manager', scale = text_scale*0.35, colour = G.C.GOLD, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'QA Tester', scale = text_scale*0.35, colour = G.C.GOLD, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'QA Tester', scale = text_scale*0.35, colour = G.C.GOLD, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'QA Tester', scale = text_scale*0.35, colour = G.C.GOLD, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'QA Tester', scale = text_scale*0.35, colour = G.C.GOLD, shadow = true}},
                        }},
                      }},
                    }},
                  }}
                }}
              end,
            },
            {
              label = "Collabs",
              tab_definition_function = function()
                G.collab_credits = G.collab_credits or {

                  ['Vault-Tec'] = {
                    artist = 'Franek',
                    ml_text = {
                      '© 2025 ZeniMax.  ZeniMax and Bethesda Game Studios',
                      'are trademarks of the ZeniMax group of companies. ',
                      'All rights reserved.',
                    },
                    art = 'collab_FO'
                  },
                  ['The Witcher'] = {
                    artist = nil,
                    ml_text = {
                      '© 2024 CD PROJEKT S.A. All rights reserved. CD PROJEKT,',
                      'the CD PROJEKT logo, The Witcher and The Witcher Logo,',
                      'Geralt, Geralt of Rivia and Yennefer are trademarks and/or',
                      'registered trademarks of CD PROJEKT S.A. in the US and/or',
                      'other countries. The Witcher game is set in the universe',
                      'created by Andrzej Sapkowski in his series of books.'
                    },
                    art = 'collab_TW'
                  },
                  ['Cyberpunk 2077'] = {
                    artist = nil,
                    ml_text = {
                      'Cyberpunk 2077 © 2024 CD PROJEKT S.A. All rights reserved.'
                    },
                    art = 'collab_CYP'
                  },
                  ['Shovel Knight'] = {
                    artist = 'Neato',
                    artist_link = 'twitch.tv/neato',
                    ml_text = {
                      'Shovel Knight © 2024 Yacht Club Games, LLC. All Rights Reserved.'
                    },
                    art = 'collab_SK'
                  },
                  ['Don\'t Starve'] = {
                    artist = nil,
                    ml_text = {
                      '“KLEI” “DON\'T STARVE” © 2024 All Rights Reserved',
                      'Klei Entertainment 2024'
                    },
                    art = 'collab_DS'
                  },
                  ['Assassin\'s Creed'] = {
                    artist = 'Franek',
                    ml_text = {
                      'Assassin\'s Creed © 2025 Ubisoft Entertainment.',
                      'All Rights Reserved.'
                    },
                    art = 'collab_AC'
                  },
                  ['Slay the Princess'] = {
                    artist = 'Franek',
                    ml_text = {
                      'Slay the Princess (c) 2025 Black Tabby Games. All Rights Reserved.',
                      '"SLAY THE PRINCESS" - Canadian Trademark App: 2351515',
                      'SLAY THE PRINCESS LOGO - Canadian Trademark App: 2351516',
                      '"BLACK TABBY GAMES" - Canadian Trademark App: 2351514'
                    },
                    art = 'collab_STP'
                  },
                  ['Among Us'] = {
                    artist = nil,
                    ml_text = {
                      'Among Us © 2024 Innersloth LLC. All Rights Reserved.'
                    },
                    art = 'collab_AU'
                  },
                  ['The Binding of Isaac'] = {
                    artist = 'Neato',
                    artist_link = 'twitch.tv/neato',
                    ml_text = {
                      'The Binding of Isaac is copyright McMillen Games, Inc.',
                      'All Rights Reserved'
                    },
                    art = 'collab_TBoI'
                  },
                  ['Cult of the Lamb'] = {
                    artist = nil,
                    ml_text = {
                      'Cult of the Lamb © 2024 Massive Monster All Rights Reserved'
                    },
                    art = 'collab_CL'
                  },
                  ['Divinity Original Sin 2'] = {
                    artist = nil,
                    ml_text = {
                      '©2024 Larian Studios. Larian Studios, Divinity, Divinity: Original Sin',
                      'and the Larian Studios logo are registered trademarks of Larian Studios',
                      'Games Limited affiliates. All rights reserved.'
                    },
                    art = 'collab_D2'
                  },
                  ['Critical Role'] = {
                    artist = 'Grace Berrios',
                    artist_link = '@lassflores',
                    ml_text = {
                      '2025 © Gilmore’s Glorious Goods LLC. All Rights Reserved.',
                      'Critical Role, Vox Machina, Mighty Nein, Bells Hells, character names,',
                      'associated logos and images are all trademarks of Critical Role LLC."'
                    },
                    art = 'collab_CR'
                  },
                  ['Bugsnax'] = {
                    artist = 'Neato',
                    artist_link = 'twitch.tv/neato',
                    ml_text = {
                      '© 2025 Bugsnax © Young Horses Inc. All Rights Reserved.'
                    },
                    art = 'collab_BUG'
                  },
                  ['Vampire Survivors'] = {
                    artist = nil,
                    ml_text = nil,
                    art = 'collab_VS'
                  },
                  ['Slay the Spire'] = {
                    artist = 'Neato',
                    artist_link = 'twitch.tv/neato',
                    ml_text = {
                      'Slay the Spire ©2024 Mega Crit Games, LLC. All Rights Reserved.'
                    },
                    art = 'collab_STS'
                  },
                  ['Potion Craft'] = {
                    artist = nil,
                    ml_text = {
                      'Potion Craft © 2024 tinyBuild, LLC. All Rights Reserved.'
                    },
                    art = 'collab_PC'
                  },
                  ['Warframe'] = {
                    artist = nil,
                    ml_text = {
                      'Warframe ©2024 Digital Extremes Ltd. All rights reserved. Warframe',
                      'and the Warframe logo are registered trademarks of Digital Extremes Ltd.'
                    },
                    art = 'collab_WF'
                  },
                  ['Dead By Daylight'] = {
                    artist = nil,
                    ml_text = {
                      '© 2015-2025 and BEHAVIOUR, DEAD BY DAYLIGHT and other related trademarks',
                      'and logos belong to Behaviour Interactive Inc. All rights reserved.'
                    },
                    art = 'collab_DBD'
                  },
                  ['Dave the Diver'] = {
                    artist = nil,
                    ml_text = {
                      'Dave the Diver © Mintrocket. All Rights Reserved.'
                    },
                    art = 'collab_DTD'
                  },
                  ['Stardew Valley'] = {
                    artist = 'ConcernedApe',
                    ml_text = {
                      '"Stardew Valley" is a trademark of ConcernedApe LLC. All Rights Reserved'
                    },
                    art = 'collab_SV'
                  },
                  ['Enter the Gungeon'] = {
                    artist = nil,
                    ml_text = {
                      'Enter the Gungeon © 2024 Devolver Digital Inc.All Rights Reserved.'
                    },
                    art = 'collab_EG'
                  },
                  ['1000xRESIST'] = {
                    artist = nil,
                    ml_text = nil,
                    art = 'collab_XR'
                  },
                  ['Civilization VII'] = {
                    artist = nil,
                    ml_text = {
                      'CIVILIZATION Licensed Assets Courtesy of 2K Games, Inc.',
                      '© 2025 Take-Two Interactive Software, Inc. and its subsidiaries.'
                    },
                    art = 'collab_C7'
                  },
                  ['Rust'] = {
                    artist = nil,
                    ml_text = {
                      'Rust (c) 2025 Facepunch Studios Ltd. All Rights Reserved.'
                    },
                    art = 'collab_R'
                  },
                }

                local middle = {n=G.UIT.R, config={align = "cm", minh = 4.8, minw = 12.3}, nodes={
                  {n=G.UIT.O, config={id = nil, func = 'CREDITS_check_collab', object = Moveable()}},
                }}
              
                local collab_options = {}
                for k, v in pairs(G.collab_credits) do
                  collab_options[#collab_options+1] = k
                end
                
                table.sort(collab_options)

                G.viewed_collab = collab_options[1]

                return 
                      {n=G.UIT.ROOT, config={align = "cm", padding = 0.2, colour = G.C.L_BLACK, r = 0.1, emboss = 0.05, minh = 6, minw = 10}, nodes={
                      {n=G.UIT.C, config={align = "cm", padding = 0.2,outline_colour = G.C.JOKER_GREY, r = 0.1, outline = 1}, nodes={
                        create_option_cycle({options = 
                        collab_options, opt_callback = 'change_viewed_collab', current_option = 1, colour = G.C.RED, w = 4, mid = middle
                        })
                    }}
                }}
              end,
            },
            {
              label = "Sounds",
              tab_definition_function = function() return 
                {n=G.UIT.ROOT, config={align = "cm", padding = 0.2, colour = G.C.BLACK, r = 0.1, emboss = 0.05, minh = 6, minw = 10}, nodes={
                  {n=G.UIT.R, config={align = "cm", padding = 0}, nodes={
                    {n=G.UIT.T, config={text = "All sounds not listed here fall under ", scale = text_scale*0.6, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                    {n=G.UIT.T, config={text = "Creative Commons - CC0", scale = text_scale*0.6, colour = G.C.BLUE, shadow = true}},
                  }},
                  {n=G.UIT.R, config={align = "cm", padding = 0.1,outline_colour = G.C.JOKER_GREY, r = 0.1, outline = 1}, nodes={
                    {n=G.UIT.R, config={align = "cm", padding = 0}, nodes={
                      {n=G.UIT.T, config={text = '"chamber_choir_chord_o.wav" (Used for Polychrome sound) by uair01 (https://freesound.org/people/uair01/sounds/65195/)', scale = text_scale*0.5, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                    }},
                    {n=G.UIT.R, config={align = "cm", padding = 0}, nodes={
                      {n=G.UIT.T, config={text = 'is licensed under ', scale = text_scale*0.5, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                      {n=G.UIT.T, config={text = "Attribution 3.0 License", scale = text_scale*0.5, colour = G.C.GOLD, shadow = true}},
                      {n=G.UIT.T, config={text = '. This work has been modified from its original state', scale = text_scale*0.5, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                    }},
                  }},
                  {n=G.UIT.R, config={align = "cm", padding = 0.1,outline_colour = G.C.JOKER_GREY, r = 0.1, outline = 1}, nodes={
                    {n=G.UIT.R, config={align = "cm", padding = 0}, nodes={
                      {n=G.UIT.T, config={text = '"Coffee1.wav" (Used for Tarot card sound) by Nathan Gibson (https://nathangibson.myportfolio.com)', scale = text_scale*0.5, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                    }},
                    {n=G.UIT.R, config={align = "cm", padding = 0}, nodes={
                      {n=G.UIT.T, config={text = 'is licensed under ', scale = text_scale*0.5, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                      {n=G.UIT.T, config={text = "Attribution 4.0 License", scale = text_scale*0.5, colour = G.C.ORANGE, shadow = true}},
                      {n=G.UIT.T, config={text = '.', scale = text_scale*0.5, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                    }},
                  }},
                  {n=G.UIT.R, config={align = "cm", padding = 0.1,outline_colour = G.C.JOKER_GREY, r = 0.1, outline = 1}, nodes={
                    {n=G.UIT.R, config={align = "cm", padding = 0}, nodes={
                      {n=G.UIT.T, config={text = '"Wood Block1.wav" (Used for Tarot card sound) by Nathan Gibson (https://nathangibson.myportfolio.com)', scale = text_scale*0.5, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                    }},
                    {n=G.UIT.R, config={align = "cm", padding = 0}, nodes={
                      {n=G.UIT.T, config={text = 'is licensed under ', scale = text_scale*0.5, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                      {n=G.UIT.T, config={text = "Attribution 4.0 License", scale = text_scale*0.5, colour = G.C.ORANGE, shadow = true}},
                      {n=G.UIT.T, config={text = '.', scale = text_scale*0.5, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                    }},
                  }},
                  {n=G.UIT.R, config={align = "cm", padding = 0.1,outline_colour = G.C.JOKER_GREY, r = 0.1, outline = 1}, nodes={
                    {n=G.UIT.R, config={align = "cm", padding = 0}, nodes={
                      {n=G.UIT.T, config={text = '"Toy records#06-E3-02.wav" (Used for Mult sounds) by poissonmort (https://freesound.org/people/poissonmort/sounds/253249/)', scale = text_scale*0.5, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                    }},
                    {n=G.UIT.R, config={align = "cm", padding = 0}, nodes={
                      {n=G.UIT.T, config={text = 'is licensed under ', scale = text_scale*0.5, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                      {n=G.UIT.T, config={text = "Attribution 4.0 License", scale = text_scale*0.5, colour = G.C.ORANGE, shadow = true}},
                      {n=G.UIT.T, config={text = '. This work has been modified from its original state', scale = text_scale*0.5, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                    }},
                  }},
                }}
              end,
            },
            {
              label = "Imagery",
              tab_definition_function = function() return 
                {n=G.UIT.ROOT, config={align = "cm", padding = 0.2, colour = G.C.BLACK, r = 0.1, emboss = 0.05, minh = 6, minw = 10}, nodes={
                  {n=G.UIT.R, config={align = "cm", padding = 0.1,outline_colour = G.C.JOKER_GREY, r = 0.1, outline = 1}, nodes={
                    {n=G.UIT.R, config={align = "cm", padding = 0}, nodes={
                      {n=G.UIT.T, config={text = 'The font "m6x11.ttf" by Daniel Linssen (https://managore.itch.io/m6x11)', scale = text_scale*0.5, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                    }},
                    {n=G.UIT.R, config={align = "cm", padding = 0}, nodes={
                      {n=G.UIT.T, config={text = 'is licensed under an ', scale = text_scale*0.5, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                      {n=G.UIT.T, config={text = "Attribution License", scale = text_scale*0.5, colour = G.C.GOLD, shadow = true}},
                      {n=G.UIT.T, config={text = '.', scale = text_scale*0.5, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                    }},
                    not G.F_BASIC_CREDITS and 
                    {n=G.UIT.R, config={align = "cm", padding = 0}, nodes={
                      {n=G.UIT.T, config={text = 'Check out his itch.io profile, he has made an incredible catalogue of games.', scale = text_scale*0.5, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                    }} or nil,
                  }},
                  {n=G.UIT.R, config={align = "cm", padding = 0.1,outline_colour = G.C.JOKER_GREY, r = 0.1, outline = 1}, nodes={
                    {n=G.UIT.R, config={align = "cm", padding = 0}, nodes={
                      {n=G.UIT.T, config={text = 'The Joker "Vagabond" was created by Lumpy Touch', scale = text_scale*0.5, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                    }},
                  }},
                  {n=G.UIT.R, config={align = "cm", padding = 0.1,outline_colour = G.C.JOKER_GREY, r = 0.1, outline = 1}, nodes={
                    {n=G.UIT.R, config={align = "cm", padding = 0}, nodes={
                      {n=G.UIT.T, config={text = 'The Collab art for Slay the Spire and The Binding of Isaac was', scale = text_scale*0.5, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                    }},
                    {n=G.UIT.R, config={align = "cm", padding = 0}, nodes={
                      {n=G.UIT.T, config={text = 'created by ', scale = text_scale*0.5, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                      {n=G.UIT.T, config={text = "Neato", scale = text_scale*0.5, colour = G.C.GOLD, shadow = true}},
                      {n=G.UIT.T, config={text = ' (twitch.tv/neato)', scale = text_scale*0.5, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                    }},
                  }},
                  {n=G.UIT.R, config={align = "cm", padding = 0}, nodes={
                    {n=G.UIT.T, config={text = "All sprites, shaders, and any other visual assets", scale = text_scale*0.6, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                  }},
                  {n=G.UIT.R, config={align = "cm", padding = 0}, nodes={
                    {n=G.UIT.T, config={text = "not listed here were created by LocalThunk.", scale = text_scale*0.6, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                  }},
                  {n=G.UIT.R, config={align = "cm", padding = 0}, nodes={
                    {n=G.UIT.T, config={text = "©2024 - All rights reserved", scale = text_scale*0.6, colour = G.C.BLUE, shadow = true}},
                  }},
                }}
              end,
            },
            {
              label = "Misc",
              tab_definition_function = function() return 
                {n=G.UIT.ROOT, config={align = "cm", padding = 0.2, colour = G.C.BLACK, r = 0.1, emboss = 0.05, minh = 6, minw = 6}, nodes={
                  {n=G.UIT.R, config={align = "cm", padding = 0.1,outline_colour = G.C.JOKER_GREY, r = 0.1, outline = 1}, nodes={
                    {n=G.UIT.R, config={align = "cm", padding = 0}, nodes={
                      {n=G.UIT.T, config={text = "For Marshal", scale = text_scale*0.6, colour = G.C.WHITE, shadow = true}},
                    }},
                  }},
                  {n=G.UIT.R, config={align = "cm", padding = 0.1,outline_colour = G.C.JOKER_GREY, r = 0.1, outline = 1}, nodes={
                    {n=G.UIT.R, config={align = "cm", padding = 0}, nodes={
                      {n=G.UIT.T, config={text = "Special Thanks", scale = text_scale*0.6, colour = G.C.GREEN, shadow = true}},
                    }},
                    {n=G.UIT.R, config={align = "tm", padding = 0}, nodes={
                      {n=G.UIT.C, config={align = "tl", padding = 0.05, minw = 2.5}, nodes={
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Nicole', scale = text_scale*0.5, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Josh', scale = text_scale*0.5, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Jeremy', scale = text_scale*0.5, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Dylan', scale = text_scale*0.5, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Justin', scale = text_scale*0.5, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Daniel', scale = text_scale*0.5, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Colby', scale = text_scale*0.5, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Thomas', scale = text_scale*0.5, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Mom & Dad', scale = text_scale*0.5, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Luc & Donna', scale = text_scale*0.5, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                        }},
                      }},
                      {n=G.UIT.C, config={align = "tl", padding = 0.05, minw = 2.5}, nodes={
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'GothicLordUK', scale = text_scale*0.5, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Big Simple', scale = text_scale*0.5, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'MALF', scale = text_scale*0.5, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Northernlion', scale = text_scale*0.5, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Purple Moss Collectors', scale = text_scale*0.5, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Dan Gheesling', scale = text_scale*0.5, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Fabian Fischer', scale = text_scale*0.5, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'newobject', scale = text_scale*0.5, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'MurphyObv', scale = text_scale*0.5, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                        }},
                        {n=G.UIT.R, config={align = "cl", padding = 0}, nodes={
                          {n=G.UIT.T, config={text = 'Love2D', scale = text_scale*0.5, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
                        }},
                      }},
                    }},
                  }}
                }}
              end,
            },
        },
        snap_to_nav = true}),
      }}
  }})
  return t
end

function G.UIDEF.challenges(from_game_over)

  if G.PROFILES[G.SETTINGS.profile].all_unlocked then G.PROFILES[G.SETTINGS.profile].challenges_unlocked = #G.CHALLENGES end

  if not G.PROFILES[G.SETTINGS.profile].challenges_unlocked then
    local deck_wins = 0
    for k, v in pairs(G.PROFILES[G.SETTINGS.profile].deck_usage) do
      if v.wins and v.wins[1] then
        deck_wins = deck_wins + 1
      end
    end
    local loc_nodes = {}
    localize{type = 'descriptions', key = 'challenge_locked', set = 'Other', nodes = loc_nodes, vars = {G.CHALLENGE_WINS, deck_wins}, default_col = G.C.WHITE}

    return {n=G.UIT.ROOT, config={align = "cm", padding = 0.1, colour = G.C.CLEAR, minh = 8.02, minw = 7}, nodes={
      transparent_multiline_text(loc_nodes)
    }}
  end

  G.run_setup_seed = nil
  if G.OVERLAY_MENU then 
    local seed_toggle = G.OVERLAY_MENU:get_UIE_by_ID('run_setup_seed')
    if seed_toggle then seed_toggle.states.visible = false end
  end

  
  local _ch_comp, _ch_tot = 0,#G.CHALLENGES
  for k, v in ipairs(G.CHALLENGES) do
    if v.id and G.PROFILES[G.SETTINGS.profile].challenge_progress.completed[v.id or ''] then
      _ch_comp = _ch_comp + 1
    end
  end

  local _ch_tab = {comp = _ch_comp, unlocked = G.PROFILES[G.SETTINGS.profile].challenges_unlocked}

  return {n=G.UIT.ROOT, config={align = "cm", padding = 0.1, colour = G.C.CLEAR, minh = 8, minw = 7}, nodes={
    {n=G.UIT.R, config={align = "cm", padding = 0.1, r = 0.1 ,colour = G.C.BLACK}, nodes={
      {n=G.UIT.R, config={align = "cm", padding = 0.1}, nodes={
        {n=G.UIT.T, config={text = localize('k_challenge_mode'), scale = 0.4, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
      }},
      {n=G.UIT.R, config={align = "cm", minw = 8.5, minh = 1.5, padding = 0.2}, nodes={
        UIBox_button({id = from_game_over and 'from_game_over' or nil, label = {localize('b_new_challenge')}, button = 'challenge_list', minw = 4, scale = 0.4, minh = 0.6}),
      }},
      {n=G.UIT.R, config={align = "cm", minh = 0.8, r = 0.1, minw = 4.5, colour = G.C.L_BLACK, emboss = 0.05,
      progress_bar = {
        max = _ch_tot, ref_table = _ch_tab, ref_value = 'unlocked', empty_col = G.C.L_BLACK, filled_col = G.C.FILTER
      }}, nodes={
        {n=G.UIT.C, config={align = "cm", padding = 0.05, r = 0.1, minw = 4.5}, nodes={
          {n=G.UIT.T, config={text = localize{type = 'variable', key = 'unlocked', vars = {_ch_tab.unlocked, _ch_tot}}, scale = 0.3, colour = G.C.WHITE, shadow =true}},
        }},
      }},
      {n=G.UIT.R, config={align = "cm", minh = 0.8, r = 0.1, minw = 4.5, colour = G.C.L_BLACK, emboss = 0.05,
      progress_bar = {
        max = _ch_tot, ref_table = _ch_tab, ref_value = 'comp', empty_col = G.C.L_BLACK, filled_col = adjust_alpha(G.C.GREEN, 0.5)
      }}, nodes={
        {n=G.UIT.C, config={align = "cm", padding = 0.05, r = 0.1, minw = 4.5}, nodes={
          {n=G.UIT.T, config={text = localize{type = 'variable', key = 'completed', vars = {_ch_comp, _ch_tot}}, scale = 0.3, colour = G.C.WHITE, shadow = true}},
        }},
      }},
    }},
    G.F_DAILIES and {n=G.UIT.R, config={align = "cm", padding = 0.1, r = 0.1 ,colour = G.C.BLACK}, nodes={
      {n=G.UIT.R, config={align = "cm", padding = 0.1}, nodes={
        {n=G.UIT.T, config={text = localize('k_daily_run'), scale = 0.4, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
      }},
      {n=G.UIT.R, config={align = "cl", minw = 8.5, minh = 4}, nodes={
        G.UIDEF.daily_overview()
      }}
    }} or nil,
  }}
end

function G.UIDEF.daily_overview()
  local hist_height, hist_width = 3, 3

  local daily_results = {
    score = {
      me = {val = 20000, percentile = 75},
      hist = {
        0.05,0.05,0.05,0.05,0.05,0.05,0.05,0.05,0.05,0.05,0.05,0.05,0.15,0.1,0.1,0.05,0.05,0.05,0.05,0.05
      }
    }
  }
  local score_hist, max_score_hist = {}, 0
  for k, v in ipairs(daily_results.score.hist) do if max_score_hist < v then max_score_hist = v end end
  for k, v in ipairs(daily_results.score.hist) do 
    score_hist[#score_hist+1] =  {n=G.UIT.C, config={align = 'bm'}, nodes ={{n=G.UIT.C, config={colour = G.C.BLUE, minw = hist_width/#daily_results.score.hist, minh = (v + 0.05*math.random())/max_score_hist*hist_height}}}}
  end

  return {n=G.UIT.R, config={align = "cm"}, nodes=score_hist}
end

function G.UIDEF.run_setup(from_game_over)
  G.run_setup_seed = nil
  local _challenge_chosen = from_game_over == 'challenge_list'
  from_game_over = from_game_over and not (from_game_over == 'challenge_list')

  local _can_continue = G.MAIN_MENU_UI and G.FUNCS.can_continue({config = {func = true}})
  G.FUNCS.false_ret = function() return false end
  local t =   create_UIBox_generic_options({no_back = from_game_over, no_esc = from_game_over, contents ={
      {n=G.UIT.R, config={align = "cm", padding = 0, draw_layer = 1}, nodes={
        create_tabs(
        {tabs = {
            {
                label = localize('b_new_run'),
                chosen = (not _challenge_chosen) and (not _can_continue),
                tab_definition_function = G.UIDEF.run_setup_option,
                tab_definition_function_args = 'New Run'
            },
            G.STAGE == G.STAGES.MAIN_MENU and {
                label = localize('b_continue'),
                chosen = (not _challenge_chosen) and _can_continue,
                tab_definition_function = G.UIDEF.run_setup_option,
                tab_definition_function_args = 'Continue',
                func = 'can_continue'
            } or {
              label = localize('b_challenges'),
              tab_definition_function = G.UIDEF.challenges,
              tab_definition_function_args = from_game_over,
              chosen = _challenge_chosen
            },
            G.STAGE == G.STAGES.MAIN_MENU and {
              label = localize('b_challenges'),
              tab_definition_function = G.UIDEF.challenges,
              tab_definition_function_args = from_game_over,
              chosen = _challenge_chosen
            } or nil,
        },
        snap_to_nav = true}),
      }},
  }})
  return t
end

function G.UIDEF.profile_select()
  G.focused_profile = G.focused_profile or G.SETTINGS.profile or 1

  local t =   create_UIBox_generic_options({padding = 0,contents ={
      {n=G.UIT.R, config={align = "cm", padding = 0, draw_layer = 1, minw = 4}, nodes={
        create_tabs(
        {tabs = {
            {
                label = 1,
                chosen = G.focused_profile == 1,
                tab_definition_function = G.UIDEF.profile_option,
                tab_definition_function_args = 1
            },
            {
                label = 2,
                chosen = G.focused_profile == 2,
                tab_definition_function = G.UIDEF.profile_option,
                tab_definition_function_args = 2
            },
            {
                label = 3,
                chosen = G.focused_profile == 3,
                tab_definition_function = G.UIDEF.profile_option,
                tab_definition_function_args = 3
            }
        },
        snap_to_nav = true}),
      }},
  }})
  return t
end

function G.UIDEF.profile_option(_profile)
  set_discover_tallies()
  G.focused_profile = _profile
  local profile_data = get_compressed(G.focused_profile..'/'..'profile.jkr')
    if profile_data ~= nil then
      profile_data = STR_UNPACK(profile_data)
      profile_data.name = profile_data.name or ("P".._profile)
    end
  G.PROFILES[_profile].name = profile_data and profile_data.name or ''

  local lwidth, rwidth, scale = 1, 1, 1
  G.CHECK_PROFILE_DATA = nil
  local t = {n=G.UIT.ROOT, config={align = 'cm', colour = G.C.CLEAR}, nodes={
    {n=G.UIT.R, config={align = 'cm',padding = 0.1, minh = 0.8}, nodes={
        ((_profile == G.SETTINGS.profile) or not profile_data) and {n=G.UIT.R, config={align = "cm"}, nodes={
        create_text_input({
          w = 4, max_length = 16, prompt_text = localize('k_enter_name'),
          ref_table = G.PROFILES[_profile], ref_value = 'name',extended_corpus = true, keyboard_offset = 1,
          callback = function() 
            G:save_settings()
            G.FILE_HANDLER.force = true
          end
        }),
      }} or {n=G.UIT.R, config={align = 'cm',padding = 0.1, minw = 4, r = 0.1, colour = G.C.BLACK, minh = 0.6}, nodes={
        {n=G.UIT.T, config={text = G.PROFILES[_profile].name, scale = 0.45, colour = G.C.WHITE}},
      }},
    }},
    {n=G.UIT.R, config={align = "cm", padding = 0.1}, nodes={
      {n=G.UIT.C, config={align = "cm", minw = 6}, nodes={
        (G.PROFILES[_profile].progress and G.PROFILES[_profile].progress.discovered) and create_progress_box(G.PROFILES[_profile].progress, 0.5) or
        {n=G.UIT.C, config={align = "cm", minh = 4, minw = 5.2, colour = G.C.BLACK, r = 0.1}, nodes={
          {n=G.UIT.T, config={text = localize('k_empty_caps'), scale = 0.5, colour = G.C.UI.TRANSPARENT_LIGHT}}
        }},
      }},
      {n=G.UIT.C, config={align = "cm", minh = 4}, nodes={
        {n=G.UIT.R, config={align = "cm", minh = 1}, nodes={
          profile_data and {n=G.UIT.R, config={align = "cm"}, nodes={
            {n=G.UIT.C, config={align = "cm", minw = lwidth}, nodes={{n=G.UIT.T, config={text = localize('k_wins'),colour = G.C.UI.TEXT_LIGHT, scale = scale*0.7}}}},
            {n=G.UIT.C, config={align = "cm"}, nodes={{n=G.UIT.T, config={text = ': ',colour = G.C.UI.TEXT_LIGHT, scale = scale*0.7}}}},
            {n=G.UIT.C, config={align = "cl", minw = rwidth}, nodes={{n=G.UIT.T, config={text = tostring(profile_data.career_stats.c_wins),colour = G.C.RED, shadow = true, scale = 1*scale}}}}
          }} or nil,
        }},
        {n=G.UIT.R, config={align = "cm", padding = 0.2}, nodes={
          {n=G.UIT.R, config={align = "cm", padding = 0}, nodes={
            {n=G.UIT.R, config={align = "cm", minw = 4, maxw = 4, minh = 0.8, padding = 0.2, r = 0.1, hover = true, colour = G.C.BLUE,func = 'can_load_profile', button = "load_profile", shadow = true, focus_args = {nav = 'wide'}}, nodes={
              {n=G.UIT.T, config={text = _profile == G.SETTINGS.profile and localize('b_current_profile') or profile_data and localize('b_load_profile') or localize('b_create_profile'), ref_value = 'load_button_text', scale = 0.5, colour = G.C.UI.TEXT_LIGHT}}
            }}
          }},
          {n=G.UIT.R, config={align = "cm", padding = 0, minh = 0.7}, nodes={
            {n=G.UIT.R, config={align = "cm", minw = 3, maxw = 4, minh = 0.6, padding = 0.2, r = 0.1, hover = true, colour = G.C.RED,func = 'can_delete_profile', button = "delete_profile", shadow = true, focus_args = {nav = 'wide'}}, nodes={
              {n=G.UIT.T, config={text = _profile == G.SETTINGS.profile and localize('b_reset_profile') or localize('b_delete_profile'), scale = 0.3, colour = G.C.UI.TEXT_LIGHT}}
            }}
          }},
          (_profile == G.SETTINGS.profile and not G.PROFILES[G.SETTINGS.profile].all_unlocked) and {n=G.UIT.R, config={align = "cm", padding = 0, minh = 0.7}, nodes={
            {n=G.UIT.R, config={align = "cm", minw = 3, maxw = 4, minh = 0.6, padding = 0.2, r = 0.1, hover = true, colour = G.C.ORANGE,func = 'can_unlock_all', button = "unlock_all", shadow = true, focus_args = {nav = 'wide'}}, nodes={
              {n=G.UIT.T, config={text = localize('b_unlock_all'), scale = 0.3, colour = G.C.UI.TEXT_LIGHT}}
            }}
          }} or {n=G.UIT.R, config={align = "cm", minw = 3, maxw = 4, minh = 0.7}, nodes={
            G.PROFILES[_profile].all_unlocked and ((not G.F_NO_ACHIEVEMENTS) and {n=G.UIT.T, config={text = localize(G.F_TROPHIES and 'k_trophies_disabled' or 'k_achievements_disabled'), scale = 0.3, colour = G.C.UI.TEXT_LIGHT}} or 
              nil) or nil
          }},
        }},
    }},
    }},
    {n=G.UIT.R, config={align = "cm", padding = 0}, nodes={
      {n=G.UIT.T, config={id = 'warning_text', text = localize('ph_click_confirm'), scale = 0.4, colour = G.C.CLEAR}}
    }}
  }} 
  return t
end

function G.UIDEF.stake_description(_stake)
  local _stake_center = G.P_CENTER_POOLS.Stake[_stake]
  local ret_nodes = {}
  if _stake_center then localize{type = 'descriptions', key = _stake_center.key, set = _stake_center.set, nodes = ret_nodes} end 

  local desc_t = {}
  for k, v in ipairs(ret_nodes) do
    desc_t[#desc_t+1] = {n=G.UIT.R, config={align = "cm", maxw = 5.3}, nodes=v}
  end

  return {n=G.UIT.C, config={align = "cm", padding = 0.05, r = 0.1, colour = G.C.L_BLACK}, nodes={
    {n=G.UIT.R, config={align = "cm", padding = 0}, nodes={
      {n=G.UIT.T, config={text = localize{type = 'name_text', key = _stake_center.key, set = _stake_center.set}, scale = 0.35, colour = G.C.WHITE}}
    }},
    {n=G.UIT.R, config={align = "cm", padding = 0.03, colour = G.C.WHITE, r = 0.1, minh = 1, minw = 5.5}, nodes=desc_t}
  }}
end

function G.UIDEF.stake_option(_type)
  local middle = {n=G.UIT.R, config={align = "cm", minh = 1.7, minw = 7.3}, nodes={
    {n=G.UIT.O, config={id = nil, func = 'RUN_SETUP_check_stake2', object = Moveable()}},
    }}

  local max_stake = get_deck_win_stake(G.GAME.viewed_back.effect.center.key)
  if G.PROFILES[G.SETTINGS.profile].all_unlocked then max_stake = 8 end
  local stake_options = {}
  for i = 1, math.min(max_stake+1, 8) do
    stake_options[i] = i
  end

  return  {n=G.UIT.ROOT, config={align = "tm", colour = G.C.CLEAR, minh = 2.03, minw = 8.3}, nodes={_type == 'Continue' and middle or create_option_cycle({options = 
  stake_options,
  opt_callback = 'change_stake', current_option = G.viewed_stake, colour = G.C.RED, w = 6, mid = middle
  })
}}
end

function G.UIDEF.viewed_stake_option()
  G.viewed_stake = G.viewed_stake or 1
  local max_stake = get_deck_win_stake(G.GAME.viewed_back.effect.center.key)
  if G.PROFILES[G.SETTINGS.profile].all_unlocked then max_stake = 8 end
  
  G.viewed_stake = math.min(max_stake+1, G.viewed_stake)
  if _type ~= 'Continue' then G.PROFILES[G.SETTINGS.profile].MEMORY.stake = G.viewed_stake end
  
  local stake_sprite = get_stake_sprite(G.viewed_stake)

  return  {n=G.UIT.ROOT, config={align = "cm", colour = G.C.BLACK, r = 0.1}, nodes={
    {n=G.UIT.C, config={align = "cm", padding = 0}, nodes={
      {n=G.UIT.T, config={text = localize('k_stake'), scale = 0.4, colour = G.C.L_BLACK, vert = true}}
    }},
    {n=G.UIT.C, config={align = "cm", padding = 0.1}, nodes={
      {n=G.UIT.C, config={align = "cm", padding = 0}, nodes={
        {n=G.UIT.O, config={colour = G.C.BLUE, object = stake_sprite, hover = true, can_collide = false}},
      }},
      G.UIDEF.stake_description(G.viewed_stake)
    }}
  }}
end

function G.UIDEF.challenge_list(from_game_over)
  G.CHALLENGE_PAGE_SIZE = 10
  local challenge_pages = {}
  for i = 1, math.ceil(#G.CHALLENGES/G.CHALLENGE_PAGE_SIZE) do
    table.insert(challenge_pages, localize('k_page')..' '..tostring(i)..'/'..tostring(math.ceil(#G.CHALLENGES/G.CHALLENGE_PAGE_SIZE)))
  end
  G.E_MANAGER:add_event(Event({func = (function()
    G.FUNCS.change_challenge_list_page{cycle_config = {current_option = 1}}
  return true end)}))

  local _ch_comp, _ch_tot = 0,#G.CHALLENGES
  for k, v in ipairs(G.CHALLENGES) do
    if v.id and G.PROFILES[G.SETTINGS.profile].challenge_progress.completed[v.id or ''] then
      _ch_comp = _ch_comp + 1
    end
  end

  local t = create_UIBox_generic_options({ back_id = from_game_over and 'from_game_over' or nil, back_func = 'setup_run', back_id = 'challenge_list', contents = {
    {n=G.UIT.C, config={align = "cm", padding = 0.0}, nodes={
      {n=G.UIT.R, config={align = "cm", padding = 0.1, minh = 7, minw = 4.2}, nodes={
        {n=G.UIT.O, config={id = 'challenge_list', object = Moveable()}},
      }},
      {n=G.UIT.R, config={align = "cm", padding = 0.1}, nodes={
        create_option_cycle({id = 'challenge_page',scale = 0.9, h = 0.3, w = 3.5, options = challenge_pages, cycle_shoulders = true, opt_callback = 'change_challenge_list_page', current_option = 1, colour = G.C.RED, no_pips = true, focus_args = {snap_to = true}})
      }},
      {n=G.UIT.R, config={align = "cm", padding = 0.1}, nodes={
        {n=G.UIT.T, config={text = localize{type = 'variable', key = 'challenges_completed', vars = {_ch_comp, _ch_tot}}, scale = 0.4, colour = G.C.WHITE}},
      }},

    }},
    {n=G.UIT.C, config={align = "cm", minh = 9, minw = 11.5}, nodes={
      {n=G.UIT.O, config={id = 'challenge_area', object = Moveable()}},
    }},
  }})
  return t
end

function G.UIDEF.challenge_list_page(_page)
  local snapped = false
  local challenge_list = {}
  for k, v in ipairs(G.CHALLENGES) do
    if k > G.CHALLENGE_PAGE_SIZE*(_page or 0) and k <= G.CHALLENGE_PAGE_SIZE*((_page or 0) + 1) then
      if G.CONTROLLER.focused.target and G.CONTROLLER.focused.target.config.id == 'challenge_page' then snapped = true end
      local challenge_completed =  G.PROFILES[G.SETTINGS.profile].challenge_progress.completed[v.id or '']
      local challenge_unlocked = G.PROFILES[G.SETTINGS.profile].challenges_unlocked and (G.PROFILES[G.SETTINGS.profile].challenges_unlocked >= k)

      challenge_list[#challenge_list+1] = 
      {n=G.UIT.R, config={align = "cm"}, nodes={
        {n=G.UIT.C, config={align = 'cl', minw = 0.8}, nodes = {
          {n=G.UIT.T, config={text = k..'', scale = 0.4, colour = G.C.WHITE}},
        }},
        UIBox_button({id = k, col = true, label = {challenge_unlocked and localize(v.id, 'challenge_names') or localize('k_locked'),}, button = challenge_unlocked and 'change_challenge_description' or 'nil', colour = challenge_unlocked and G.C.RED or G.C.GREY, minw = 4, scale = 0.4, minh = 0.6, focus_args = {snap_to = not snapped}}),
        {n=G.UIT.C, config={align = 'cm', padding = 0.05, minw = 0.6}, nodes = {
          {n=G.UIT.C, config={minh = 0.4, minw = 0.4, emboss = 0.05, r = 0.1, colour = challenge_completed and G.C.GREEN or G.C.BLACK}, nodes = {
            challenge_completed and {n=G.UIT.O, config={object = Sprite(0,0,0.4,0.4, G.ASSET_ATLAS["icons"], {x=1, y=0})}} or nil
          }},
        }},
      }}      
      snapped = true
    end
  end

  return {n=G.UIT.ROOT, config={align = "cm", padding = 0.1, colour = G.C.CLEAR}, nodes=challenge_list}
end

function G.UIDEF.challenge_description(_id, daily, is_row)
  local challenge = G.CHALLENGES[_id]
  if not challenge then return {n=G.UIT.ROOT, config={align = "cm", colour = G.C.BLACK, minh = 8.82, minw = 11.5, r = 0.1}, nodes={{n=G.UIT.T, config={text = localize('ph_select_challenge'), scale = 0.3, colour = G.C.UI.TEXT_LIGHT}}}} end

  local joker_size = 0.6
  local jokers = CardArea(0,0,
      10*joker_size,
      0.6*G.CARD_H, 
      {card_limit = get_challenge_rule(challenge, 'modifiers', 'joker_limit') or 5,
      card_w = joker_size*G.CARD_W, type = 'title_2', highlight_limit = 0})
    
  if challenge.jokers  then 
    for k, v in ipairs(challenge.jokers) do
      local card = Card(0,0, G.CARD_W*joker_size, G.CARD_H*joker_size, nil, G.P_CENTERS[v.id], {bypass_discovery_center = true,bypass_discovery_ui = true, bypass_lock=true})
      if v.edition then card:set_edition({[v.edition] = true}, true, true) end
      if v.eternal then card:set_eternal(true) end
      if v.pinned then card.pinned = true end
      jokers:emplace(card)
    end
  end

  local joker_col = {n=G.UIT.C, config={align = "cm", padding = 0.05, colour = G.C.L_BLACK, r = 0.1, maxh = 1.8}, nodes={
    {n=G.UIT.T, config={text = localize('k_jokers_cap'), scale = 0.5, colour = G.C.UI.TEXT_LIGHT, vert = true, shadow = true}},
    {n=G.UIT.C, config={align = "cm", minh = 0.6*G.CARD_H, minw = 5, r = 0.1, colour = G.C.UI.TRANSPARENT_DARK}, nodes={
      jokers and {n=G.UIT.O, config={object = jokers}} or {n=G.UIT.T, config={text = localize('k_none'), scale = 0.5, colour = G.C.UI.TEXT_LIGHT}}
    }}
  }}

  local consumeables = CardArea(0,0,
    3*joker_size,
    0.6*G.CARD_H, 
    {card_limit = get_challenge_rule(challenge, 'modifiers', 'consumable_limit') or 2,
    card_w = joker_size*G.CARD_W, type = 'title_2', spread = true, highlight_limit = 0})

  if challenge.consumeables then 
  for k, v in ipairs(challenge.consumeables) do
    local card = Card(0,0, G.CARD_W*joker_size, G.CARD_H*joker_size, nil, G.P_CENTERS[v.id], {bypass_discovery_center = true,bypass_discovery_ui = true, bypass_lock=true})
    if v.edition then card:set_edition({[v.edition] = true}, true, true) end
    if v.eternal then card:set_eternal(true) end
    consumeables:emplace(card)
  end
  end

  local consumable_col = {n=G.UIT.C, config={align = "cm", padding = 0.05, colour = G.C.L_BLACK, r = 0.1, maxh = 1.8}, nodes={
    {n=G.UIT.T, config={text = localize('k_cap_consumables'), scale = 0.3, colour = G.C.UI.TEXT_LIGHT, vert = true, shadow = true}},
    {n=G.UIT.C, config={align = "cm", minh = 0.6*G.CARD_H, r = 0.1, colour = G.C.UI.TRANSPARENT_DARK}, nodes={
      consumeables and {n=G.UIT.O, config={object = consumeables}} or {n=G.UIT.T, config={text = localize('k_none'), scale = 0.5, colour = G.C.UI.TEXT_LIGHT}},
    }}
  }}

  local vouchers = CardArea(0,0,
    3*joker_size,
    0.6*G.CARD_H, 
    {card_limit = nil,
    card_w = joker_size*G.CARD_W, type = 'title_2', spread = true, highlight_limit = 0})

  if challenge.vouchers then 
  for k, v in ipairs(challenge.vouchers) do
    local card = Card(0,0, G.CARD_W*joker_size, G.CARD_H*joker_size, nil, G.P_CENTERS[v.id], {bypass_discovery_center = true,bypass_discovery_ui = true, bypass_lock=true})
    if v.edition then card:set_edition({[v.edition] = true}, true, true) end
    if v.eternal then card:set_eternal(true) end
    vouchers:emplace(card)
  end
  end

  local voucher_col = {n=G.UIT.C, config={align = "cm", padding = 0.05, colour = G.C.L_BLACK, r = 0.1, maxh = 1.8}, nodes={
    {n=G.UIT.T, config={text = localize('k_vouchers_cap'), scale = 0.33, colour = G.C.UI.TEXT_LIGHT, vert = true, shadow = true}},
    {n=G.UIT.C, config={align = "cm", minh = 0.6*G.CARD_H, r = 0.1, colour = G.C.UI.TRANSPARENT_DARK}, nodes={
      vouchers and {n=G.UIT.O, config={object = vouchers}} or {n=G.UIT.T, config={text = localize('k_none'), scale = 0.5, colour = G.C.UI.TEXT_LIGHT}},
    }}
  }}

  

  return {n=is_row and G.UIT.R or G.UIT.ROOT, config={align = "cm", r = 0.1, colour = G.C.BLACK}, nodes={
    {n=G.UIT.R, config={align = "cm", padding = 0.1}, nodes={
      joker_col, consumable_col, voucher_col
    }},
    {n=G.UIT.R, config={align = "cm", padding = 0}, nodes={
      create_tabs(
        {tabs = {
            {
                label = localize('b_rules'),
                chosen = true,
                tab_definition_function = G.UIDEF.challenge_description_tab,
                tab_definition_function_args = {_id = _id, _tab = 'Rules'}
            },
            {
                label = localize('b_restrictions'),
                tab_definition_function = G.UIDEF.challenge_description_tab,
                tab_definition_function_args = {_id = _id, _tab = 'Restrictions'}
            },
            {
                label = localize('b_deck'),
                tab_definition_function = G.UIDEF.challenge_description_tab,
                tab_definition_function_args = {_id = _id, _tab = 'Deck'}
            }
        },
        tab_h = 5,
        padding = 0,
        text_scale = 0.36,
        scale = 0.85,
        no_shoulders = true,
        no_loop = true}
    )}},
    not is_row and {n=G.UIT.R, config={align = "cm", minh = 0.9}, nodes={
      {n=G.UIT.R, config={align = "cm", padding = 0.1, minh = 0.7, minw = 9, r = 0.1, hover = true, colour = G.C.BLUE, button = "start_challenge_run", shadow = true, id = _id}, nodes={
        {n=G.UIT.T, config={text = localize('b_play_cap'), scale = 0.5, colour = G.C.UI.TEXT_LIGHT,func = 'set_button_pip', focus_args = {button = 'x',set_button_pip = true}}}
      }}
    }} or nil,
  }}
end

function G.UIDEF.challenge_description_tab(args)
  args = args or {}
  if args._tab == 'Rules' then
    local challenge = G.CHALLENGES[args._id]
    local start_rules = {}
    local modded_starts = nil
    local game_rules = {}
    local starting_params = get_starting_params()
    local base_modifiers = {
      dollars = {value = starting_params.dollars, order = 6},
      discards = {value = starting_params.discards, order = 2},
      hands = {value = starting_params.hands, order = 1},
      reroll_cost = {value = starting_params.reroll_cost, order = 7},
      joker_slots = {value = starting_params.joker_slots, order = 4},
      consumable_slots = {value = starting_params.consumable_slots, order = 5},
      hand_size = {value = starting_params.hand_size, order = 3},
  }
  local bonus_mods = 100
  if challenge.rules then
    if challenge.rules.modifiers then
      for k, v in ipairs(challenge.rules.modifiers) do
        base_modifiers[v.id] = {value = v.value, order = base_modifiers[v.id] and base_modifiers[v.id].order or bonus_mods, custom = true, old_val = base_modifiers[v.id].value}
        bonus_mods = bonus_mods + 1
      end
    end
  end
  local nu_base_modifiers = {}
  for k, v in pairs(base_modifiers) do
    v.key = k
    nu_base_modifiers[#nu_base_modifiers+1] = v
  end
  table.sort(nu_base_modifiers, function(a,b) return a.order < b.order end)
  for k, v in ipairs(nu_base_modifiers) do
    if v.old_val then
      modded_starts = modded_starts or {}
      modded_starts[#modded_starts+1] = {n=G.UIT.R, config={align = "cl", maxw = 3.5}, nodes= localize{type = 'text', key = 'ch_m_'..v.key, vars = {v.value}, default_col = G.C.L_BLACK}}
    
    else
      start_rules[#start_rules+1] = {n=G.UIT.R, config={align = "cl", maxw =3.5}, nodes= localize{type = 'text', key = 'ch_m_'..v.key, vars = {v.value}, default_col = not v.custom and G.C.UI.TEXT_INACTIVE or nil}}
    end
  end

  if modded_starts then
    start_rules = {
      modded_starts and {n=G.UIT.R, config={align = "cl", padding = 0.05}, nodes=modded_starts} or nil,
      {n=G.UIT.R, config={align = "cl", padding = 0.05, colour = G.C.GREY}, nodes={}},
      {n=G.UIT.R, config={align = "cl", padding = 0.05}, nodes=start_rules},
    }
  end

    if challenge.rules then
      if challenge.rules.custom then
        for k, v in ipairs(challenge.rules.custom) do
          game_rules[#game_rules+1] = {n=G.UIT.R, config={align = "cl"}, nodes= localize{type = 'text', key = 'ch_c_'..v.id, vars = {v.value}}}
        end  
      end
    end
    if (not start_rules[1]) and (not modded_starts) then  start_rules[#start_rules+1] = {n=G.UIT.R, config={align = "cl"}, nodes= localize{type = 'text', key = 'ch_m_none', vars = {}}} end
    if not game_rules[1] then  game_rules[#game_rules+1] = {n=G.UIT.R, config={align = "cl"}, nodes= localize{type = 'text', key = 'ch_c_none', vars = {}}} end

    local starting_rule_list = {n=G.UIT.C, config={align = "cm", minw = 3, r = 0.1, colour = G.C.BLUE}, nodes={
      {n=G.UIT.R, config={align = "cm", padding = 0.08, minh = 0.6}, nodes={
        {n=G.UIT.T, config={text = localize('k_game_modifiers'), scale = 0.4, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
      }},
      {n=G.UIT.R, config={align = "cm", minh = 4.1, minw = 4.2, padding = 0.05, r = 0.1, colour = G.C.WHITE}, nodes= start_rules}
    }}

    local override_rule_list = {n=G.UIT.C, config={align = "cm", minw = 3, r = 0.1, colour = G.C.BLUE}, nodes={
      {n=G.UIT.R, config={align = "cm", padding = 0.08, minh = 0.6}, nodes={
        {n=G.UIT.T, config={text = localize('k_custom_rules'), scale = 0.4, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
      }},
      {n=G.UIT.R, config={align = "cm", minh = 4.1, minw = 6.8, maxw = 6.7, padding = 0.05, r = 0.1, colour = G.C.WHITE}, nodes= game_rules}
    }}

    return {n=G.UIT.ROOT, config={align = "cm", padding = 0.05, colour = G.C.CLEAR}, nodes={
      {n=G.UIT.C, config={align = "cm", padding = 0.1, colour = G.C.L_BLACK, r = 0.1, minw = 3}, nodes={
        override_rule_list,starting_rule_list
      }}
    }}
  elseif args._tab == 'Restrictions' then
    local challenge = G.CHALLENGES[args._id]

    local banned_cards, banned_tags, banned_other = {}, {}, {}

    if challenge.restrictions then
      if challenge.restrictions.banned_cards then
        local row_cards = {}
        local n_rows = math.max(1, math.floor(#challenge.restrictions.banned_cards/10) + 2 - math.floor(math.log(6, #challenge.restrictions.banned_cards)))
        local max_width = 1
        for k, v in ipairs(challenge.restrictions.banned_cards) do
          local _row = math.floor((k-1)*n_rows/(#challenge.restrictions.banned_cards)+1)
          row_cards[_row] = row_cards[_row] or {}
          row_cards[_row][#row_cards[_row]+1] = v
          if #row_cards[_row] > max_width then max_width = #row_cards[_row] end
        end

        local card_size = math.max(0.3, 0.75 - 0.01*(max_width*n_rows))

        for _, row_card in ipairs(row_cards) do
          local banned_card_area = CardArea(
            0,0,
            6.7,
            3.3/n_rows,
            {card_limit = nil, type = 'title_2', view_deck = true, highlight_limit = 0, card_w = G.CARD_W*card_size})
          table.insert(banned_cards, 
          {n=G.UIT.R, config={align = "cm", padding = 0}, nodes={
            {n=G.UIT.O, config={object = banned_card_area}}
          }}
          )
          for k, v in ipairs(row_card) do
            local card = Card(0,0, G.CARD_W*card_size, G.CARD_H*card_size, nil, G.P_CENTERS[v.id], {bypass_discovery_center = true,bypass_discovery_ui = true})
            banned_card_area:emplace(card)
          end
        end
      end
      if challenge.restrictions.banned_tags then
        local tag_tab = {}
        for k, v in pairs(challenge.restrictions.banned_tags) do
          tag_tab[#tag_tab+1] = G.P_TAGS[v.id]
        end
      
        table.sort(tag_tab, function (a, b) return a.order < b.order end)

        for k, v in ipairs(tag_tab) do
          local temp_tag = Tag(v.key)
          local temp_tag_ui = temp_tag:generate_UI(1.1 - 0.25*(math.sqrt(#challenge.restrictions.banned_tags)))
          table.insert(banned_tags, 
          {n=G.UIT.R, config={align = "cm", padding = 0}, nodes={
            temp_tag_ui
          }}
          )
        end
      end
      if challenge.restrictions.banned_other then
        local other_tab = {}
        for k, v in pairs(challenge.restrictions.banned_other) do
          if v.type == 'blind' then
            other_tab[#other_tab+1] = G.P_BLINDS[v.id]
          end
        end
      
        table.sort(other_tab, function (a, b) return a.order < b.order end)

        for k, v in ipairs(other_tab) do
          local temp_blind = AnimatedSprite(0,0,1,1, G.ANIMATION_ATLAS['blind_chips'], v.pos)
          temp_blind:define_draw_steps({
            {shader = 'dissolve', shadow_height = 0.05},
            {shader = 'dissolve'}
          })
          temp_blind.float = true
          temp_blind.states.hover.can = true
          temp_blind.states.drag.can = false
          temp_blind.states.collide.can = true
          temp_blind.config = {blind = v, force_focus = true}
          temp_blind.hover = function()
            if not G.CONTROLLER.dragging.target or G.CONTROLLER.using_touch then 
                if not temp_blind.hovering and temp_blind.states.visible then
                  temp_blind.hovering = true
                  temp_blind.hover_tilt = 3
                  temp_blind:juice_up(0.05, 0.02)
                  play_sound('chips1', math.random()*0.1 + 0.55, 0.12)
                  temp_blind.config.h_popup = create_UIBox_blind_popup(v, true)
                  temp_blind.config.h_popup_config ={align = 'cl', offset = {x=-0.1,y=0},parent = temp_blind}
                  Node.hover(temp_blind)
                end
            end
          end
          temp_blind.stop_hover = function() temp_blind.hovering = false; Node.stop_hover(temp_blind); temp_blind.hover_tilt = 0 end

          table.insert(banned_other, 
          {n=G.UIT.R, config={align = "cm", padding = 0}, nodes={
            {n=G.UIT.O, config={object = temp_blind}}
          }}
          )
        end
      end
    end
    if not banned_cards[1] then  banned_cards[#banned_cards+1] = {n=G.UIT.R, config={align = "cl"}, nodes= localize{type = 'text', key = 'ch_m_none', vars = {}}} end
    if not banned_tags[1] then  banned_tags[#banned_tags+1] = {n=G.UIT.R, config={align = "cl"}, nodes= localize{type = 'text', key = 'ch_c_none', vars = {}}} end
    if not banned_other[1] then  banned_other[#banned_other+1] = {n=G.UIT.R, config={align = "cl"}, nodes= localize{type = 'text', key = 'ch_c_none', vars = {}}} end

    local banned_cards = {n=G.UIT.C, config={align = "cm", r = 0.1, colour = G.C.RED}, nodes={
      {n=G.UIT.R, config={align = "cm", padding = 0.08, minh = 0.6}, nodes={
        {n=G.UIT.T, config={text = localize('k_banned_cards'), scale = 0.4, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
      }},
      {n=G.UIT.R, config={align = "cm", minh = 4.1, minw =7.33, padding = 0.05, r = 0.1, colour = G.C.WHITE}, nodes= 
        banned_cards
      }
    }}

    local banned_tags = {n=G.UIT.C, config={align = "cm", r = 0.1, colour = G.C.RED}, nodes={
      {n=G.UIT.R, config={align = "cm", padding = 0.08, minh = 0.6, maxw = 1.48}, nodes={
        {n=G.UIT.T, config={text =  localize('k_banned_tags'), scale = 0.3, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
      }},
      {n=G.UIT.R, config={align = "cm", minh = 4.1, minw = 1.48, padding = 0.05, r = 0.1, colour = G.C.WHITE}, nodes= 
      banned_tags}
    }}

    local banned_other = {n=G.UIT.C, config={align = "cm", r = 0.1, colour = G.C.RED}, nodes={
      {n=G.UIT.R, config={align = "cm", padding = 0.08, minh = 0.6, maxw = 1.84}, nodes={
        {n=G.UIT.T, config={text = localize('k_other'), scale = 0.4, colour = G.C.UI.TEXT_LIGHT, shadow = true}},
      }},
      {n=G.UIT.R, config={align = "cm", minh = 4.1, minw = 2, padding = 0.05, r = 0.1, colour = G.C.WHITE}, nodes= 
      banned_other}
    }}

    return {n=G.UIT.ROOT, config={align = "cm", padding = 0.05, colour = G.C.CLEAR}, nodes={
      {n=G.UIT.C, config={align = "cm", padding = 0.1, colour = G.C.L_BLACK, r = 0.1}, nodes={
        banned_cards, banned_tags, banned_other
      }}
    }}
  elseif args._tab == 'Deck' then
    local challenge = G.CHALLENGES[args._id]
    local deck_tables = {}
    local SUITS = {
      S = {},
      H = {},
      C = {},
      D = {},
    }
    local suit_map = {'S', 'H', 'C', 'D'}
    local card_protos = nil
    local _de = nil
    if challenge then
        _de = challenge.deck
    end

    if _de and _de.cards then
        card_protos = _de.cards
    end

    if not card_protos then 
        card_protos = {}
        for k, v in pairs(G.P_CARDS) do
            local _r, _s = string.sub(k, 3, 3), string.sub(k, 1, 1)
            local keep, _e, _d, _g = true, nil, nil, nil
            if _de then
                if _de.yes_ranks and not _de.yes_ranks[_r] then keep = false end
                if _de.no_ranks and _de.no_ranks[_r] then keep = false end
                if _de.yes_suits and not _de.yes_suits[_s] then keep = false end
                if _de.no_suits and _de.no_suits[_s] then keep = false end
                if _de.enhancement then _e = _de.enhancement end
                if _de.edition then _d = _de.edition end
                if _de.seal then _g = _de.seal end
            end
            
            if keep then card_protos[#card_protos+1] = {s=_s,r=_r,e=_e,d=_d,g=_g} end
        end
    end 
    for k, v in ipairs(card_protos) do
      local _card = Card(0,0, G.CARD_W*0.45, G.CARD_H*0.45, G.P_CARDS[v.s..'_'..v.r], G.P_CENTERS[v.e or 'c_base'])
      if v.d then _card:set_edition({[v.d] = true}, true, true) end
      if v.g then _card:set_seal(v.g, true, true) end
      SUITS[v.s][#SUITS[v.s]+1] = _card
    end

  for j = 1, 4 do
    if SUITS[suit_map[j]][1] then
      table.sort(SUITS[suit_map[j]], function(a,b) return a:get_nominal() > b:get_nominal() end )
      local view_deck = CardArea(
        0,0,
        5.5*G.CARD_W,
        0.42*G.CARD_H,
        {card_limit = #SUITS[suit_map[j]], type = 'title_2', view_deck = true, highlight_limit = 0, card_w = G.CARD_W*0.5, draw_layers = {'card'}})
      table.insert(deck_tables, 
      {n=G.UIT.R, config={align = "cm", padding = 0}, nodes={
        {n=G.UIT.O, config={object = view_deck}}
      }}
      )

      for i = 1, #SUITS[suit_map[j]] do
        if SUITS[suit_map[j]][i] then
          view_deck:emplace(SUITS[suit_map[j]][i])
        end
      end
    end
  end
    return {n=G.UIT.ROOT, config={align = "cm", padding = 0, colour = G.C.BLACK, r = 0.1, minw = 11.4, minh = 4.2}, nodes=deck_tables}
  end
end

function G.UIDEF.run_setup_option(type)
  if not G.SAVED_GAME then
    G.SAVED_GAME = get_compressed(G.SETTINGS.profile..'/'..'save.jkr')
    if G.SAVED_GAME ~= nil then G.SAVED_GAME = STR_UNPACK(G.SAVED_GAME) end
  end

  G.SETTINGS.current_setup = type
  G.GAME.viewed_back = Back(get_deck_from_name(G.PROFILES[G.SETTINGS.profile].MEMORY.deck))

  G.PROFILES[G.SETTINGS.profile].MEMORY.stake = G.PROFILES[G.SETTINGS.profile].MEMORY.stake or 1

  if type == 'Continue' then 
    
    G.viewed_stake = 1
    if G.SAVED_GAME ~= nil then
      saved_game = G.SAVED_GAME
      local viewed_deck = 'b_red'
      for k, v in pairs(G.P_CENTERS) do
        if v.name == saved_game.BACK.name then viewed_deck = k end
      end
      G.GAME.viewed_back:change_to(G.P_CENTERS[viewed_deck])
      G.viewed_stake = saved_game.GAME.stake or 1
    end
  end

  if type == 'New Run' then
    if G.OVERLAY_MENU then 
      local seed_toggle = G.OVERLAY_MENU:get_UIE_by_ID('run_setup_seed')
      if seed_toggle then seed_toggle.states.visible = true end
    end
    G.viewed_stake = G.PROFILES[G.SETTINGS.profile].MEMORY.stake or 1
    G.FUNCS.change_stake({to_key = G.viewed_stake})
  else
    G.run_setup_seed = nil
    if G.OVERLAY_MENU then 
      local seed_toggle = G.OVERLAY_MENU:get_UIE_by_ID('run_setup_seed')
      if seed_toggle then seed_toggle.states.visible = false end
    end
  end

  local area = CardArea(
    G.ROOM.T.x + 0.2*G.ROOM.T.w/2,G.ROOM.T.h,
    G.CARD_W,
    G.CARD_H, 
    {card_limit = 5, type = 'deck', highlight_limit = 0, deck_height = 0.75, thin_draw = 1})

  for i = 1, 10 do
    local card = Card(G.ROOM.T.x + 0.2*G.ROOM.T.w/2,G.ROOM.T.h, G.CARD_W, G.CARD_H, pseudorandom_element(G.P_CARDS), G.P_CENTERS.c_base, {playing_card = i, viewed_back = true})
    card.sprite_facing = 'back'
    card.facing = 'back'
    area:emplace(card)
    if i == 10 then G.sticker_card = card; card.sticker = get_deck_win_sticker(G.GAME.viewed_back.effect.center) end
  end

  local ordered_names, viewed_deck = {}, 1
  for k, v in ipairs(G.P_CENTER_POOLS.Back) do
    ordered_names[#ordered_names+1] = v.name
    if v.name == G.GAME.viewed_back.name then viewed_deck = k end
  end

  local lwidth, rwidth = 1.4, 1.8

  local type_colour = G.C.BLUE

  local scale = 0.39
  G.setup_seed = ''

  local t = {n=G.UIT.ROOT, config={align = "cm", colour = G.C.CLEAR, minh = 6.6, minw = 6}, nodes={
                type == 'Continue' and {n=G.UIT.R, config={align = "tm", minh = 3.8, padding = 0.15}, nodes={
                    {n=G.UIT.R, config={align = "cm", minh = 3.3, minw = 6.8}, nodes={
                      {n=G.UIT.C, config={align = "cm", colour = G.C.BLACK, padding = 0.15, r = 0.1, emboss = 0.05}, nodes={
                        {n=G.UIT.C, config={align = "cm"}, nodes={
                          {n=G.UIT.R, config={align = "cm", shadow = false}, nodes={
                            {n=G.UIT.O, config={object = area}}
                          }},
                        }},{n=G.UIT.C, config={align = "cm", minw = 4, maxw = 4, minh = 1.7, r = 0.1, colour = G.C.L_BLACK, padding = 0.1}, nodes={
                            {n=G.UIT.R, config={align = "cm", r = 0.1, minw = 4, maxw = 4, minh = 0.6}, nodes={
                              {n=G.UIT.O, config={id = nil, func = 'RUN_SETUP_check_back_name', object = Moveable()}},
                            }},
                            {n=G.UIT.R, config={align = "cm", colour = G.C.WHITE,padding = 0.03, minh = 1.75, r = 0.1}, nodes={
                              {n=G.UIT.R, config={align = "cm"}, nodes={
                                {n=G.UIT.C, config={align = "cm", minw = lwidth, maxw = lwidth}, nodes={{n=G.UIT.T, config={text = localize('k_round'),colour = G.C.UI.TEXT_DARK, scale = scale*0.8}}}},
                                {n=G.UIT.C, config={align = "cm"}, nodes={{n=G.UIT.T, config={text = ': ',colour = G.C.UI.TEXT_DARK, scale = scale*0.8}}}},
                                {n=G.UIT.C, config={align = "cl", minw = rwidth, maxw = lwidth}, nodes={{n=G.UIT.T, config={text = tostring(saved_game.GAME.round),colour = G.C.RED, scale = 0.8*scale}}}}
                              }},
                              {n=G.UIT.R, config={align = "cm"}, nodes={
                                {n=G.UIT.C, config={align = "cm", minw = lwidth, maxw = lwidth}, nodes={{n=G.UIT.T, config={text = localize('k_ante'),colour = G.C.UI.TEXT_DARK, scale = scale*0.8}}}},
                                {n=G.UIT.C, config={align = "cm"}, nodes={{n=G.UIT.T, config={text = ': ',colour = G.C.UI.TEXT_DARK, scale = scale*0.8}}}},
                                {n=G.UIT.C, config={align = "cl", minw = rwidth, maxw = lwidth}, nodes={{n=G.UIT.T, config={text = tostring(saved_game.GAME.round_resets.ante),colour = G.C.BLUE, scale = 0.8*scale}}}}
                              }},
                              {n=G.UIT.R, config={align = "cm"}, nodes={
                                {n=G.UIT.C, config={align = "cm", minw = lwidth, maxw = lwidth}, nodes={{n=G.UIT.T, config={text = localize('k_money'),colour = G.C.UI.TEXT_DARK, scale = scale*0.8}}}},
                                {n=G.UIT.C, config={align = "cm"}, nodes={{n=G.UIT.T, config={text = ': ',colour = G.C.UI.TEXT_DARK, scale = scale*0.8}}}},
                                {n=G.UIT.C, config={align = "cl", minw = rwidth, maxw = lwidth}, nodes={{n=G.UIT.T, config={text = localize('$')..tostring(saved_game.GAME.dollars),colour = G.C.ORANGE, scale = 0.8*scale}}}}
                              }},
                              {n=G.UIT.R, config={align = "cm"}, nodes={
                                {n=G.UIT.C, config={align = "cm", minw = lwidth, maxw = lwidth}, nodes={{n=G.UIT.T, config={text = localize('k_best_hand'),colour = G.C.UI.TEXT_DARK, scale = scale*0.8}}}},
                                {n=G.UIT.C, config={align = "cm"}, nodes={{n=G.UIT.T, config={text = ': ',colour = G.C.UI.TEXT_DARK, scale = scale*0.8}}}},
                                {n=G.UIT.C, config={align = "cl", minw = rwidth, maxw = lwidth}, nodes={{n=G.UIT.T, config={text = number_format(saved_game.GAME.round_scores.hand.amt),colour = G.C.RED, scale = scale_number(saved_game.GAME.round_scores.hand.amt, 0.8*scale)}}}}
                              }},
                              saved_game.GAME.seeded and {n=G.UIT.R, config={align = "cm"}, nodes={
                                {n=G.UIT.C, config={align = "cm", minw = lwidth, maxw = lwidth}, nodes={{n=G.UIT.T, config={text = localize('k_seed'),colour = G.C.UI.TEXT_DARK, scale = scale*0.8}}}},
                                {n=G.UIT.C, config={align = "cm"}, nodes={{n=G.UIT.T, config={text = ': ',colour = G.C.UI.TEXT_DARK, scale = scale*0.8}}}},
                                {n=G.UIT.C, config={align = "cl", minw = rwidth, maxw = lwidth}, nodes={{n=G.UIT.T, config={text = tostring(saved_game.GAME.pseudorandom.seed),colour = G.C.RED, scale = 0.8*scale}}}}
                              }} or nil,
                            }}       
                          }},
                          {n=G.UIT.C, config={align = "cm"}, nodes={
                            {n=G.UIT.O, config={id = G.GAME.viewed_back.name, func = 'RUN_SETUP_check_back_stake_column', object = UIBox{definition = G.UIDEF.deck_stake_column(G.GAME.viewed_back.effect.center.key), config = {offset = {x=0,y=0}}}}}
                          }}  
                        }}     
                      }}}} or
                      {n=G.UIT.R, config={align = "cm", minh = 3.8}, nodes={
                        create_option_cycle({options =  ordered_names, opt_callback = 'change_viewed_back', current_option = viewed_deck, colour = G.C.RED, w = 3.5, mid = 
                        {n=G.UIT.R, config={align = "cm", minh = 3.3, minw = 5}, nodes={
                            {n=G.UIT.C, config={align = "cm", colour = G.C.BLACK, padding = 0.15, r = 0.1, emboss = 0.05}, nodes={
                              {n=G.UIT.C, config={align = "cm"}, nodes={
                                {n=G.UIT.R, config={align = "cm", shadow = false}, nodes={
                                  {n=G.UIT.O, config={object = area}}
                                }},
                              }},{n=G.UIT.C, config={align = "cm", minh = 1.7, r = 0.1, colour = G.C.L_BLACK, padding = 0.1}, nodes={
                                  {n=G.UIT.R, config={align = "cm", r = 0.1, minw = 4, maxw = 4, minh = 0.6}, nodes={
                                    {n=G.UIT.O, config={id = nil, func = 'RUN_SETUP_check_back_name', object = Moveable()}},
                                  }},
                                  {n=G.UIT.R, config={align = "cm", colour = G.C.WHITE, minh = 1.7, r = 0.1}, nodes={
                                    {n=G.UIT.O, config={id = G.GAME.viewed_back.name, func = 'RUN_SETUP_check_back', object = UIBox{definition = G.GAME.viewed_back:generate_UI(), config = {offset = {x=0,y=0}}}}}
                                  }}       
                                }},
                                {n=G.UIT.C, config={align = "cm"}, nodes={
                                  {n=G.UIT.O, config={id = G.GAME.viewed_back.name, func = 'RUN_SETUP_check_back_stake_column', object = UIBox{definition = G.UIDEF.deck_stake_column(G.GAME.viewed_back.effect.center.key), config = {offset = {x=0,y=0}}}}}
                                }}   
                              }}     
                            }}
                          })
                        }},
                  {n=G.UIT.R, config={align = "cm"}, nodes={
                    type == 'Continue' and {n=G.UIT.R, config={align = "cm", minh = 2.2, minw = 5}, nodes={
                      {n=G.UIT.R, config={align = "cm", minh = 0.17}, nodes={}},
                      {n=G.UIT.R, config={align = "cm"}, nodes={
                        {n=G.UIT.O, config={id = nil, func = 'RUN_SETUP_check_stake', insta_func = true, object = Moveable()}},
                      }}
                    }}
                    or {n=G.UIT.R, config={align = "cm", minh = 2.2, minw = 6.8}, nodes={
                      {n=G.UIT.O, config={id = nil, func = 'RUN_SETUP_check_stake', insta_func = true, object = Moveable()}},
                    }},
                }},
                {n=G.UIT.R, config={align = "cm", padding = 0.05, minh = 0.9}, nodes={
                  {n=G.UIT.O, config={align = "cm", func = 'toggle_seeded_run', object = Moveable()}, nodes={
                  }},
                }},
                {n=G.UIT.R, config={align = "cm", padding = 0}, nodes={
                  {n=G.UIT.C, config={align = "cm", minw = 2.4, id = 'run_setup_seed'}, nodes={
                    type == 'New Run' and create_toggle{col = true, label = localize('k_seeded_run'), label_scale = 0.25, w = 0, scale = 0.7, ref_table = G, ref_value = 'run_setup_seed'} or nil
                  }},
                    {n=G.UIT.C, config={align = "cm", minw = 5, minh = 0.8, padding = 0.2, r = 0.1, hover = true, colour = G.C.BLUE, button = "start_setup_run", shadow = true, func = 'can_start_run'}, nodes={
                      {n=G.UIT.R, config={align = "cm", padding = 0}, nodes={
                        {n=G.UIT.T, config={text = localize('b_play_cap'), scale = 0.8, colour = G.C.UI.TEXT_LIGHT,func = 'set_button_pip', focus_args = {button = 'x',set_button_pip = true}}}
                      }}
                    }},
                   {n=G.UIT.C, config={align = "cm", minw = 2.5}, nodes={}}
                }}
            }}
  return t
end

function create_button_binding_pip(args)

  local button_sprite_map = {
    ['a'] = G.F_SWAP_AB_PIPS and 1 or 0,
    ['b'] = G.F_SWAP_AB_PIPS and 0 or 1,
    ['x'] = 2,
    ['y'] = 3,
    ['leftshoulder'] = 4,
    ['rightshoulder'] = 5,
    ['triggerleft'] = 6,
    ['triggerright'] = 7,
    ['start'] = 8,
    ['back'] = 9,
    ['dpadup'] = 10,
    ['dpadright'] = 11,
    ['dpaddown'] = 12,
    ['dpadleft'] = 13,
    ['left'] = 14,
    ['right'] = 15,
    ['leftstick'] = 16,
    ['rightstick'] = 17,
    ['guide'] = 19
  }
  local BUTTON_SPRITE = Sprite(0,0,args.scale or 0.45,args.scale or 0.45,G.ASSET_ATLAS["gamepad_ui"],
    {x=button_sprite_map[args.button],
     y=G.CONTROLLER.GAMEPAD_CONSOLE == 'Nintendo' and 2 or G.CONTROLLER.GAMEPAD_CONSOLE == 'Playstation' and (G.F_PS4_PLAYSTATION_GLYPHS and 3 or 1) or 0})

  return {n=G.UIT.ROOT, config = {align = 'cm', colour = G.C.CLEAR}, nodes={
        {n=G.UIT.O, config={object = BUTTON_SPRITE}},
    }}
end

function create_UIBox_profile_button()

  local letters = {}
  if G.F_DISP_USERNAME then
    for _, c in utf8.chars(G.F_DISP_USERNAME) do
      local _char = c
      local leng = G.LANGUAGES['all1'].font.FONT:hasGlyphs(c)
      letters[#letters+1] = {n=G.UIT.T, config={lang = G.LANGUAGES[leng and 'all1' or 'all2'],text = _char, scale = 0.3, colour = mix_colours(G.C.GREEN, G.C.WHITE, 0.7), shadow = true}}
    end
  end

  if not G.PROFILES[G.SETTINGS.profile].name then 
    G.PROFILES[G.SETTINGS.profile].name = "P"..G.SETTINGS.profile
  end

 return {n=G.UIT.ROOT, config = {align = "cm", colour = G.C.CLEAR}, nodes={
    {n=G.UIT.R, config={align = "cm", padding = 0.2, r = 0.1, emboss = 0.1, colour = G.C.L_BLACK}, nodes={
      {n=G.UIT.R, config={align = "cm"}, nodes={
        {n=G.UIT.T, config={text = localize('k_profile'), scale = 0.4, colour = G.C.UI.TEXT_LIGHT, shadow = true}}
      }},
      {n=G.UIT.R, config={align = "cm"}, nodes={
        {n=G.UIT.C, config={align = "cm", padding = 0.15, minw = 2, minh = 0.8, maxw = 2, r = 0.1, hover = true, colour = mix_colours(G.C.WHITE, G.C.GREY, 0.2), button = 'profile_select', shadow = true}, nodes={
          {n=G.UIT.T, config={ref_table = G.PROFILES[G.SETTINGS.profile], ref_value = 'name', scale = 0.4, colour = G.C.UI.TEXT_LIGHT, shadow = true}}
        }},
      }}
    }},
    G.F_DISP_USERNAME and {n=G.UIT.R, config={align = "cm"}, nodes={
      {n=G.UIT.R, config={align = "cm"}, nodes={
        {n=G.UIT.T, config={text = localize('k_playing_as'), scale = 0.3, colour = G.C.UI.TEXT_LIGHT, shadow = true}}
      }},
      {n=G.UIT.R, config={align = "cm", minh = 0.12}, nodes={}},
      {n=G.UIT.R, config={align = "cm", maxw = 2}, nodes=letters}
    }} or nil,
  }}
end

function create_UIBox_main_menu_buttons()
  local text_scale = 0.45
  local language = nil
  if not G.F_ENGLISH_ONLY then 
    language = Sprite(0,0,0.6,0.6,G.ASSET_ATLAS["icons"], {x=2, y=0})
    language.states.drag.can = false
  end
  local discord = nil
  local twitter = nil
  if G.F_DISCORD then 
    discord = Sprite(0,0,0.6,0.6,G.ASSET_ATLAS["icons"], {x=0, y=0})
    discord.states.drag.can = false
    twitter = Sprite(0,0,0.6,0.6,G.ASSET_ATLAS["icons"], {x=0, y=1})
    twitter.states.drag.can = false
  end

  local quit_func = 'quit'

  local t = {
    n=G.UIT.ROOT, config = {align = "cm",colour = G.C.CLEAR}, nodes={ 
      {n=G.UIT.C, config={align = "bm"}, nodes={      
        {n=G.UIT.R, config={align = "cm", padding = 0.2, r = 0.1, emboss = 0.1, colour = G.C.L_BLACK, mid = true}, nodes={
          UIBox_button{id = 'main_menu_play', button = not G.SETTINGS.tutorial_complete and "start_run" or "setup_run", colour = G.C.BLUE, minw = 3.65, minh = 1.55, label = {localize('b_play_cap')}, scale = text_scale*2, col = true},
          {n=G.UIT.C, config={align = "cm"}, nodes={
            UIBox_button{button = 'options', colour = G.C.ORANGE, minw = 2.65, minh = 1.35, label = {localize('b_options_cap')}, scale = text_scale * 1.2, col = true},
            G.F_QUIT_BUTTON and {n=G.UIT.C, config={align = "cm", minw = 0.2}, nodes={}} or nil,
            G.F_QUIT_BUTTON and UIBox_button{button = quit_func, colour = G.C.RED, minw = 2.65, minh = 1.35, label = {localize('b_quit_cap')}, scale = text_scale * 1.2, col = true} or nil,
          }},
          UIBox_button{id = 'collection_button', button = "your_collection", colour = G.C.PALE_GREEN, minw = 3.65, minh = 1.55, label = {localize('b_collection_cap')}, scale = text_scale*1.5, col = true},
        }},
      }},
      {n=G.UIT.C, config={align = "br", minw = 3.2, padding = 0.1}, nodes={
        G.F_DISCORD and {n=G.UIT.R, config = {align = "cm", padding = 0.2}, nodes={
          {n=G.UIT.C, config={align = "cm", padding = 0.1, r = 0.1, hover = true, colour = mix_colours(G.C.BLUE, G.C.GREY, 0.4), button = 'go_to_discord', shadow = true}, nodes={
            {n=G.UIT.O, config={object = discord}},
          }},
          {n=G.UIT.C, config={align = "cm", padding = 0.1, r = 0.1, hover = true, colour = G.C.BLACK, button = 'go_to_twitter', shadow = true}, nodes={
            {n=G.UIT.O, config={object = twitter}},
          }}
        }} or nil,
        not G.F_ENGLISH_ONLY and {n=G.UIT.R, config = {align = "cm", padding = 0.2, r = 0.1, emboss = 0.1, colour = G.C.L_BLACK}, nodes={
          {n=G.UIT.R, config={align = "cm", padding = 0.15, minw = 1, r = 0.1, hover = true, colour = mix_colours(G.C.WHITE, G.C.GREY, 0.2), button = 'language_selection', shadow = true}, nodes={
            {n=G.UIT.O, config={object = language}},
            {n=G.UIT.T, config={text = G.LANG.label, scale = 0.4, colour = G.C.UI.TEXT_LIGHT, shadow = true}}
          }}
        }} or nil,
      }},
    }}
  return t
end

function create_UIBox_main_menu_competittion_name()
  G.SETTINGS.COMP.name = ''
  local t = {
    n=G.UIT.ROOT, config = {align = "cm",colour = G.C.CLEAR}, nodes={   
      {n=G.UIT.C, config={align = "cm", padding = 0.2, r = 0.1, emboss = 0.1, colour = G.C.L_BLACK, mid = true}, nodes={
        {n=G.UIT.R, config={align = "cm"}, nodes={
          create_text_input({
            w = 4, max_length = 16,prompt_text = 'Enter Name',
            ref_table = G.SETTINGS.COMP, ref_value = 'name'
          }),
        }},
        UIBox_button{button = "confirm_contest_name", colour = G.C.PALE_GREEN, minw = 2.65, minh = 1, label = {'Confirm'}, scale = 0.5},
      }},
    }}
  return t
end

function G.UIDEF.language_selector() 
  local rows = {}
  local langs = {}
  for k, v in pairs(G.LANGUAGES) do
    if not v.omit then 
      langs[#langs+1] = v
    end
  end
  table.sort(langs, (function(a, b) return a.label < b.label end))
  local _row = {}
  for k, v in ipairs(langs) do
    if not G.F_HIDE_BETA_LANGS or (not v.beta) then
      _row[#_row+1] = {n=G.UIT.C, config={align = "cm", func = 'beta_lang_alert', padding = 0.05, r = 0.1, minh = 0.7, minw = 4.5, button = v.beta and 'warn_lang' or 'change_lang', ref_table = v, colour = v.beta and G.C.RED or G.C.BLUE, hover = true, shadow = true, focus_args = {snap_to = (k == 1)}}, nodes={
        {n=G.UIT.R, config={align = "cm"}, nodes={
          {n=G.UIT.T, config={text = v.label, lang = v, scale = 0.45, colour = G.C.UI.TEXT_LIGHT, shadow = true}}
        }}
      }}
    end
    if _row[3] or (k == #langs) then 
      rows[#rows+1] = {n=G.UIT.R, config={align = "cm", padding = 0.1}, nodes=_row}
      _row = {}
    end
  end
  
  local discord = nil
  discord = Sprite(0,0,0.6,0.6,G.ASSET_ATLAS["icons"], {x=2, y=0})
  discord.states.drag.can = false

  local t = create_UIBox_generic_options({contents ={
    {n=G.UIT.R, config={align = "cm", padding = 0.05}, nodes=rows},
    G.F_EXTERNAL_LINKS and {n=G.UIT.R, config={align = "cm", padding = 0.05}, nodes={
      {n=G.UIT.C, config={align = "cm", padding = 0.1, minw = 4, maxw = 4, r = 0.1, minh = 0.8, hover = true, colour = mix_colours(G.C.GREEN, G.C.GREY, 0.4), button = 'loc_survey', shadow = true}, nodes={
        {n=G.UIT.O, config={object = discord}},
        {n=G.UIT.T, config={text = G.LANG.button, scale = 0.45, colour = G.C.UI.TEXT_LIGHT, shadow = true}}
      }},
    }} or nil
  }})
  return t
end

function create_UIBox_highlight(rect)
  local t = {n=G.UIT.ROOT, config = {align = "cm", minh = rect.T.h+0.1, minw = rect.T.w+0.15, r = 0.15, colour = G.C.DARK_EDITION}, nodes={
  }}
return t
end

function create_UIBox_generic_options(args)
  args = args or {}
  local back_func = args.back_func or "exit_overlay_menu"
  local contents = args.contents or ({n=G.UIT.T, config={text = "EMPTY",colour = G.C.UI.RED, scale = 0.4}})
  if args.infotip then 
    G.E_MANAGER:add_event(Event({
      blocking = false,
      blockable = false,
      timer = 'REAL',
      func = function()
          if G.OVERLAY_MENU then
            local _infotip_object = G.OVERLAY_MENU:get_UIE_by_ID('overlay_menu_infotip')
            if _infotip_object then 
              _infotip_object.config.object:remove() 
              _infotip_object.config.object = UIBox{
                definition = overlay_infotip(args.infotip),
                config = {offset = {x=0,y=0}, align = 'bm', parent = _infotip_object}
              }
            end
          end
          return true
        end
    }))
  end

  return {n=G.UIT.ROOT, config = {align = "cm", minw = G.ROOM.T.w*5, minh = G.ROOM.T.h*5,padding = 0.1, r = 0.1, colour = args.bg_colour or {G.C.GREY[1], G.C.GREY[2], G.C.GREY[3],0.7}}, nodes={
    {n=G.UIT.R, config={align = "cm", minh = 1,r = 0.3, padding = 0.07, minw = 1, colour = args.outline_colour or G.C.JOKER_GREY, emboss = 0.1}, nodes={
      {n=G.UIT.C, config={align = "cm", minh = 1,r = 0.2, padding = 0.2, minw = 1, colour = args.colour or G.C.L_BLACK}, nodes={
        {n=G.UIT.R, config={align = "cm",padding = args.padding or 0.2, minw = args.minw or 7}, nodes=
          contents
        },
        not args.no_back and {n=G.UIT.R, config={id = args.back_id or 'overlay_menu_back_button', align = "cm", minw = 2.5, button_delay = args.back_delay, padding =0.1, r = 0.1, hover = true, colour = args.back_colour or G.C.ORANGE, button = back_func, shadow = true, focus_args = {nav = 'wide', button = 'b', snap_to = args.snap_back}}, nodes={
          {n=G.UIT.R, config={align = "cm", padding = 0, no_fill = true}, nodes={
            {n=G.UIT.T, config={id = args.back_id or nil, text = args.back_label or localize('b_back'), scale = 0.5, colour = G.C.UI.TEXT_LIGHT, shadow = true, func = not args.no_pip and 'set_button_pip' or nil, focus_args =  not args.no_pip and {button = args.back_button or 'b'} or nil}}
          }}
        }} or nil
      }},
    }},
    {n=G.UIT.R, config={align = "cm"}, nodes={
      {n=G.UIT.O, config={id = 'overlay_menu_infotip', object = Moveable()}},
    }},
  }}
end

function UIBox_dyn_container(inner_table, horizontal, colour_override, background_override, flipped, padding)
  return {n=G.UIT.R, config = {align = "cm", padding= 0.03, colour = G.C.UI.TRANSPARENT_DARK, r=0.1}, nodes={
    {n=G.UIT.R, config = {align = "cm", padding= 0.05, colour = colour_override or G.C.DYN_UI.MAIN, r=0.1}, nodes={
    {n=G.UIT.R, config={align = horizontal and "cl" or (flipped and 'bm' or "tm"), colour = background_override or G.C.DYN_UI.BOSS_DARK, minw = horizontal and 100 or 0, minh = horizontal and 0 or 30, r=0.1, padding = padding or 0.08}, nodes=
      inner_table
  }}}}}
end

function simple_text_container(_loc, args)
  if not _loc then return nil end
  args = args or {}
  local container = {}
  local loc_result = localize(_loc)
  if loc_result and type(loc_result) == 'table' then 
    for k, v in ipairs(loc_result) do
      container[#container+1] = 
        {n=G.UIT.R, config = {align = "cm", padding= 0}, nodes={
          {n=G.UIT.T, config={text = v, scale = args.scale or 0.35, colour = args.colour or G.C.UI.TEXT_DARK, shadow = args.shadow}}
        }}
    end
    return {n=args.col and G.UIT.C or G.UIT.R, config = {align = "cm", padding= args.padding or 0.03}, nodes=container}
  end
end

function UIBox_button(args)
  args = args or {}
  args.button = args.button or "exit_overlay_menu"
  args.func = args.func or nil
  args.colour = args.colour or G.C.RED
  args.choice = args.choice or nil
  args.chosen = args.chosen or nil
  args.label = args.label or {'LABEL'}
  args.minw = args.minw or 2.7
  args.maxw = args.maxw or (args.minw - 0.2)
  if args.minw < args.maxw then args.maxw = args.minw - 0.2 end
  args.minh = args.minh or 0.9
  args.scale = args.scale or 0.5
  args.focus_args = args.focus_args or nil
  args.text_colour = args.text_colour or G.C.UI.TEXT_LIGHT
  local but_UIT = args.col == true and G.UIT.C or G.UIT.R

  local but_UI_label = {}

  local button_pip = nil
  for k, v in ipairs(args.label) do 
    if k == #args.label and args.focus_args and args.focus_args.set_button_pip then 
      button_pip ='set_button_pip'
    end
    table.insert(but_UI_label, {n=G.UIT.R, config={align = "cm", padding = 0, minw = args.minw, maxw = args.maxw}, nodes={
      {n=G.UIT.T, config={text = v, scale = args.scale, colour = args.text_colour, shadow = args.shadow, focus_args = button_pip and args.focus_args or nil, func = button_pip, ref_table = args.ref_table}}
    }})
  end

  if args.count then 
    table.insert(but_UI_label, 
    {n=G.UIT.R, config={align = "cm", minh = 0.4}, nodes={
      {n=G.UIT.T, config={scale = 0.35,text = args.count.tally..' / '..args.count.of, colour = {1,1,1,0.9}}}
    }}
    )
  end

  return 
  {n= but_UIT, config = {align = 'cm'}, nodes={
  {n= G.UIT.C, config={
      align = "cm",
      padding = args.padding or 0,
      r = 0.1,
      hover = true,
      colour = args.colour,
      one_press = args.one_press,
      button = (args.button ~= 'nil') and args.button or nil,
      choice = args.choice,
      chosen = args.chosen,
      focus_args = args.focus_args,
      minh = args.minh - 0.3*(args.count and 1 or 0),
      shadow = true,
      func = args.func,
      id = args.id,
      back_func = args.back_func,
      ref_table = args.ref_table,
      mid = args.mid
    }, nodes=
    but_UI_label
    }}}
end
