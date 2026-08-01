function live_test()

end 

function do_action(action)
    local action = {
        type = 'use_card',
        target_area = "shop_booster",
        target_card = 1,
    }

    do_action(action)

    if action.type ==  'use_card' then 
        G.FUNCS.use_card({config = {ref_table = G[action.target_area].cards[action.target_card]}})
    end
end

function graphics_stress()
    local _r = {}
    for i = 1,50 do
        local _c = {}
        for j =1,50 do
            _c[#_c+1] = {n=G.UIT.C, config={align = "cm", minw = 0.05,minh = 0.05,colour = G.C.BLUE}, nodes={
                {n=G.UIT.T, config={text = "A", scale = 0.15, colour = G.C.WHITE}}
            }}
        end
        _r[#_r+1] = {n=G.UIT.R, config={align = "cm", minw = 0.05,minh = 0.05,colour = G.C.BLUE, padding = 0.05}, nodes=_c}
    end
    local uidef = {n=G.UIT.ROOT, config={align = "cm", colour = G.C.CLEAR}, nodes=_r}

    G.STRESS = UIBox{
        definition = uidef,
        config = {align="cm", offset = {x=0,y=0},major = G.ROOM_ATTACH}
    }
end

function aprint(text)
    if _RELEASE_MODE then return end
    attention_text({
        text = text,
        scale = 0.8, 
        hold = 5.7,
        cover = G.deck or G.MAIN_MENU_UI,
        cover_colour = G.C.RED,
        align = 'cm',
        })
end

function play_video()
    G.video_control = G.video_control or {
        {video = 'A3', _s = 0.1, _e = 4.65, track = 'music1'},
        {video = 'E1', _s = 3.69, _e = 6.55},
        {video = 'C3', _s = 1.9, _e = 4.3, track = 'music3'},
        {video = 'E5', _s = 5.9, _e = 9.2, track = 'music1'},
        {video = 'C4a', _s = 1.3, _e = 4.5, track = 'music2'},
        {video = 'E4', _s = 4, _e = 7.2, track = 'music1'},
        {video = 'D4', _s = 0.3, _e = 3.2, track = 'music4'},
        {video = 'C2', _s = 2.0, _e = 4.4, track = 'music1'},
        {video = 'B3', _s = 2.7, _e = 5.3},
        {video = 'B4', _s = 21.5, _e = 24.8},
        {video = 'D5', _s = 1.2, _e = 3.8, track = 'music1'},
        {video_organ = 0.1,video = 'E2', _s = 1.5, _e = 4.1},
        {video_organ = 0.2,video = 'E3', _s = 3.5, _e = 7.5},
        {video_organ = 0.4, video = 'D3', _s = 1.9, _e = 4.3, track = 'music1'},
        --[[ old one 
        {video = 'A1', _s = 2.5, _e = 13.9, track = 'music1'},
        {video = '_A2', _s = 0.4, _e = 3.15},
        {video = 'A3', _s = 0.2, _e = 2.25},
        {video = 'A4', _s = 3.4, _e = 8.2},
        {video = '_B1', _s = 0.15, _e = 4.4},
        {video = 'B3', _s = 2.7, _e = 5.3},
        {video = 'B4', _s = 21.5, _e = 27.6},
        {video = '_C1', _s = 0.25, _e = 3.2, track = 'music4'},
        {video = 'C2', _s = 1.4, _e = 4.4},
        {video = 'C3', _s = 1.9, _e = 4.3, track = 'music3'},
        {video = 'C4a', _s = 1.3, _e = 4.5, track = 'music2'},
        {video = '_C5', _s = 0.1, _e = 3.4, track = 'music1'},
        {video = 'C4b', _s = 0.15, _e = 3.5},
        {video = 'D4', _s = 0.3, _e = 3.7, track = 'music4'},
        {video = 'D3', _s = 1.6, _e = 4.8, track = 'music1'},
        {video = 'D1', _s = 1.4, _e = 3.5, track = 'music4'},
        {video = 'D5', _s = 1.0, _e = 3.8, track = 'music1'},
        {video = 'E1', _s = 3, _e = 6.55},
        {video = 'E2', _s = 0., _e = 4.1},
        {video = 'E3', _s = 3.5, _e = 7.5},
        {video = 'E4', _s = 4, _e = 7.2},
        {video = 'E5', _s = 5.9, _e = 9.2, track = 'music1'},
        {video = 'F1', _s = 4.2, _e = 8.1},
        {video_organ = 0.1, video = 'F5', _s = 2.25, _e = 5.4},
        {video_organ = 0.05, video = 'F6', _s = 0, _e = 2.3},
        {video_organ = 0.2, video = 'F2', _s = 0.2, _e = 1.6},
        {video_organ = 0.4, video = 'F3', _s = 2.6, _e = 4.2},    ]]--
    }

    G.video_volume = 1
    G.video_volume_real = 0

    G.E_MANAGER:add_event(Event({
        blocking = false, blockable = false,
        func = function()
            G.video_volume_real = G.video_volume_real*(1 - 4*G.real_dt) + 4*G.real_dt*G.video_volume
            if G.video then G.video:getSource( ):setVolume(G.video_volume_real) end
        end
    }))

    local trailer_time = 0

    for k, v in pairs(G.video_control) do
        if v.start then 
            local nu_vc = {}
            for i = k, #G.video_control do
                nu_vc[#nu_vc+1] = G.video_control[i]
            end
            G.video_control = nu_vc
            break
        end
    end

    
    --prep clips because keyframes
    for k, v in pairs(G.video_control) do
        trailer_time = trailer_time + (v._e - v._s)
        v.video_file = love.graphics.newVideo('resources/videos/'..v.video..'.ogv')
        v.video_file:seek(math.max(v._s or 0.3, 0.3) - 0.29)
        G.E_MANAGER:add_event(Event({
            func = function()
                v.video_file:play()
                return true
            end
        }))
        G.E_MANAGER:add_event(Event({
            trigger = 'after',
                delay = 0.29,
            func = function()
                v.video_file:pause()
                v.video_file:seek(v._s or 0)
                return true
            end
        }))
    end
    delay(1.5)

    for k, v in pairs(G.video_control) do
        if v.text then 
            G.E_MANAGER:add_event(Event({
                trigger = 'before',
                delay = 1.4,
                func = function()
                    G.FUNCS.wipe_on(v.text, true, 1.4)
                    G.video_volume = 0
                    return true
                end
            }))
            G.E_MANAGER:add_event(Event({
                func = function()
                    if G.video then G.video:pause() end
                    G.video = v.video_file
                    if v.track then G.video_soundtrack = v.track end
                    if v.video_organ then G.video_organ = v.video_organ end
                    G.video:play()
                    G.video_volume = 1
                    return true
                end
            }))
            G.FUNCS.wipe_off()
        else
            G.E_MANAGER:add_event(Event({
                func = function()
                    if G.video then G.video:pause() end
                    G.video = v.video_file
                    if v.track then G.video_soundtrack = v.track end
                    if v.video_organ then G.video_organ = v.video_organ end
                    G.video:play()
                    return true
                end
            }))
        end
        local _delay = v._e - (v._s or 0) - (v.text and 1.5 or 0)
        delay(_delay - 0.15)
        G.E_MANAGER:add_event(Event({
            func = function()
                G.screenglitch = true
                G.screenwipe_amt = 1
                return true
            end
        }))
        delay(0.15)
        G.E_MANAGER:add_event(Event({
            blocking = false,
            trigger = 'after',
            delay = 0.3,
            func = function()
                G.screenglitch = false
                return true
            end
        }))
    end
    local flash_col = copy_table(G.C.WHITE)
    G.E_MANAGER:add_event(Event({
        trigger = 'before',
        delay = 0.6,
        func = function()
            G.FUNCS.wipe_on(nil, true, 2, flash_col)
            return true
        end
    }))
    G.E_MANAGER:add_event(Event({
        func = function()
            
            G.E_MANAGER:add_event(Event({
                trigger = 'after', delay = 0.9, blockable = false,
                func = function()
                    G.video:pause()
                    G.video = nil
                    G.video_soundtrack = 'music1'
                    G.video_organ = 0
                    return true
                end
            }))
            G.E_MANAGER:add_event(Event({
                trigger = 'after', delay = 0.9, blockable = false,
                func = function()
                    G.screenglitch = false
                    G.TIMERS.REAL = 4
                    G.TIMERS.TOTAL = 4
                    flash_col[4] = 0
                    G:main_menu('splash')
                    return true
                end
            }))
            
            return true
        end
    }))
    G.FUNCS.wipe_off()
end
