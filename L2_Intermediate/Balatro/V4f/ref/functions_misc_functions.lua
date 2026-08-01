--Updates all display information for all displays for a given screenmode. Returns the key for the resolution option cycle
--
---@param screenmode string optional arg for one of 'Windowed', 'Fullscreen', or 'Borderless'
---@param display number optional arg to match fullscreen resolution with only the current display
function GET_DISPLAYINFO(screenmode, display)
  --default the display to the current display, otherwise we need to return all available modes for the selected display
  display = display or G.SETTINGS.WINDOW.selcted_display or 1

  --default to current mode/'windowed', otherwise return all available options for specified mode
  screenmode = screenmode or G.SETTINGS.WINDOW.screenmode or 'Windowed'

  --Get a count of the connected displays and iterate through them to update our window setting options accordingly
  local display_count = love.window.getDisplayCount()
  local res_option = 1 --This is the mode that the fullscreen option will default to for resolution, if we can find it in the list for the current monitor
  local realw, realh = love.window.getMode() --the actual render resolution the window is currently using
  local current_res_values = {w = realw, h = realh}

  --reset names to populate for displays
  G.SETTINGS.WINDOW.display_names = {}

  for i = 1, display_count do
    --reset the screen resolution table for this display and set the name
    G.SETTINGS.WINDOW.DISPLAYS[i] = {}
    G.SETTINGS.WINDOW.DISPLAYS[i].screen_resolutions = {
      strings = {},
      values = {},
    }
    G.SETTINGS.WINDOW.display_names[i] = ''..i

    --Get the render resolution and desktop resolution, this is a workaround to a known OpenGL issue where windows doesn't supply the correct DPI scaling factor
    local render_w, render_h = love.window.getDesktopDimensions(i)
    local unscaled_dims = love.window.getFullscreenModes(i)[1]

    --determine the DPI scale here, this can be used to determine the actual render resolution per display
    G.SETTINGS.WINDOW.DISPLAYS[i].DPI_scale = 1--math.floor((0.5*unscaled_dims.width/render_w + 0.5*unscaled_dims.height/render_h)*500 + 0.5)/500
    G.SETTINGS.WINDOW.DISPLAYS[i].MONITOR_DIMS = unscaled_dims

    if screenmode == 'Fullscreen' then --Iterate through all possible screenmodes and populate the screen_resolutions table
                                       --if the real resolution of the window is found, make sure we return that value
      for _, v in ipairs(love.window.getFullscreenModes(i)) do
        local _w, _h = v.width*G.SETTINGS.WINDOW.DISPLAYS[i].DPI_scale, v.height*G.SETTINGS.WINDOW.DISPLAYS[i].DPI_scale
        if _w <= G.SETTINGS.WINDOW.DISPLAYS[i].MONITOR_DIMS.width and _h <= G.SETTINGS.WINDOW.DISPLAYS[i].MONITOR_DIMS.height then
          G.SETTINGS.WINDOW.DISPLAYS[i].screen_resolutions.strings[#G.SETTINGS.WINDOW.DISPLAYS[i].screen_resolutions.strings+1] = ''..v.width..' X '..v.height
          G.SETTINGS.WINDOW.DISPLAYS[i].screen_resolutions.values[#G.SETTINGS.WINDOW.DISPLAYS[i].screen_resolutions.values+1] = {w = v.width, h = v.height}
          if i == G.SETTINGS.WINDOW.selected_display and i == display and current_res_values.w == v.width and current_res_values.h == v.height then
            res_option = #G.SETTINGS.WINDOW.DISPLAYS[i].screen_resolutions.values
          end
        end
      end
    elseif screenmode == 'Windowed' then 
      G.SETTINGS.WINDOW.DISPLAYS[i].screen_resolutions.strings[1] = '-'
      G.SETTINGS.WINDOW.DISPLAYS[i].screen_resolutions.values[1] = {w = 1280, h = 720}
    elseif screenmode == 'Borderless' then
      G.SETTINGS.WINDOW.DISPLAYS[i].screen_resolutions.strings[1] =
          ''..G.SETTINGS.WINDOW.DISPLAYS[i].MONITOR_DIMS.width/G.SETTINGS.WINDOW.DISPLAYS[i].DPI_scale..' X '
            ..G.SETTINGS.WINDOW.DISPLAYS[i].MONITOR_DIMS.height/G.SETTINGS.WINDOW.DISPLAYS[i].DPI_scale
      G.SETTINGS.WINDOW.DISPLAYS[i].screen_resolutions.values[1] = current_res_values
    end
  end
  return res_option
end

function timer_checkpoint(label, type, reset)
  G.PREV_GARB = G.PREV_GARB or 0
  if not G.F_ENABLE_PERF_OVERLAY then return end
  G.check = G.check or {
    draw = {
      checkpoint_list = {},
      checkpoints = 0,
      last_time = 0,
    },
    update = {
      checkpoint_list = {},
      checkpoints = 0,
      last_time = 0,
    }
  }
  local cp = G.check[type]
  if reset then 
    cp.last_time = love.timer.getTime()
    cp.checkpoints = 0
    return
  end
  
  cp.checkpoint_list[cp.checkpoints+1] = cp.checkpoint_list[cp.checkpoints+1] or {}
  cp.checkpoints = cp.checkpoints+1
  cp.checkpoint_list[cp.checkpoints].label = label..': '..(collectgarbage( "count" ) - G.PREV_GARB)
  cp.checkpoint_list[cp.checkpoints].time = love.timer.getTime()
  cp.checkpoint_list[cp.checkpoints].TTC = cp.checkpoint_list[cp.checkpoints].time - cp.last_time
  cp.checkpoint_list[cp.checkpoints].trend = cp.checkpoint_list[cp.checkpoints].trend or {}
  cp.checkpoint_list[cp.checkpoints].states = cp.checkpoint_list[cp.checkpoints].states or {}
  table.insert(cp.checkpoint_list[cp.checkpoints].trend, 1, cp.checkpoint_list[cp.checkpoints].TTC)
  table.insert(cp.checkpoint_list[cp.checkpoints].states, 1, G.STATE)
  cp.checkpoint_list[cp.checkpoints].trend[401] = nil
  cp.checkpoint_list[cp.checkpoints].states[401] = nil
  cp.last_time = cp.checkpoint_list[cp.checkpoints].time
  G.PREV_GARB = collectgarbage( "count" )
  local av = 0
  for k, v in ipairs(cp.checkpoint_list[cp.checkpoints].trend) do
    av = av + v/#cp.checkpoint_list[cp.checkpoints].trend
  end
  cp.checkpoint_list[cp.checkpoints].average = av 
end

function boot_timer(_label, _next, progress)
  progress = progress or 0
  G.LOADING = G.LOADING or {
    font = love.graphics.setNewFont("resources/fonts/m6x11plus.ttf", 20),
    love.graphics.dis
  }
  local realw, realh = love.window.getMode()
  love.graphics.setCanvas()
  love.graphics.push()
  love.graphics.setShader()
  love.graphics.clear(0,0,0,1)
  love.graphics.setColor(0.6, 0.8, 0.9,1)
  if progress > 0 then love.graphics.rectangle('fill', realw/2 - 150, realh/2 - 15, progress*300, 30, 5) end
  love.graphics.setColor(1, 1, 1,1)
  love.graphics.setLineWidth(3)
  love.graphics.rectangle('line', realw/2 - 150, realh/2 - 15, 300, 30, 5)
  if G.F_VERBOSE and not _RELEASE_MODE then love.graphics.print("LOADING: ".._next, realw/2 - 150, realh/2 +40) end
  love.graphics.pop()
  love.graphics.present()

  G.ARGS.bt = G.ARGS.bt or love.timer.getTime()
  G.ARGS.bt = love.timer.getTime()
end

function EMPTY(t)
  if not t then return {} end 
  for k, v in pairs(t) do
    t[k] = nil
  end
  return t
end

function interp(per, max, min)
min = min or 0
  if per and max then
    return per*(max - min) + min
  end
end

function remove_all(t)
  for i=#t, 1, -1 do
    local v=t[i]
    table.remove(t, i)
    if v and v.children then
        remove_all(v.children)
    end
    if v then v:remove() end
    v = nil
  end
  for _, v in pairs(t) do
    if v.children then remove_all(v.children) end
    v:remove()
    v = nil
  end
end

function Vector_Dist(trans1, trans2, mid)
    local x = trans1.x - trans2.x + (mid and 0.5*(trans1.w-trans2.w) or 0)
    local y = trans1.y - trans2.y + (mid and 0.5*(trans1.h-trans2.h) or 0)
    return math.sqrt((x)*(x) + (y)*(y))
end

function Vector_Len(trans1)
  return math.sqrt((trans1.x)*(trans1.x) + (trans1.y)*(trans1.y))
end

function Vector_Sub(trans1, trans2)
    return {x = trans1.x - trans2.x, y = trans1.y - trans2.y} 
end

function get_index(t, val)
    local index = nil
    for i, v in pairs(t) do 
        if v == val then
          index = i 
        end
    end
    return index
end

function table_length(t)
  local count = 0
  for _ in pairs(t) do count = count + 1 end
  return count
end

function remove_nils(t)
    local ans = {}
    for _,v in pairs(t) do
      ans[ #ans+1 ] = v
    end
    return ans
  end

function SWAP(t, i, j)
  if not t or not i or not j then return end
  local temp = t[i]
  t[i] = t[j]
  t[j] = temp
end

function pseudoshuffle(list, seed)
  if seed then math.randomseed(seed) end

  if list[1] and list[1].sort_id then
    table.sort(list, function (a, b) return (a.sort_id or 1) < (b.sort_id or 2) end)
  end

  for i = #list, 2, -1 do
		local j = math.random(i)
		list[i], list[j] = list[j], list[i]
	end
end

function generate_starting_seed()
  if G.GAME.stake >= 8 then
    local r_leg, r_tally = {}, 0
    local g_leg, g_tally = {}, 0
    for k, v in pairs(G.P_JOKER_RARITY_POOLS[4]) do
      local win_ante = get_joker_win_sticker(v, true)
      if win_ante and (win_ante >= 8) then 
        g_leg[v.key] = true
        g_tally = g_tally + 1
      else
        r_leg[v.key] = true
        r_tally = r_tally + 1
      end
    end
    if r_tally > 0 and g_tally > 0 then
      local seed_found = nil
      local extra_num = 0
      while not seed_found do
        extra_num = extra_num + 0.561892350821
        seed_found = random_string(8, extra_num + G.CONTROLLER.cursor_hover.T.x*0.33411983 + G.CONTROLLER.cursor_hover.T.y*0.874146 + 0.412311010*G.CONTROLLER.cursor_hover.time)
        if not r_leg[get_first_legendary(seed_found)] then seed_found = nil end
      end
      return seed_found
    end
  end

  return random_string(8, G.CONTROLLER.cursor_hover.T.x*0.33411983 + G.CONTROLLER.cursor_hover.T.y*0.874146 + 0.412311010*G.CONTROLLER.cursor_hover.time)
end

function get_first_legendary(_key)
  local _t, key = pseudorandom_element(G.P_JOKER_RARITY_POOLS[4], pseudoseed('Joker4', _key))
  return _t.key
end

function pseudorandom_element(_t, seed)
  if seed then math.randomseed(seed) end
  local keys = {}
  for k, v in pairs(_t) do
      keys[#keys+1] = {k = k,v = v}
  end

  if keys[1] and keys[1].v and type(keys[1].v) == 'table' and keys[1].v.sort_id then
    table.sort(keys, function (a, b) return a.v.sort_id < b.v.sort_id end)
  else
    table.sort(keys, function (a, b) return a.k < b.k end)
  end

  local key = keys[math.random(#keys)].k
  return _t[key], key 
end

function random_string(length, seed)
  if seed then math.randomseed(seed) end
  local ret = ''
  for i = 1, length do
    ret = ret..string.char(math.random() > 0.7 and math.random(string.byte('1'),string.byte('9')) or (math.random() > 0.45 and math.random(string.byte('A'),string.byte('N')) or math.random(string.byte('P'),string.byte('Z'))))
  end
  return string.upper(ret)
end

function pseudohash(str)
  if true then 
    local num = 1
    for i=#str, 1, -1 do
        num = ((1.1239285023/num)*string.byte(str, i)*math.pi + math.pi*i)%1
    end
    return num
  else
    str = string.sub(string.format("%-16s",str), 1, 24)
    
    local h = 0

    for i=#str, 1, -1 do
      h = bit.bxor(h, bit.lshift(h, 7) + bit.rshift(h, 3) + string.byte(str, i))
    end
    return tonumber(string.format("%.13f",math.sqrt(math.abs(h))%1))
  end
end

function pseudoseed(key, predict_seed)
  if key == 'seed' then return math.random() end

  if predict_seed then 
    local _pseed = pseudohash(key..(predict_seed or ''))
    _pseed = math.abs(tonumber(string.format("%.13f", (2.134453429141+_pseed*1.72431234)%1)))
    return (_pseed + (pseudohash(predict_seed) or 0))/2
  end
  
  if not G.GAME.pseudorandom[key] then 
    G.GAME.pseudorandom[key] = pseudohash(key..(G.GAME.pseudorandom.seed or ''))
  end

  G.GAME.pseudorandom[key] = math.abs(tonumber(string.format("%.13f", (2.134453429141+G.GAME.pseudorandom[key]*1.72431234)%1)))
  return (G.GAME.pseudorandom[key] + (G.GAME.pseudorandom.hashed_seed or 0))/2
end

function pseudorandom(seed, min, max)
  if type(seed) == 'string' then seed = pseudoseed(seed) end
  math.randomseed(seed)
  if min and max then return math.random(min, max)
  else return math.random() end
end

function tprint(tbl, indent)
    if not indent then indent = 0 end
    local toprint = string.rep(" ", indent) .. "{\r\n"
    indent = indent + 2 
    for k, v in pairs(tbl) do
      toprint = toprint .. string.rep(" ", indent)
      if (type(k) == "number") then
        toprint = toprint .. "[" .. k .. "] = "
      elseif (type(k) == "string") then
        toprint = toprint  .. k ..  "= "   
      end
      if (type(v) == "number") then
        toprint = toprint .. v .. ",\r\n"
      elseif (type(v) == "string") then
        toprint = toprint .. "\"" .. v .. "\",\r\n"
      elseif (type(v) == "table") then
        if indent>=10 then
        toprint = toprint .. tostring(v) .. ",\r\n"
        else
        toprint = toprint .. tostring(v) .. tprint(v, indent + 1) .. ",\r\n"
        end
      else
        toprint = toprint .. "\"" .. tostring(v) .. "\",\r\n"
      end
    end
    toprint = toprint .. string.rep(" ", indent-2) .. "}"
    return toprint
end

function sortingFunction(e1, e2)
    return e1.order < e2.order
end

function HEX(hex)
  if #hex <= 6 then hex = hex.."FF" end
  local _,_,r,g,b,a = hex:find('(%x%x)(%x%x)(%x%x)(%x%x)')
  local color = {tonumber(r,16)/255,tonumber(g,16)/255,tonumber(b,16)/255,tonumber(a,16)/255 or 255}
  return color
end

function get_blind_main_colour(blind) --either in the form of the blind key for the P_BLINDS table or type
  local disabled = false
  blind = blind or ''
  if blind == 'Boss' or blind == 'Small' or blind == 'Big' then
    G.GAME.round_resets.blind_states = G.GAME.round_resets.blind_states or {}
    if G.GAME.round_resets.blind_states[blind] == 'Defeated' or G.GAME.round_resets.blind_states[blind] == 'Skipped' then disabled = true end
    blind = G.GAME.round_resets.blind_choices[blind]
  end
  return (disabled or not G.P_BLINDS[blind]) and G.C.BLACK or
  G.P_BLINDS[blind].boss_colour or
  (blind == 'bl_small' and mix_colours(G.C.BLUE, G.C.BLACK, 0.6) or
  blind == 'bl_big' and mix_colours(G.C.ORANGE, G.C.BLACK, 0.6)) or G.C.BLACK
end

function evaluate_poker_hand(hand)

  local results = {
    ["Flush Five"] = {},
    ["Flush House"] = {},
    ["Five of a Kind"] = {},
    ["Straight Flush"] = {},
    ["Four of a Kind"] = {},
    ["Full House"] = {},
    ["Flush"] = {},
    ["Straight"] = {},
    ["Three of a Kind"] = {},
    ["Two Pair"] = {},
    ["Pair"] = {},
    ["High Card"] = {},
    top = nil
  }

  local parts = {
    _5 = get_X_same(5,hand),
    _4 = get_X_same(4,hand),
    _3 = get_X_same(3,hand),
    _2 = get_X_same(2,hand),
    _flush = get_flush(hand),
    _straight = get_straight(hand),
    _highest = get_highest(hand)
  }

  if next(parts._5) and next(parts._flush) then
    results["Flush Five"] = parts._5
    if not results.top then results.top = results["Flush Five"] end
  end

  if next(parts._3) and next(parts._2) and next(parts._flush) then
    local fh_hand = {}
    local fh_3 = parts._3[1]
    local fh_2 = parts._2[1]
    for i=1, #fh_3 do
      fh_hand[#fh_hand+1] = fh_3[i]
    end
    for i=1, #fh_2 do
      fh_hand[#fh_hand+1] = fh_2[i]
    end
    table.insert(results["Flush House"], fh_hand)
    if not results.top then results.top = results["Flush House"] end
  end

  if next(parts._5) then
    results["Five of a Kind"] = parts._5
    if not results.top then results.top = results["Five of a Kind"] end
  end

  if next(parts._flush) and next(parts._straight) then
    local _s, _f, ret = parts._straight, parts._flush, {}
    for _, v in ipairs(_f[1]) do
      ret[#ret+1] = v
    end
    for _, v in ipairs(_s[1]) do
      local in_straight = nil
      for _, vv in ipairs(_f[1]) do
        if vv == v then in_straight = true end
      end
      if not in_straight then ret[#ret+1] = v end
    end

    results["Straight Flush"] = {ret}
    if not results.top then results.top = results["Straight Flush"] end
  end

  if next(parts._4) then
    results["Four of a Kind"] = parts._4
    if not results.top then results.top = results["Four of a Kind"] end
  end

  if next(parts._3) and next(parts._2) then
    local fh_hand = {}
    local fh_3 = parts._3[1]
    local fh_2 = parts._2[1]
    for i=1, #fh_3 do
      fh_hand[#fh_hand+1] = fh_3[i]
    end
    for i=1, #fh_2 do
      fh_hand[#fh_hand+1] = fh_2[i]
    end
    table.insert(results["Full House"], fh_hand)
    if not results.top then results.top = results["Full House"] end
  end

  if next(parts._flush) then
    results["Flush"] = parts._flush
    if not results.top then results.top = results["Flush"] end
  end

  if next(parts._straight) then
    results["Straight"] = parts._straight
    if not results.top then results.top = results["Straight"] end
  end

  if next(parts._3) then
    results["Three of a Kind"] = parts._3
    if not results.top then results.top = results["Three of a Kind"] end
  end

  if (#parts._2 == 2) or (#parts._3 == 1 and #parts._2 == 1) then
    local fh_hand = {}
    local r = parts._2
    local fh_2a = r[1]
    local fh_2b = r[2]
    if not fh_2b then 
      fh_2b = parts._3[1]
    end
    for i=1, #fh_2a do
      fh_hand[#fh_hand+1] = fh_2a[i]
    end
    for i=1, #fh_2b do
      fh_hand[#fh_hand+1] = fh_2b[i]
    end
    table.insert(results["Two Pair"], fh_hand)
    if not results.top then results.top = results["Two Pair"] end
  end

  if next(parts._2) then
    results["Pair"] = parts._2
    if not results.top then results.top = results["Pair"] end
  end

  if next(parts._highest) then
    results["High Card"] = parts._highest
    if not results.top then results.top = results["High Card"] end
  end

  if results["Five of a Kind"][1] then
    results["Four of a Kind"] = {results["Five of a Kind"][1], results["Five of a Kind"][2], results["Five of a Kind"][3], results["Five of a Kind"][4]}
  end

  if results["Four of a Kind"][1] then
    results["Three of a Kind"] = {results["Four of a Kind"][1], results["Four of a Kind"][2], results["Four of a Kind"][3]}
  end

  if results["Three of a Kind"][1] then
    results["Pair"] = {results["Three of a Kind"][1], results["Three of a Kind"][2]}
  end

  return results
end

function get_flush(hand)
  local ret = {}
  local four_fingers = next(find_joker('Four Fingers'))
  local suits = {
    "Spades",
    "Hearts",
    "Clubs",
    "Diamonds"
  }
  if #hand > 5 or #hand < (5 - (four_fingers and 1 or 0)) then return ret else
    for j = 1, #suits do
      local t = {}
      local suit = suits[j]
      local flush_count = 0
      for i=1, #hand do
        if hand[i]:is_suit(suit, nil, true) then flush_count = flush_count + 1;  t[#t+1] = hand[i] end 
      end
      if flush_count >= (5 - (four_fingers and 1 or 0)) then
        table.insert(ret, t)
        return ret
      end
    end
    return {}
  end
end

function get_straight(hand)
  local ret = {}
  local four_fingers = next(find_joker('Four Fingers'))
  if #hand > 5 or #hand < (5 - (four_fingers and 1 or 0)) then return ret else
    local t = {}
    local IDS = {}
    for i=1, #hand do
      local id = hand[i]:get_id()
      if id > 1 and id < 15 then
        if IDS[id] then
          IDS[id][#IDS[id]+1] = hand[i]
        else
          IDS[id] = {hand[i]}
        end
      end
    end

    local straight_length = 0
    local straight = false
    local can_skip = next(find_joker('Shortcut')) 
    local skipped_rank = false
    for j = 1, 14 do
      if IDS[j == 1 and 14 or j] then
        straight_length = straight_length + 1
        skipped_rank = false
        for k, v in ipairs(IDS[j == 1 and 14 or j]) do
          t[#t+1] = v
        end
      elseif can_skip and not skipped_rank and j ~= 14 then
          skipped_rank = true
      else
        straight_length = 0
        skipped_rank = false
        if not straight then t = {} end
        if straight then break end
      end
      if straight_length >= (5 - (four_fingers and 1 or 0)) then straight = true end 
    end
    if not straight then return ret end
    table.insert(ret, t)
    return ret
  end
end

function get_X_same(num, hand)
  local vals = {{},{},{},{},{},{},{},{},{},{},{},{},{},{}}
  for i=#hand, 1, -1 do
    local curr = {}
    table.insert(curr, hand[i])
    for j=1, #hand do
      if hand[i]:get_id() == hand[j]:get_id() and i ~= j then
        table.insert(curr, hand[j])
      end
    end
    if #curr == num then
      vals[curr[1]:get_id()] = curr
    end
  end
  local ret = {}
  for i=#vals, 1, -1 do
    if next(vals[i]) then table.insert(ret, vals[i]) end
  end
  return ret
end

function get_highest(hand)
  local highest = nil
  for k, v in ipairs(hand) do
    if not highest or v:get_nominal() > highest:get_nominal() then
      highest = v
    end
  end
  if #hand > 0 then return {{highest}} else return {} end
end

function reset_drawhash()
  G.DRAW_HASH = EMPTY(G.DRAW_HASH)
end

--Copyright 2021 Max Cahill (Zlib license)
--
--This software is provided 'as-is', without any express or implied
--warranty. In no event will the authors be held liable for any damages
--arising from the use of this software.
--
--Permission is granted to anyone to use this software for any purpose,
--including commercial applications, and to alter it and redistribute it
--freely, subject to the following restrictions:
--
--1. The origin of this software must not be misrepresented; you must not
--   claim that you wrote the original software. If you use this software
--   in a product, an acknowledgment in the product documentation would be
--   appreciated but is not required.
--2. Altered source versions must be plainly marked as such, and must not be
--   misrepresented as being the original software.
--3. This notice may not be removed or altered from any source distribution.
--This function was slightly modified from it's original state
function nuGC(time_budget, memory_ceiling, disable_otherwise)
	time_budget = time_budget or 3e-4
	memory_ceiling = memory_ceiling or 300
	local max_steps = 1000
	local steps = 0
	local start_time = love.timer.getTime()
	while
		love.timer.getTime() - start_time < time_budget and
		steps < max_steps
	do
		collectgarbage("step", 1)
		steps = steps + 1
	end
	--safety net
	if collectgarbage("count") / 1024 > memory_ceiling then
		collectgarbage("collect")
	end
	--don't collect gc outside this margin
	if disable_otherwise then
		collectgarbage("stop")
	end
end

--The drawhash is a hash table of all drawn nodes and all nodes that may be invisible but still collide with the cursor
function add_to_drawhash(obj)
  if obj then 
    G.DRAW_HASH[#G.DRAW_HASH+1] = obj
  end
end

function mix_colours(C1, C2, proportionC1)
  return {
    (C1[1] or 0.5)*proportionC1 + (C2[1] or 0.5)*(1-proportionC1),
    (C1[2] or 0.5)*proportionC1 + (C2[2] or 0.5)*(1-proportionC1),
    (C1[3] or 0.5)*proportionC1 + (C2[3] or 0.5)*(1-proportionC1),
    (C1[4] or 1)*proportionC1 + (C2[4] or 1)*(1-proportionC1),
  }
end

function mod_chips(_chips)
  if G.GAME.modifiers.chips_dollar_cap then
    _chips = math.min(_chips, math.max(G.GAME.dollars, 0))
  end
  return _chips
end

function mod_mult(_mult)
  return _mult
end

function play_sound(sound_code, per, vol)
  if G.F_MUTE then return end
  if sound_code and G.SETTINGS.SOUND.volume > 0.001 then
    G.ARGS.play_sound = G.ARGS.play_sound or {}
    G.ARGS.play_sound.type = 'sound'
    G.ARGS.play_sound.time = G.TIMERS.REAL
    G.ARGS.play_sound.crt = G.SETTINGS.GRAPHICS.crt
    G.ARGS.play_sound.sound_code = sound_code
    G.ARGS.play_sound.per = per
    G.ARGS.play_sound.vol = vol
    G.ARGS.play_sound.pitch_mod = G.PITCH_MOD
    G.ARGS.play_sound.state = G.STATE
    G.ARGS.play_sound.music_control = G.SETTINGS.music_control
    G.ARGS.play_sound.sound_settings = G.SETTINGS.SOUND
    G.ARGS.play_sound.splash_vol = G.SPLASH_VOL
    G.ARGS.play_sound.overlay_menu = not (not G.OVERLAY_MENU)
    if G.F_SOUND_THREAD then
      G.SOUND_MANAGER.channel:push(G.ARGS.play_sound)
    else
      PLAY_SOUND(G.ARGS.play_sound)
    end
  end
end

function modulate_sound(dt)
  --volume of the splash screen is set here
  G.SPLASH_VOL = 2*dt*(G.STATE == G.STATES.SPLASH and 1 or 0) + (G.SPLASH_VOL or 1)*(1-2*dt)

  --Control the music here
  local desired_track =  
        G.video_soundtrack or
        (G.STATE == G.STATES.SPLASH and '') or
        (G.booster_pack_sparkles and not G.booster_pack_sparkles.REMOVED and 'music2') or
        (G.booster_pack_meteors and not G.booster_pack_meteors.REMOVED and 'music3') or
        (G.booster_pack and not G.booster_pack.REMOVED and 'music2') or
        (G.shop and not G.shop.REMOVED and 'music4') or
        (G.GAME.blind and G.GAME.blind.boss and 'music5') or 
        ('music1')

  G.PITCH_MOD = (G.PITCH_MOD or 1)*(1 - dt) + dt*((not G.normal_music_speed and G.STATE == G.STATES.GAME_OVER) and 0.5 or 1)

  --For ambient sound control
  G.SETTINGS.ambient_control = G.SETTINGS.ambient_control or {}
  G.ARGS.score_intensity = G.ARGS.score_intensity or {}
  if type(G.GAME.current_round.current_hand.chips) ~= 'number' or type(G.GAME.current_round.current_hand.mult) ~= 'number' then
    G.ARGS.score_intensity.earned_score = 0
  else
    G.ARGS.score_intensity.earned_score = G.GAME.current_round.current_hand.chips*G.GAME.current_round.current_hand.mult
  end
  G.ARGS.score_intensity.required_score = G.GAME.blind and G.GAME.blind.chips or 0
  G.ARGS.score_intensity.flames = math.min(1, (G.STAGE == G.STAGES.RUN and 1 or 0)*(
    (G.ARGS.chip_flames and (G.ARGS.chip_flames.real_intensity + G.ARGS.chip_flames.change) or 0))/10)
  G.ARGS.score_intensity.organ = G.video_organ or G.ARGS.score_intensity.required_score > 0 and math.max(math.min(0.4, 0.1*math.log(G.ARGS.score_intensity.earned_score/(G.ARGS.score_intensity.required_score+1), 5)),0.) or 0

  local AC = G.SETTINGS.ambient_control
  G.ARGS.ambient_sounds = G.ARGS.ambient_sounds or {
    ambientFire2 = {volfunc = function(_prev_volume) return _prev_volume*(1 - dt) + dt*0.9*((G.ARGS.score_intensity.flames > 0.3) and 1 or G.ARGS.score_intensity.flames/0.3) end},
    ambientFire1 = {volfunc = function(_prev_volume) return _prev_volume*(1 - dt) + dt*0.8*((G.ARGS.score_intensity.flames > 0.3) and (G.ARGS.score_intensity.flames-0.3)/0.7 or 0) end},
    ambientFire3 = {volfunc = function(_prev_volume) return _prev_volume*(1 - dt) + dt*0.4*((G.ARGS.chip_flames and G.ARGS.chip_flames.change or 0) + (G.ARGS.mult_flames and G.ARGS.mult_flames.change or 0)) end},
    ambientOrgan1 = {volfunc = function(_prev_volume) return _prev_volume*(1 - dt) + dt*0.6*(G.SETTINGS.SOUND.music_volume + 100)/200*(G.ARGS.score_intensity.organ) end},
  }

  for k, v in pairs(G.ARGS.ambient_sounds) do
    AC[k] = AC[k] or {}
    AC[k].per = (k == 'ambientOrgan1') and 0.7 or (k == 'ambientFire1' and 1.1) or (k == 'ambientFire2' and 1.05) or 1
    AC[k].vol = (not G.video_organ and G.STATE == G.STATES.SPLASH) and 0 or AC[k].vol and v.volfunc(AC[k].vol) or 0
  end

  G.ARGS.push = G.ARGS.push or {}
  G.ARGS.push.type = 'modulate'
  G.ARGS.push.pitch_mod = G.PITCH_MOD
  G.ARGS.push.state = G.STATE
  G.ARGS.push.time = G.TIMERS.REAL
  G.ARGS.push.dt = dt
  G.ARGS.push.desired_track = desired_track
  G.ARGS.push.sound_settings = G.SETTINGS.SOUND
  G.ARGS.push.splash_vol = G.SPLASH_VOL
  G.ARGS.push.overlay_menu = not (not G.OVERLAY_MENU)
  G.ARGS.push.ambient_control = G.SETTINGS.ambient_control

  if G.F_SOUND_THREAD then
    G.SOUND_MANAGER.channel:push(G.ARGS.push)
  else
    MODULATE(G.ARGS.push)
  end
end

function count_of_suit(area, suit)
  local num = 0
  for _,c in pairs(area.cards) do
    if c.base.suit == suit then
      num = num +1
    end
  end
  return num
end

function prep_draw(moveable, scale, rotate, offset)
    love.graphics.push()
    love.graphics.scale(G.TILESCALE*G.TILESIZE)
    love.graphics.translate(
      moveable.VT.x+moveable.VT.w/2 + (offset and offset.x or 0) + ((moveable.layered_parallax and moveable.layered_parallax.x) or ((moveable.parent and moveable.parent.layered_parallax and moveable.parent.layered_parallax.x)) or 0),
      moveable.VT.y+moveable.VT.h/2 + (offset and offset.y or 0) + ((moveable.layered_parallax and moveable.layered_parallax.y) or ((moveable.parent and moveable.parent.layered_parallax and moveable.parent.layered_parallax.y)) or 0))
    if moveable.VT.r ~= 0 or moveable.juice or rotate then love.graphics.rotate(moveable.VT.r + (rotate or 0)) end
    love.graphics.translate(
        -scale*moveable.VT.w*(moveable.VT.scale)/2,
        -scale*moveable.VT.h*(moveable.VT.scale)/2)
    love.graphics.scale(moveable.VT.scale*scale)
end

function get_chosen_triangle_from_rect(x, y, w, h, vert)
  local scale = 2
  if vert then 
    x = x + math.min(0.6*math.sin(G.TIMERS.REAL*9)*scale+0.2, 0)
    return {
      x-3.5*scale, y+h/2 - 1.5*scale,
      x-0.5*scale, y+h/2 + 0, 
      x-3.5*scale,y+h/2 + 1.5*scale
    }
  else
    y = y + math.min(0.6*math.sin(G.TIMERS.REAL*9)*scale+0.2, 0)
    return {
      x+w/2 - 1.5*scale, y-4*scale, 
      x+w/2 + 0, y-1.1*scale, 
      x+w/2 + 1.5*scale, y-4*scale
    }
  end
end

function point_translate(_T, delta)
  _T.x = (_T.x + delta.x) or 0
  _T.y = (_T.y + delta.y) or 0
end

function point_rotate(_T, angle)
  local _cos, _sin, _ox, _oy = math.cos(angle+math.pi/2), math.sin(angle+math.pi/2), _T.x , _T.y 
  _T.x = -_oy*_cos + _ox*_sin
  _T.y = _oy*_sin + _ox*_cos
end

function lighten(colour, percent, no_tab)
  if no_tab then 
    return 
    colour[1]*(1-percent)+percent,
    colour[2]*(1-percent)+percent,
    colour[3]*(1-percent)+percent,
    colour[4]
  end
  return {
    colour[1]*(1-percent)+percent,
    colour[2]*(1-percent)+percent,
    colour[3]*(1-percent)+percent,
    colour[4]
  }
end

function darken(colour, percent, no_tab)
  if no_tab then 
    return 
    colour[1]*(1-percent),
    colour[2]*(1-percent),
    colour[3]*(1-percent),
    colour[4]
  end
  return {
    colour[1]*(1-percent),
    colour[2]*(1-percent),
    colour[3]*(1-percent),
    colour[4]
  }
end

function adjust_alpha(colour, new_alpha, no_tab)
  if no_tab then 
    return 
    colour[1],
    colour[2],
    colour[3],
    new_alpha
  end
  return {
    colour[1],
    colour[2],
    colour[3],
    new_alpha
  }
end

function alert_no_space(card, area)
  G.CONTROLLER.locks.no_space = true
  attention_text({
      scale = 0.9, text = localize('k_no_space_ex'), hold = 0.9, align = 'cm',
      cover = area, cover_padding = 0.1, cover_colour = adjust_alpha(G.C.BLACK, 0.7)
  })
  card:juice_up(0.3, 0.2)
  for i = 1, #area.cards do
    area.cards[i]:juice_up(0.15)
  end
  G.E_MANAGER:add_event(Event({trigger = 'after', delay = 0.06*G.SETTINGS.GAMESPEED, blockable = false, blocking = false, func = function()
    play_sound('tarot2', 0.76, 0.4);return true end}))
    play_sound('tarot2', 1, 0.4)

    G.E_MANAGER:add_event(Event({trigger = 'after', delay = 0.5*G.SETTINGS.GAMESPEED, blockable = false, blocking = false,
    func = function()
      G.CONTROLLER.locks.no_space = nil
    return true end}))
end

function find_joker(name, non_debuff)
  local jokers = {}
  if not G.jokers or not G.jokers.cards then return {} end
  for k, v in pairs(G.jokers.cards) do
    if v and type(v) == 'table' and v.ability.name == name and (non_debuff or not v.debuff) then
      table.insert(jokers, v)
    end
  end
  for k, v in pairs(G.consumeables.cards) do
    if v and type(v) == 'table' and v.ability.name == name and (non_debuff or not v.debuff) then
      table.insert(jokers, v)
    end
  end
  return jokers
end

function get_blind_amount(ante)
  local k = 0.75
  if not G.GAME.modifiers.scaling or G.GAME.modifiers.scaling == 1 then 
    local amounts = {
      300,  800, 2000,  5000,  11000,  20000,   35000,  50000
    }
    if ante < 1 then return 100 end
    if ante <= 8 then return amounts[ante] end
    local a, b, c, d = amounts[8],1.6,ante-8, 1 + 0.2*(ante-8)
    local amount = math.floor(a*(b+(k*c)^d)^c)
    amount = amount - amount%(10^math.floor(math.log10(amount)-1))
    return amount
  elseif G.GAME.modifiers.scaling == 2 then 
    local amounts = {
      300,  900, 2600,  8000,  20000,  36000,  60000,  100000
      --300,  900, 2400,  7000,  18000,  32000,  56000,  90000
    }
    if ante < 1 then return 100 end
    if ante <= 8 then return amounts[ante] end
    local a, b, c, d = amounts[8],1.6,ante-8, 1 + 0.2*(ante-8)
    local amount = math.floor(a*(b+(k*c)^d)^c)
    amount = amount - amount%(10^math.floor(math.log10(amount)-1))
    return amount
  elseif G.GAME.modifiers.scaling == 3 then 
    local amounts = {
      300,  1000, 3200,  9000,  25000,  60000,  110000,  200000
      --300,  1000, 3000,  8000,  22000,  50000,  90000,  180000
    }
    if ante < 1 then return 100 end
    if ante <= 8 then return amounts[ante] end
    local a, b, c, d = amounts[8],1.6,ante-8, 1 + 0.2*(ante-8)
    local amount = math.floor(a*(b+(k*c)^d)^c)
    amount = amount - amount%(10^math.floor(math.log10(amount)-1))
    return amount
  end
end

function number_format(num)
  G.E_SWITCH_POINT = G.E_SWITCH_POINT or 100000000000
  if not num or type(num) ~= 'number' then return num or '' end
  if num >= G.E_SWITCH_POINT then
    local x = string.format("%.4g",num)
    local fac = math.floor(math.log(tonumber(x), 10))
    return string.format("%.3f",x/(10^fac))..'e'..fac
  end
  return string.format(num ~= math.floor(num) and (num >= 100 and "%.0f" or num >= 10 and "%.1f" or "%.2f") or "%.0f", num):reverse():gsub("(%d%d%d)", "%1,"):gsub(",$", ""):reverse()
end

function score_number_scale(scale, amt)
  G.E_SWITCH_POINT = G.E_SWITCH_POINT or 100000000000
  if type(amt) ~= 'number' then return 0.7*(scale or 1) end
  if amt >= G.E_SWITCH_POINT then
    return 0.7*(scale or 1)
  elseif amt >= 1000000 then
    return 14*0.75/(math.floor(math.log(amt))+4)*(scale or 1)
  else
      return 0.75*(scale or 1)
  end
end

function copy_table(O)
  local O_type = type(O)
  local copy
  if O_type == 'table' then
      copy = {}
      for k, v in next, O, nil do
          copy[copy_table(k)] = copy_table(v)
      end
      setmetatable(copy, copy_table(getmetatable(O)))
  else
      copy = O
  end
  return copy
end

function send_score(_score)
  if G.F_HTTP_SCORES and G.SETTINGS.COMP and G.F_STREAMER_EVENT then
    G.HTTP_MANAGER.out_channel:push({
        set_score = true,
        score = _score,
        username = G.SETTINGS.COMP.name,
        uid = tostring(G.STEAM.user.getSteamID()),
        version = G.VERSION
    })
  end
end

function send_name()
  if G.F_HTTP_SCORES and G.SETTINGS.COMP and G.F_STREAMER_EVENT then
    G.HTTP_MANAGER.out_channel:push({
        set_name = true,
        username = G.SETTINGS.COMP.name,
        uid = tostring(G.STEAM.user.getSteamID()),
        version = G.VERSION
    })
  end
end

function check_and_set_high_score(score, amt)
  if not amt or type(amt) ~= 'number' then return end
  if G.GAME.round_scores[score] and math.floor(amt) > G.GAME.round_scores[score].amt then
    G.GAME.round_scores[score].amt = math.floor(amt)
  end
  if  G.GAME.seeded  then return end
  if score == 'hand' and G.SETTINGS.COMP and ((not G.SETTINGS.COMP.score) or (G.SETTINGS.COMP.score < math.floor(amt))) then 
    G.SETTINGS.COMP.score = amt
    send_score(math.floor(amt))
  end
  if G.PROFILES[G.SETTINGS.profile].high_scores[score] and math.floor(amt) > G.PROFILES[G.SETTINGS.profile].high_scores[score].amt then
    if G.GAME.round_scores[score] then G.GAME.round_scores[score].high_score = true end
    G.PROFILES[G.SETTINGS.profile].high_scores[score].amt = math.floor(amt)
    G:save_settings()
  end
end

function set_joker_usage()
  for k, v in pairs(G.jokers.cards) do
    if v.config.center_key and v.ability.set == 'Joker' then
      if G.PROFILES[G.SETTINGS.profile].joker_usage[v.config.center_key] then
        G.PROFILES[G.SETTINGS.profile].joker_usage[v.config.center_key].count = G.PROFILES[G.SETTINGS.profile].joker_usage[v.config.center_key].count + 1
      else
        G.PROFILES[G.SETTINGS.profile].joker_usage[v.config.center_key] = {count = 1, order = v.config.center.order, wins = {}, losses = {}}
      end
    end
  end
  G:save_settings()
end

function set_joker_win()
  for k, v in pairs(G.jokers.cards) do
    if v.config.center_key and v.ability.set == 'Joker' then
      G.PROFILES[G.SETTINGS.profile].joker_usage[v.config.center_key] = G.PROFILES[G.SETTINGS.profile].joker_usage[v.config.center_key] or {count = 1, order = v.config.center.order, wins = {}, losses = {}}
      if G.PROFILES[G.SETTINGS.profile].joker_usage[v.config.center_key] then
        G.PROFILES[G.SETTINGS.profile].joker_usage[v.config.center_key].wins = G.PROFILES[G.SETTINGS.profile].joker_usage[v.config.center_key].wins or {}
        G.PROFILES[G.SETTINGS.profile].joker_usage[v.config.center_key].wins[G.GAME.stake] = (G.PROFILES[G.SETTINGS.profile].joker_usage[v.config.center_key].wins[G.GAME.stake] or 0) + 1
      end
    end
  end
  G:save_settings()
end

function get_joker_win_sticker(_center, index)
  if G.PROFILES[G.SETTINGS.profile].joker_usage[_center.key] and
  G.PROFILES[G.SETTINGS.profile].joker_usage[_center.key].wins then 
    local _w = 0
    for k, v in pairs(G.PROFILES[G.SETTINGS.profile].joker_usage[_center.key].wins) do
      _w = math.max(k, _w)
    end
    if index then return _w end
    if _w > 0 then return G.sticker_map[_w] end
  end
  if index then return 0 end
end

function set_joker_loss()
  for k, v in pairs(G.jokers.cards) do
    if v.config.center_key and v.ability.set == 'Joker' then
      if G.PROFILES[G.SETTINGS.profile].joker_usage[v.config.center_key] then
        G.PROFILES[G.SETTINGS.profile].joker_usage[v.config.center_key].losses = G.PROFILES[G.SETTINGS.profile].joker_usage[v.config.center_key].losses or {}
        G.PROFILES[G.SETTINGS.profile].joker_usage[v.config.center_key].losses[G.GAME.stake] = (G.PROFILES[G.SETTINGS.profile].joker_usage[v.config.center_key].losses[G.GAME.stake] or 0) + 1
      end
    end
  end
  G:save_settings()
end

function set_deck_usage()
  if G.GAME.selected_back and G.GAME.selected_back.effect and G.GAME.selected_back.effect.center and G.GAME.selected_back.effect.center.key then
    local deck_key = G.GAME.selected_back.effect.center.key
    if G.PROFILES[G.SETTINGS.profile].deck_usage[deck_key] then
      G.PROFILES[G.SETTINGS.profile].deck_usage[deck_key].count = G.PROFILES[G.SETTINGS.profile].deck_usage[deck_key].count + 1
    else
      G.PROFILES[G.SETTINGS.profile].deck_usage[deck_key] = {count = 1, order = G.GAME.selected_back.effect.center.order, wins = {}, losses = {}}
    end
    G:save_settings()
  end
end

function set_deck_win()
  if G.GAME.selected_back and G.GAME.selected_back.effect and G.GAME.selected_back.effect.center and G.GAME.selected_back.effect.center.key then
    local deck_key = G.GAME.selected_back.effect.center.key
    if not G.PROFILES[G.SETTINGS.profile].deck_usage[deck_key] then G.PROFILES[G.SETTINGS.profile].deck_usage[deck_key] = {count = 1, order = G.GAME.selected_back.effect.center.order, wins = {}, losses = {}} end
    if G.PROFILES[G.SETTINGS.profile].deck_usage[deck_key] then
      G.PROFILES[G.SETTINGS.profile].deck_usage[deck_key].wins[G.GAME.stake] = (G.PROFILES[G.SETTINGS.profile].deck_usage[deck_key].wins[G.GAME.stake] or 0) + 1
      for i = 1, G.GAME.stake do
        G.PROFILES[G.SETTINGS.profile].deck_usage[deck_key].wins[i] = (G.PROFILES[G.SETTINGS.profile].deck_usage[deck_key].wins[i] or 1)
      end
    end
    set_challenge_unlock()
    G:save_settings()
  end
end

function set_challenge_unlock()
  if G.PROFILES[G.SETTINGS.profile].all_unlocked then return end
  if G.PROFILES[G.SETTINGS.profile].challenges_unlocked then
    local _ch_comp, _ch_tot = 0,#G.CHALLENGES
    for k, v in ipairs(G.CHALLENGES) do
      if v.id and G.PROFILES[G.SETTINGS.profile].challenge_progress.completed[v.id or ''] then
        _ch_comp = _ch_comp + 1
      end
    end
    G.PROFILES[G.SETTINGS.profile].challenges_unlocked = math.min(_ch_tot, _ch_comp+5)
  else
    local deck_wins = 0
    for k, v in pairs(G.PROFILES[G.SETTINGS.profile].deck_usage) do
      if v.wins and v.wins[1] then
        deck_wins = deck_wins + 1
      end
    end
    if deck_wins >= G.CHALLENGE_WINS and not G.PROFILES[G.SETTINGS.profile].challenges_unlocked then
      G.PROFILES[G.SETTINGS.profile].challenges_unlocked = 5
      notify_alert('b_challenge', "Back")
    end
  end
end

function get_deck_win_stake(_deck_key)
  if not _deck_key then 
    local _w, _w_low = 0, nil
    local deck_count = 0
    for _, deck in pairs(G.PROFILES[G.SETTINGS.profile].deck_usage) do 
      local deck_won_with = nil
      for k, v in pairs(deck.wins) do
        deck_won_with = true
        _w = math.max(k, _w)
      end
      if deck_won_with then deck_count = deck_count + 1 end
      _w_low = _w_low and (math.min(_w_low, _w)) or _w
    end
    return _w, ((deck_count >= #G.P_CENTER_POOLS.Back) and _w_low or 0)
  end
  if G.PROFILES[G.SETTINGS.profile].deck_usage[_deck_key] and
     G.PROFILES[G.SETTINGS.profile].deck_usage[_deck_key].wins then 
    local _w = 0
    for k, v in pairs(G.PROFILES[G.SETTINGS.profile].deck_usage[_deck_key].wins) do
      _w = math.max(k, _w)
    end
    return _w
  end
  return 0
end

function get_deck_win_sticker(_center)
  if G.PROFILES[G.SETTINGS.profile].deck_usage[_center.key] and
  G.PROFILES[G.SETTINGS.profile].deck_usage[_center.key].wins then 
    local _w = -1
    for k, v in pairs(G.PROFILES[G.SETTINGS.profile].deck_usage[_center.key].wins) do
      _w = math.max(k, _w)
    end
    if _w > 0 then return G.sticker_map[_w] end
  end
end

function set_deck_loss()
  if G.GAME.selected_back and G.GAME.selected_back.effect and G.GAME.selected_back.effect.center and G.GAME.selected_back.effect.center.key then
    local deck_key = G.GAME.selected_back.effect.center.key
    if not G.PROFILES[G.SETTINGS.profile].deck_usage[deck_key] then G.PROFILES[G.SETTINGS.profile].deck_usage[deck_key] = {count = 1, order = G.GAME.selected_back.effect.center.order, wins = {}, losses = {}} end
    if G.PROFILES[G.SETTINGS.profile].deck_usage[deck_key] then
      G.PROFILES[G.SETTINGS.profile].deck_usage[deck_key].losses[G.GAME.stake] = (G.PROFILES[G.SETTINGS.profile].deck_usage[deck_key].losses[G.GAME.stake] or 0) + 1
    end
    G:save_settings()
  end
end

function set_consumeable_usage(card)
    if card.config.center_key and card.ability.consumeable then
      if G.PROFILES[G.SETTINGS.profile].consumeable_usage[card.config.center_key] then
        G.PROFILES[G.SETTINGS.profile].consumeable_usage[card.config.center_key].count = G.PROFILES[G.SETTINGS.profile].consumeable_usage[card.config.center_key].count + 1
      else
        G.PROFILES[G.SETTINGS.profile].consumeable_usage[card.config.center_key] = {count = 1, order = card.config.center.order}
      end
      if G.GAME.consumeable_usage[card.config.center_key] then
        G.GAME.consumeable_usage[card.config.center_key].count = G.GAME.consumeable_usage[card.config.center_key].count + 1
      else
        G.GAME.consumeable_usage[card.config.center_key] = {count = 1, order = card.config.center.order, set = card.ability.set}
      end
      G.GAME.consumeable_usage_total = G.GAME.consumeable_usage_total or {tarot = 0, planet = 0, spectral = 0, tarot_planet = 0, all = 0}
      if card.config.center.set == 'Tarot' then
        G.GAME.consumeable_usage_total.tarot = G.GAME.consumeable_usage_total.tarot + 1  
        G.GAME.consumeable_usage_total.tarot_planet = G.GAME.consumeable_usage_total.tarot_planet + 1
      elseif card.config.center.set == 'Planet' then
        G.GAME.consumeable_usage_total.planet = G.GAME.consumeable_usage_total.planet + 1
        G.GAME.consumeable_usage_total.tarot_planet = G.GAME.consumeable_usage_total.tarot_planet + 1
      elseif card.config.center.set == 'Spectral' then  G.GAME.consumeable_usage_total.spectral = G.GAME.consumeable_usage_total.spectral + 1
      end

      G.GAME.consumeable_usage_total.all = G.GAME.consumeable_usage_total.all + 1

      if not card.config.center.discovered then
        discover_card(card)
      end

      if card.config.center.set == 'Tarot' or card.config.center.set == 'Planet' then 
        G.E_MANAGER:add_event(Event({
          trigger = 'immediate',
          func = function()
            G.E_MANAGER:add_event(Event({
              trigger = 'immediate',
              func = function()
                G.GAME.last_tarot_planet = card.config.center_key
                  return true
              end
            }))
              return true
          end
        }))
      end

    end
    G:save_settings()
end

function set_voucher_usage(card)
  if card.config.center_key and card.ability.set == 'Voucher' then
    if G.PROFILES[G.SETTINGS.profile].voucher_usage[card.config.center_key] then
      G.PROFILES[G.SETTINGS.profile].voucher_usage[card.config.center_key].count = G.PROFILES[G.SETTINGS.profile].voucher_usage[card.config.center_key].count + 1
    else
      G.PROFILES[G.SETTINGS.profile].voucher_usage[card.config.center_key] = {count = 1, order = card.config.center.order}
    end
  end
  G:save_settings()
end

function set_hand_usage(hand)
  local hand_label = hand
  hand = hand:gsub("%s+", "")
  if G.PROFILES[G.SETTINGS.profile].hand_usage[hand] then
    G.PROFILES[G.SETTINGS.profile].hand_usage[hand].count = G.PROFILES[G.SETTINGS.profile].hand_usage[hand].count + 1
  else
    G.PROFILES[G.SETTINGS.profile].hand_usage[hand] = {count = 1, order = hand_label}
  end
  if G.GAME.hand_usage[hand] then
    G.GAME.hand_usage[hand].count = G.GAME.hand_usage[hand].count + 1
  else
    G.GAME.hand_usage[hand] = {count = 1, order = hand_label}
  end
  G:save_settings()
end

function set_profile_progress()
  G.PROGRESS = G.PROGRESS or {
    joker_stickers = {tally = 0, of = 0},
    deck_stakes = {tally = 0, of = 0},
    challenges = {tally = 0, of = 0},
  }
  for _, v in pairs(G.PROGRESS) do
    if type(v) == 'table' then
      v.tally = 0
      v.of = 0
    end
  end

  for _, v in pairs(G.P_CENTERS) do
    if v.set == 'Back' and not v.omit then
      G.PROGRESS.deck_stakes.of = G.PROGRESS.deck_stakes.of + #G.P_CENTER_POOLS.Stake
      G.PROGRESS.deck_stakes.tally = G.PROGRESS.deck_stakes.tally + get_deck_win_stake(v.key)
    end
    if v.set == 'Joker' then 
      G.PROGRESS.joker_stickers.of = G.PROGRESS.joker_stickers.of + #G.P_CENTER_POOLS.Stake
      G.PROGRESS.joker_stickers.tally = G.PROGRESS.joker_stickers.tally + get_joker_win_sticker(v, true)
    end
  end

  for _, v in pairs(G.CHALLENGES) do
    G.PROGRESS.challenges.of = G.PROGRESS.challenges.of + 1
    if G.PROFILES[G.SETTINGS.profile].challenge_progress.completed[v.id] then
      G.PROGRESS.challenges.tally = G.PROGRESS.challenges.tally + 1
    end
  end

  G.PROFILES[G.SETTINGS.profile].progress.joker_stickers = copy_table(G.PROGRESS.joker_stickers)
  G.PROFILES[G.SETTINGS.profile].progress.deck_stakes = copy_table(G.PROGRESS.deck_stakes)
  G.PROFILES[G.SETTINGS.profile].progress.challenges = copy_table(G.PROGRESS.challenges)
end

function set_discover_tallies()
  G.DISCOVER_TALLIES = G.DISCOVER_TALLIES or {
      blinds = {tally = 0, of = 0},
      tags = {tally = 0, of = 0},
      jokers = {tally = 0, of = 0},
      consumeables = {tally = 0, of = 0},
      tarots = {tally = 0, of = 0},
      planets = {tally = 0, of = 0},
      spectrals = {tally = 0, of = 0},
      vouchers = {tally = 0, of = 0},
      boosters = {tally = 0, of = 0},
      editions = {tally = 0, of = 0},
      backs = {tally = 0, of = 0},
      total = {tally = 0, of = 0},
    }
  for _, v in pairs(G.DISCOVER_TALLIES) do
      v.tally = 0
      v.of = 0
  end
  
  for _, v in pairs(G.P_CENTERS) do
    if not v.omit then 
      if v.set and ((v.set == 'Joker') or v.consumeable or (v.set == 'Edition') or (v.set == 'Voucher') or (v.set == 'Back') or (v.set == 'Booster')) then
        G.DISCOVER_TALLIES.total.of = G.DISCOVER_TALLIES.total.of+1
        if v.discovered then 
          G.DISCOVER_TALLIES.total.tally = G.DISCOVER_TALLIES.total.tally+1
        end
      end
      if v.set and v.set == 'Joker' then
        G.DISCOVER_TALLIES.jokers.of = G.DISCOVER_TALLIES.jokers.of+1
        if v.discovered then 
            G.DISCOVER_TALLIES.jokers.tally = G.DISCOVER_TALLIES.jokers.tally+1
        end
      end
      if v.set and v.set == 'Back' then
        G.DISCOVER_TALLIES.backs.of = G.DISCOVER_TALLIES.backs.of+1
        if v.unlocked then 
            G.DISCOVER_TALLIES.backs.tally = G.DISCOVER_TALLIES.backs.tally+1
        end
      end
      if v.set and v.consumeable then
        G.DISCOVER_TALLIES.consumeables.of = G.DISCOVER_TALLIES.consumeables.of+1
        if v.discovered then 
            G.DISCOVER_TALLIES.consumeables.tally = G.DISCOVER_TALLIES.consumeables.tally+1
        end
        if v.set == 'Planet' then
          G.DISCOVER_TALLIES.planets.of = G.DISCOVER_TALLIES.planets.of+1
          if v.discovered then 
              G.DISCOVER_TALLIES.planets.tally = G.DISCOVER_TALLIES.planets.tally+1
          end
        elseif v.set == 'Spectral' then
          G.DISCOVER_TALLIES.spectrals.of = G.DISCOVER_TALLIES.spectrals.of+1
          if v.discovered then 
              G.DISCOVER_TALLIES.spectrals.tally = G.DISCOVER_TALLIES.spectrals.tally+1
          end
        elseif v.set == 'Tarot' then
          G.DISCOVER_TALLIES.tarots.of = G.DISCOVER_TALLIES.tarots.of+1
          if v.discovered then 
              G.DISCOVER_TALLIES.tarots.tally = G.DISCOVER_TALLIES.tarots.tally+1
          end
        end
      end
      if v.set and v.set == 'Voucher' then
        G.DISCOVER_TALLIES.vouchers.of = G.DISCOVER_TALLIES.vouchers.of+1
        if v.discovered then 
            G.DISCOVER_TALLIES.vouchers.tally = G.DISCOVER_TALLIES.vouchers.tally+1
        end
      end
      if v.set and v.set == 'Booster' then
        G.DISCOVER_TALLIES.boosters.of = G.DISCOVER_TALLIES.boosters.of+1
        if v.discovered then 
            G.DISCOVER_TALLIES.boosters.tally = G.DISCOVER_TALLIES.boosters.tally+1
        end
      end
      if v.set and v.set == 'Edition' then
        G.DISCOVER_TALLIES.editions.of = G.DISCOVER_TALLIES.editions.of+1
        if v.discovered then 
            G.DISCOVER_TALLIES.editions.tally = G.DISCOVER_TALLIES.editions.tally+1
        end
      end
    end
  end
  for _, v in pairs(G.P_BLINDS) do
      G.DISCOVER_TALLIES.total.of = G.DISCOVER_TALLIES.total.of+1
      G.DISCOVER_TALLIES.blinds.of = G.DISCOVER_TALLIES.blinds.of+1
      if v.discovered then 
          G.DISCOVER_TALLIES.blinds.tally = G.DISCOVER_TALLIES.blinds.tally+1
          G.DISCOVER_TALLIES.total.tally = G.DISCOVER_TALLIES.total.tally+1
      end
  end
  for _, v in pairs(G.P_TAGS) do
    G.DISCOVER_TALLIES.total.of = G.DISCOVER_TALLIES.total.of+1
    G.DISCOVER_TALLIES.tags.of = G.DISCOVER_TALLIES.tags.of+1
    if v.discovered then 
        G.DISCOVER_TALLIES.tags.tally = G.DISCOVER_TALLIES.tags.tally+1
        G.DISCOVER_TALLIES.total.tally = G.DISCOVER_TALLIES.total.tally+1
    end
  end
  G.PROFILES[G.SETTINGS.profile].high_scores.collection.amt = G.DISCOVER_TALLIES.total.tally
  G.PROFILES[G.SETTINGS.profile].high_scores.collection.tot = G.DISCOVER_TALLIES.total.of
  G.PROFILES[G.SETTINGS.profile].progress.discovered = copy_table(G.DISCOVER_TALLIES.total)

  if check_for_unlock then check_for_unlock({type = 'discover_amount',
        amount = G.DISCOVER_TALLIES.total.tally,
        planet_count = G.DISCOVER_TALLIES.planets.tally,
        tarot_count = G.DISCOVER_TALLIES.tarots.tally})
  end
end

function stop_use()
  G.GAME.STOP_USE = (G.GAME.STOP_USE or 0) + 1
  dec_stop_use(6)
end

function dec_stop_use(_depth)
  if _depth > 0 then 
  G.E_MANAGER:add_event(Event({
    blocking = false,
    no_delete = true,
    func = (function()
    dec_stop_use(_depth - 1)
  return true end)}))
  else
    G.E_MANAGER:add_event(Event({
      blocking = false,
      no_delete = true,
      func = (function()
      G.GAME.STOP_USE = math.max(G.GAME.STOP_USE - 1, 0)
    return true end)}))
  end
end

function inc_career_stat(stat, mod)
  if G.GAME.seeded or G.GAME.challenge then return end
  if not G.PROFILES[G.SETTINGS.profile].career_stats[stat] then G.PROFILES[G.SETTINGS.profile].career_stats[stat] = 0 end
  G.PROFILES[G.SETTINGS.profile].career_stats[stat] = G.PROFILES[G.SETTINGS.profile].career_stats[stat] + (mod or 0)
  G:save_settings()
end

function recursive_table_cull(t)
  local ret_t = {}
  for k, v in pairs(t) do 
      if type(v) == 'table' then
          if v.is and v:is(Object) then ret_t[k] = [["]].."MANUAL_REPLACE"..[["]] 
          else ret_t[k] = recursive_table_cull(v)
          end
      else ret_t[k] = v end
  end
  return ret_t
end

function save_with_action(action)
  G.action = action
  save_run()
  G.action = nil
end

function save_run()
  if G.F_NO_SAVING == true then return end
  local cardAreas = {}
  for k, v in pairs(G) do
    if (type(v) == "table") and v.is and v:is(CardArea) then 
      local cardAreaSer = v:save()
      if cardAreaSer then cardAreas[k] = cardAreaSer end
    end
  end

  local tags = {}
  for k, v in ipairs(G.GAME.tags) do
    if (type(v) == "table") and v.is and v:is(Tag) then 
      local tagSer = v:save()
      if tagSer then tags[k] = tagSer end
    end
  end

  G.culled_table =  recursive_table_cull{
    cardAreas = cardAreas,
    tags = tags,
    GAME = G.GAME,
    STATE = G.STATE,
    ACTION = G.action or nil,
    BLIND = G.GAME.blind:save(),
    BACK = G.GAME.selected_back:save(),
    VERSION = G.VERSION
  }
  G.ARGS.save_run = G.culled_table

  G.FILE_HANDLER = G.FILE_HANDLER or {}
  G.FILE_HANDLER.run = true
  G.FILE_HANDLER.update_queued = true
end

function remove_save()
  love.filesystem.remove(G.SETTINGS.profile..'/save.jkr')
  G.SAVED_GAME = nil
  G.FILE_HANDLER.run = nil
end

function loc_colour(_c, _default)
  G.ARGS.LOC_COLOURS = G.ARGS.LOC_COLOURS or {
    red = G.C.RED,
    mult = G.C.MULT,
    blue = G.C.BLUE,
    chips = G.C.CHIPS,
    green = G.C.GREEN,
    money = G.C.MONEY,
    gold = G.C.GOLD,
    attention = G.C.FILTER,
    purple = G.C.PURPLE,
    white = G.C.WHITE,
    inactive = G.C.UI.TEXT_INACTIVE,
    spades = G.C.SUITS.Spades,
    hearts = G.C.SUITS.Hearts,
    clubs = G.C.SUITS.Clubs,
    diamonds = G.C.SUITS.Diamonds,
    tarot = G.C.SECONDARY_SET.Tarot,
    planet = G.C.SECONDARY_SET.Planet,
    spectral = G.C.SECONDARY_SET.Spectral,
    edition = G.C.EDITION,
    dark_edition = G.C.DARK_EDITION,
    legendary = G.C.RARITY[4],
    enhanced = G.C.SECONDARY_SET.Enhanced
  }
  return G.ARGS.LOC_COLOURS[_c] or _default or G.C.UI.TEXT_DARK
end

function init_localization()
  G.localization.misc.v_dictionary_parsed = {}
  for k, v in pairs(G.localization.misc.v_dictionary) do
    if type(v) == 'table' then
      G.localization.misc.v_dictionary_parsed[k] = {multi_line = true}
      for kk, vv in ipairs(v) do
        G.localization.misc.v_dictionary_parsed[k][kk] = loc_parse_string(vv)
      end
    else
      G.localization.misc.v_dictionary_parsed[k] = loc_parse_string(v)
    end
  end
  G.localization.misc.v_text_parsed = {}
  for k, v in pairs(G.localization.misc.v_text) do
    G.localization.misc.v_text_parsed[k] = {}
    for kk, vv in ipairs(v) do
      G.localization.misc.v_text_parsed[k][kk] = loc_parse_string(vv)
    end
  end
  G.localization.tutorial_parsed = {}
  for k, v in pairs(G.localization.misc.tutorial) do
    G.localization.tutorial_parsed[k] = {multi_line = true}
      for kk, vv in ipairs(v) do
        G.localization.tutorial_parsed[k][kk] = loc_parse_string(vv)
      end
  end
  G.localization.quips_parsed = {}
  for k, v in pairs(G.localization.misc.quips or {}) do
    G.localization.quips_parsed[k] = {multi_line = true}
      for kk, vv in ipairs(v) do
        G.localization.quips_parsed[k][kk] = loc_parse_string(vv)
      end
  end
  for g_k, group in pairs(G.localization) do
    if g_k == 'descriptions' then
      for _, set in pairs(group) do
        for _, center in pairs(set) do
          center.text_parsed = {}
          if not center.text then else
          for _, line in ipairs(center.text) do
            center.text_parsed[#center.text_parsed+1] = loc_parse_string(line)
          end
          center.name_parsed = {}
          for _, line in ipairs(type(center.name) == 'table' and center.name or {center.name}) do
            center.name_parsed[#center.name_parsed+1] = loc_parse_string(line)
          end
          if center.unlock then
            center.unlock_parsed = {}
            for _, line in ipairs(center.unlock) do
              center.unlock_parsed[#center.unlock_parsed+1] = loc_parse_string(line)
            end
          end
        end
        end
      end
    end
  end
end

function playing_card_joker_effects(cards)
  for i = 1, #G.jokers.cards do
    G.jokers.cards[i]:calculate_joker({playing_card_added = true, cards = cards})
  end
end

function convert_save_to_meta()
  if love.filesystem.getInfo(G.SETTINGS.profile..'/'..'unlocked_jokers.jkr') then 
    local _meta = {
      unlocked = {},
      alerted = {},
      discovered = {}
    }
    if love.filesystem.getInfo(G.SETTINGS.profile..'/'..'unlocked_jokers.jkr') then
      for line in string.gmatch( (get_compressed(G.SETTINGS.profile..'/'..'unlocked_jokers.jkr') or '').. "\n", "([^\n]*)\n") do
        local key = line:gsub("%s+", "")
        if key and (key ~= '') then 
          _meta.unlocked[key] = true
        end
      end
    end
    if love.filesystem.getInfo(G.SETTINGS.profile..'/'..'discovered_jokers.jkr') then
      for line in string.gmatch( (get_compressed(G.SETTINGS.profile..'/'..'discovered_jokers.jkr') or '').. "\n", "([^\n]*)\n") do
        local key = line:gsub("%s+", "")
        if key and (key ~= '') then 
          _meta.discovered[key] = true
        end
      end
    end
    if love.filesystem.getInfo(G.SETTINGS.profile..'/'..'alerted_jokers.jkr') then
      for line in string.gmatch( (get_compressed(G.SETTINGS.profile..'/'..'alerted_jokers.jkr') or '').. "\n", "([^\n]*)\n") do
        local key = line:gsub("%s+", "")
        if key and (key ~= '') then 
          _meta.alerted[key] = true
        end
      end
    end
    love.filesystem.remove(G.SETTINGS.profile..'/'..'unlocked_jokers.jkr')
    love.filesystem.remove(G.SETTINGS.profile..'/'..'discovered_jokers.jkr')
    love.filesystem.remove(G.SETTINGS.profile..'/'..'alerted_jokers.jkr')

    compress_and_save( G.SETTINGS.profile..'/'..'meta.jkr', STR_PACK(_meta))
  end
end

function card_from_control(control)
  G.playing_card = (G.playing_card and G.playing_card + 1) or 1
  local _card = Card(G.deck.T.x, G.deck.T.y, G.CARD_W, G.CARD_H, G.P_CARDS[control.s..'_'..control.r], G.P_CENTERS[control.e or 'c_base'], {playing_card = G.playing_card})
  if control.d then _card:set_edition({[control.d] = true}, true, true) end
  if control.g then _card:set_seal(control.g, true, true) end
  G.deck:emplace(_card)
  table.insert(G.playing_cards, _card)
end

function loc_parse_string(line)
  local parsed_line = {}
  local control = {}
  local _c, _c_name, _c_val, _c_gather = nil, nil, nil, nil
  local _s_gather, _s_ref = nil, nil
  local str_parts, str_it = {}, 1
  for i = 1, #line do
      local char = line:sub(i,i)
      if char == '{' then --Start of a control section, extract all controls
        if str_parts[1] then parsed_line[#parsed_line+1] = {strings = str_parts, control = control or {}} end
        str_parts, str_it = {}, 1
        control, _c, _c_name, _c_val, _c_gather = {}, nil, nil, nil, nil
        _s_gather, _s_ref = nil, nil
        _c = true
      elseif _c and not (char == ':' or char == '}') and not _c_gather then _c_name = (_c_name or '')..char
      elseif _c and char == ':' then _c_gather = true
      elseif _c and not (char == ',' or char == '}') and _c_gather then _c_val = (_c_val or '')..char
      elseif _c and (char == ',' or char == '}') then _c_gather = nil; if _c_name then control[_c_name] = _c_val end; _c_name = nil; _c_val = nil; if char == '}' then _c = nil end

      elseif not _c and char ~= '#' and not _s_gather then str_parts[str_it] = (str_parts[str_it] or '')..(control['X'] and char:gsub("%s+", "") or char)
      elseif not _c and char == '#' and not _s_gather then _s_gather = true; if str_parts[str_it] then str_it = str_it + 1 end
      elseif not _c and char == '#' and _s_gather then _s_gather = nil; if _s_ref then str_parts[str_it] = {_s_ref}; str_it = str_it + 1; _s_ref = nil end
      elseif not _c and _s_gather then _s_ref = (_s_ref or '')..char
      end
      if i == #line then
        if str_parts[1] then parsed_line[#parsed_line+1] = {strings = str_parts, control = control or {}} end
        return parsed_line
      end
  end
end

--UTF8 handler for special characters, from https://github.com/blitmap/lua-utf8-simple
utf8 = {pattern = '[%z\1-\127\194-\244][\128-\191]*'}
utf8.map =
	function (s, f, no_subs)
		local i = 0

		if no_subs then
			for b, e in s:gmatch('()' .. utf8.pattern .. '()') do
				i = i + 1
				local c = e - b
				f(i, c, b)
			end
		else
			for b, c in s:gmatch('()(' .. utf8.pattern .. ')') do
				i = i + 1
				f(i, c, b)
			end
		end
	end
utf8.chars =
	function (s, no_subs)
		return coroutine.wrap(function () return utf8.map(s, coroutine.yield, no_subs) end)
	end

function localize(args, misc_cat)
  if args and not (type(args) == 'table') then
    if misc_cat and G.localization.misc[misc_cat] then return G.localization.misc[misc_cat][args] or 'ERROR' end
    return G.localization.misc.dictionary[args] or 'ERROR'
  end

  local loc_target = nil
  local ret_string = nil
  if args.type == 'other' then
    loc_target = G.localization.descriptions.Other[args.key]
  elseif args.type == 'descriptions' or args.type == 'unlocks' then 
    loc_target = G.localization.descriptions[args.set][args.key]
  elseif args.type == 'tutorial' then 
    loc_target = G.localization.tutorial_parsed[args.key]
  elseif args.type == 'quips' then 
    loc_target = G.localization.quips_parsed[args.key]
  elseif args.type == 'raw_descriptions' then 
    loc_target = G.localization.descriptions[args.set][args.key]
    local multi_line = {}
    if loc_target then 
      for _, lines in ipairs(args.type == 'unlocks' and loc_target.unlock_parsed or args.type == 'name' and loc_target.name_parsed or args.type == 'text' and loc_target or loc_target.text_parsed) do
        local final_line = ''
        for _, part in ipairs(lines) do
          local assembled_string = ''
          for _, subpart in ipairs(part.strings) do
            assembled_string = assembled_string..(type(subpart) == 'string' and subpart or args.vars[tonumber(subpart[1])] or 'ERROR')
          end
          final_line = final_line..assembled_string
        end
        multi_line[#multi_line+1] = final_line
      end
    end
    return multi_line
  elseif args.type == 'text' then
    loc_target = G.localization.misc.v_text_parsed[args.key]
  elseif args.type == 'variable' then 
    loc_target = G.localization.misc.v_dictionary_parsed[args.key]
    if not loc_target then return 'ERROR' end 
    if loc_target.multi_line then
      local assembled_strings = {}
      for k, v in ipairs(loc_target) do
        local assembled_string = ''
        for _, subpart in ipairs(v[1].strings) do
          assembled_string = assembled_string..(type(subpart) == 'string' and subpart or args.vars[tonumber(subpart[1])])
        end
        assembled_strings[k] = assembled_string
      end
      return assembled_strings or {'ERROR'}
    else
      local assembled_string = ''
      for _, subpart in ipairs(loc_target[1].strings) do
        assembled_string = assembled_string..(type(subpart) == 'string' and subpart or args.vars[tonumber(subpart[1])])
      end
      ret_string = assembled_string or 'ERROR'
    end
  elseif args.type == 'name_text' then
    if pcall(function() ret_string = G.localization.descriptions[(args.set or args.node.config.center.set)][args.key or args.node.config.center.key].name end) then
    else ret_string = "ERROR" end
  elseif args.type == 'name' then
    loc_target = G.localization.descriptions[(args.set or args.node.config.center.set)][args.key or args.node.config.center.key]
  end

  if ret_string then return ret_string end

  if loc_target then 
    for _, lines in ipairs(args.type == 'unlocks' and loc_target.unlock_parsed or args.type == 'name' and loc_target.name_parsed or (args.type == 'text' or args.type == 'tutorial' or args.type == 'quips') and loc_target or loc_target.text_parsed) do
      local final_line = {}
      for _, part in ipairs(lines) do
        local assembled_string = ''
        for _, subpart in ipairs(part.strings) do
          assembled_string = assembled_string..(type(subpart) == 'string' and subpart or args.vars[tonumber(subpart[1])] or 'ERROR')
        end
        local desc_scale = G.LANG.font.DESCSCALE
        if G.F_MOBILE_UI then desc_scale = desc_scale*1.5 end
        if args.type == 'name' then
          final_line[#final_line+1] = {n=G.UIT.O, config={
            object = DynaText({string = {assembled_string},
              colours = {(part.control.V and args.vars.colours[tonumber(part.control.V)]) or (part.control.C and loc_colour(part.control.C)) or G.C.UI.TEXT_LIGHT},
              bump = true,
              silent = true,
              pop_in = 0,
              pop_in_rate = 4,
              maxw = 5,
              shadow = true,
              y_offset = -0.6,
              spacing = math.max(0, 0.32*(17 - #assembled_string)),
              scale =  (0.55 - 0.004*#assembled_string)*(part.control.s and tonumber(part.control.s) or 1)
            })
          }}
        elseif part.control.E then
          local _float, _silent, _pop_in, _bump, _spacing = nil, true, nil, nil, nil
          if part.control.E == '1' then
            _float = true; _silent = true; _pop_in = 0
          elseif part.control.E == '2' then
            _bump = true; _spacing = 1
          end
          final_line[#final_line+1] = {n=G.UIT.O, config={
            object = DynaText({string = {assembled_string}, colours = {part.control.V and args.vars.colours[tonumber(part.control.V)] or loc_colour(part.control.C or nil)},
            float = _float,
            silent = _silent,
            pop_in = _pop_in,
            bump = _bump,
            spacing = _spacing,
            scale = 0.32*(part.control.s and tonumber(part.control.s) or 1)*desc_scale})
          }}
        elseif part.control.X then
          final_line[#final_line+1] = {n=G.UIT.C, config={align = "m", colour = loc_colour(part.control.X), r = 0.05, padding = 0.03, res = 0.15}, nodes={
              {n=G.UIT.T, config={
                text = assembled_string,
                colour = loc_colour(part.control.C or nil),
                scale = 0.32*(part.control.s and tonumber(part.control.s) or 1)*desc_scale}},
          }}
        else
          final_line[#final_line+1] = {n=G.UIT.T, config={
          detailed_tooltip = part.control.T and (G.P_CENTERS[part.control.T] or G.P_TAGS[part.control.T]) or nil,
          text = assembled_string,
          shadow = args.shadow,
          colour = part.control.V and args.vars.colours[tonumber(part.control.V)] or loc_colour(part.control.C or nil, args.default_col),
          scale = 0.32*(part.control.s and tonumber(part.control.s) or 1)*desc_scale},}
        end
      end
        if args.type == 'name' or args.type == 'text' then return final_line end
        args.nodes[#args.nodes+1] = final_line
    end
  end
end

function get_stake_sprite(_stake, _scale)
  _stake = _stake or 1
  _scale = _scale or 1
  local stake_sprite = Sprite(0,0,_scale*1,_scale*1,G.ASSET_ATLAS["chips"], G.P_CENTER_POOLS.Stake[_stake].pos)
  stake_sprite.states.drag.can = false
  if _stake == 8 then
    stake_sprite.draw = function(_sprite)
      _sprite.ARGS.send_to_shader = _sprite.ARGS.send_to_shader or {}
      _sprite.ARGS.send_to_shader[1] = math.min(_sprite.VT.r*3, 1) + G.TIMERS.REAL/(18) + (_sprite.juice and _sprite.juice.r*20 or 0) + 1
      _sprite.ARGS.send_to_shader[2] = G.TIMERS.REAL

      Sprite.draw_shader(_sprite, 'dissolve')
      Sprite.draw_shader(_sprite, 'voucher', nil, _sprite.ARGS.send_to_shader)
    end
  end
  return stake_sprite
end

function get_front_spriteinfo(_front)
  if _front and _front.suit and (_front.value == 'Jack' or _front.value == 'Queen' or _front.value == 'King') then
    if G.SETTINGS.CUSTOM_DECK and G.SETTINGS.CUSTOM_DECK.Collabs[_front.suit] then
      local _collab = G.SETTINGS.CUSTOM_DECK.Collabs[_front.suit]
      if (_collab == 'default') or (not G.ASSET_ATLAS[_collab..'_'..(G.SETTINGS.colourblind_option and 2 or 1)]) then 
      else
        return G.ASSET_ATLAS[_collab..'_'..(G.SETTINGS.colourblind_option and 2 or 1)], G.COLLABS.pos[_front.value]
      end
    end
  end
  return G.ASSET_ATLAS[_front.atlas] or G.ASSET_ATLAS["cards_"..(G.SETTINGS.colourblind_option and 2 or 1)], _front.pos
end

function get_stake_col(_stake)
  G.C.STAKES = G.C.STAKES or {
    G.C.WHITE,
    G.C.RED,
    G.C.GREEN,
    G.C.BLACK,
    G.C.BLUE,
    G.C.PURPLE,
    G.C.ORANGE,
    G.C.GOLD
  }
  return G.C.STAKES[_stake]
end

function get_challenge_int_from_id(_id)
  for k, v in pairs(G.CHALLENGES) do
    if v.id == _id then return k end
  end
  return 0
end

function get_starting_params()
return {
    dollars = 4,
    hand_size = 8,
    discards = 3,
    hands = 4,
    reroll_cost = 5,
    joker_slots = 5,
    ante_scaling = 1,
    consumable_slots = 2,
    no_faces = false,
    erratic_suits_and_ranks = false,
  }
end

function get_challenge_rule(_challenge, _type, _id)
  if _challenge and _challenge.rules and _challenge.rules[_type] then
    for k, v in ipairs(_challenge.rules[_type]) do
      if _id == v.id then return v.value end
    end
  end
end

--SOUND
function PLAY_SOUND(args)
  args.per = args.per or 1
  args.vol = args.vol or 1
  SOURCES[args.sound_code] = SOURCES[args.sound_code] or {}

  local should_stream = (string.find(args.sound_code,'music') or string.find(args.sound_code,'ambient'))
  local s = {sound = love.audio.newSource("resources/sounds/"..args.sound_code..'.ogg', should_stream and "stream" or 'static')}
  table.insert(SOURCES[args.sound_code], s)
  s.sound_code = args.sound_code
  s.original_pitch = args.per or 1
  s.original_volume = args.vol or 1
  s.created_on_pause = (args.overlay_menu and true or false)
  s.created_on_state = args.state
  s.sfx_handled = 0
  s.transition_timer = 0
  SET_SFX(s, args)
  love.audio.play(s.sound)
  return s
end

function STOP_AUDIO()
  for _, source in pairs(SOURCES) do
      for _, s in pairs(source) do
          if s.sound:isPlaying() then
              s.sound:stop()
          end
      end
  end
end

function SET_SFX(s, args)
  if string.find(s.sound_code,'music') then 
      if s.sound_code == args.desired_track then
          s.current_volume = s.current_volume or 1
          s.current_volume = 1*(args.dt*3) + (1-(args.dt*3))*s.current_volume
      else
          s.current_volume = s.current_volume or 0
          s.current_volume = 0*(args.dt*3) + (1-(args.dt*3))*s.current_volume
      end
      s.sound:setVolume(s.current_volume*s.original_volume*(args.sound_settings.volume/100.0)*(args.sound_settings.music_volume/100.0))
      s.sound:setPitch(s.original_pitch*args.pitch_mod)
  else
      if s.temp_pitch ~= s.original_pitch then 
          s.sound:setPitch(s.original_pitch)
          s.temp_pitch = s.original_pitch
      end
    local sound_vol = s.original_volume*(args.sound_settings.volume/100.0)*(args.sound_settings.game_sounds_volume/100.0)
    if s.created_on_state == 13 then sound_vol = sound_vol*args.splash_vol end
    if sound_vol <= 0 then
      s.sound:stop()
    else
      s.sound:setVolume(sound_vol)
    end
  end
end

function MODULATE(args)
  for k, v in pairs(SOURCES) do
      if (string.find(k,'music') and (args.desired_track ~= '')) then
          if v[1] and v[1].sound and v[1].sound:isPlaying() then
          else
              RESTART_MUSIC(args)
              break;
          end
      end
  end

  for k, v in pairs(SOURCES) do
    local i=1
    while i <= #v do
        if not v[i].sound:isPlaying() then
            table.remove(v, i)
        else
            i = i + 1
        end
    end

    for i, s in ipairs(v) do
      if s.sound and s.sound:isPlaying() and s.original_volume then
          SET_SFX(s, args)
      end
    end
  end
end

function RESTART_MUSIC(args)
  for k, v in pairs(SOURCES) do
      if string.find(k,'music') then 
          for i, s in ipairs(v) do
              s.sound:stop()
          end
          SOURCES[k] = {}
          args.per = 0.7
          args.vol = 0.6
          args.sound_code = k
          local s = PLAY_SOUND(args)
          s.initialized = true
      end
  end
end

function AMBIENT(args)
  for k, v in pairs(SOURCES) do
      if args.ambient_control[k] then 
          local start_ambient = args.ambient_control[k].vol > 0
      
          for i, s in ipairs(v) do
              if s.sound and s.sound:isPlaying() and s.original_volume then
                  s.original_volume = args.ambient_control[k].vol
                  SET_SFX(s, args)
                  start_ambient = false
              end
          end
          
          if start_ambient then
              args.sound_code = k
              args.vol = args.ambient_control[k].vol
              args.per = args.ambient_control[k].per
              PLAY_SOUND(args)
          end
       end
    end
end

function RESET_STATES(state)
  for k, v in pairs(SOURCES) do
      for i, s in ipairs(v) do
          s.created_on_state = state
      end
  end
end
