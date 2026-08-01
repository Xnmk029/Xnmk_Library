-- written by DaddelZeit
-- DO NOT USE WITHOUT PERMISSION

local M = {}

local gaugeHTMLTexture
local savePath = ""
local vehType = ""
local currentState = ""
local playerSeated = false

local saves = {}
local defaultSaves = {}
local saveApplyFuncs = {}
local tempSaves = {
    ['audio.list_scroll'] = 0,
    ['playlistSize'] = 0
}
local triggerInteracts = {}

local function loadCurrentStateBoxes(thisState)
    local stateToUse = thisState or currentState
    obj:queueGameEngineLua([[
        if zeit_ccfScreenInteract then
            zeit_ccfScreenInteract.loadBoxes("]].."vehicles/ccf/screen_triggers/"..vehType.."/"..stateToUse..[[.json")
        end
    ]])
end

local function showBox(text, buttonText, boxFileName)
    boxFileName = boxFileName or "popup_generic"
    loadCurrentStateBoxes(boxFileName)
    gaugeHTMLTexture:callJS("screenPopup", {true, text, buttonText})
end

local function hideBox()
    loadCurrentStateBoxes()
    gaugeHTMLTexture:callJS("screenPopup", {false})
end

local function sendState(state)
    if state ~= currentState then
        currentState = state
        -- inform the trigger script
        loadCurrentStateBoxes()
        -- update gauges
        gaugeHTMLTexture:callJS("screenStateUpdate", {state})
    end
end

local function writeSaveJSON()
    jsonWriteFile(savePath, saves, false)
end

local function generateCarName()
    if not saves['settings.car_name']:match('%d') then
        saves['settings.car_name'] = saves['settings.car_name']..math.random(0,9)..math.random(0,9)..math.random(0,9)..math.random(0,9)..math.random(0,9)
        writeSaveJSON()
    end
    gaugeHTMLTexture:callJS("execFunc", {"function func(s) { s.bluetooth_vehname = '"..saves['settings.car_name'].."' }"})
end

local function updateSystemMarketInfo()
    local tbl = {market = (v.data.vehMarketInfo_market or {})["val"], layout = (v.data.vehMarketInfo_layout or {})["val"], fuel = (v.data.vehMarketInfo_fuel or {})["val"], rooftype = (v.data.vehMarketInfo_roof or {})["val"], carvariant = (v.data.vehMarketInfo_carvariant or {})["val"]}
    gaugeHTMLTexture:callJS("updateMarketInfo", tbl)
end

local function loadSave(useDefault)
    local defaultSvs = deepcopy(defaultSaves)
    saves = useDefault and defaultSvs or saves

    for k,v in pairs(defaultSvs) do
        if saves[k] == nil then
            saves[k] = v
        end
    end

    for saveKey,saveVal in pairs(saves) do
        if saveApplyFuncs[saveKey] then
            local applyTbl = saveApplyFuncs[saveKey]
            if applyTbl[1] == 1 then
                gaugeHTMLTexture:callJS("execFunc", {applyTbl[2]:gsub("VALUE", tostring(saveVal))})
            elseif applyTbl[1] == 2 then
                local f, err = load("return "..applyTbl[2]:gsub("VALUE", tostring(saveVal)))
                if not f and err then
                    print("Can't create function: "..applyTbl[2])
                    print(err)
                end

                if f then
                   f()(saves)
                end
            elseif applyTbl[1] == 3 then
                local f, err = load("return "..applyTbl[2])
                if not f and err then
                    print("Can't create function: "..applyTbl[2])
                    print(err)
                end

                if f then
                   f()(saves)
                end

                local specificPropertyChosen = applyTbl[3]:match("VALUE{.-}")
                if specificPropertyChosen then
                    local str = specificPropertyChosen:match("%b{}")
                    gaugeHTMLTexture:callJS("execFunc", {applyTbl[3]:gsub("VALUE{.-}", tostring(saves[str:sub(2,str:len()-1)]))})
                else
                    gaugeHTMLTexture:callJS("execFunc", {applyTbl[3]:gsub("VALUE", tostring(saves[saveVal]))})
                end
            end
        end
    end

    generateCarName()
    updateSystemMarketInfo()
    if saves.firststart then
        showBox("Did you know?\nThis screen works!", "Click me", "popup_firststart")
    else
        loadCurrentStateBoxes()
    end
end

local function onPlayersChanged(bool)
    if bool then
        loadSave()
        obj:queueGameEngineLua([[
            if zeit_ccfScreenInteract then
                zeit_ccfScreenInteract.setFocusCar(]]..objectId..[[)
            end
        ]])
    end
end

local lastParkingSensorShow = 0
local function updateGaugeData(moduleData, dt)
    if currentState == "navi" and lastParkingSensorShow == 0 and electrics.values.parkingSensorShow == 1 then
        sendState("pksa")
    elseif currentState == "pksa" and electrics.values.parkingSensorShow == 0 then
        sendState("navi")
    end

    lastParkingSensorShow = electrics.values.parkingSensorShow
    moduleData.dt = dt
    moduleData.timeOfDay = tonumber(obj:getLastMailbox("timeOfDay")) or 0
end

local function input(triggerId, xleft, xright)
    if triggerInteracts[triggerId] then
        if type(triggerInteracts[triggerId]) == "table" then
            if triggerInteracts[triggerId][3] then
                triggerInteracts[triggerId][1](tempSaves, xleft, xright)
                local specificPropertyChosen = triggerInteracts[triggerId][2]:match("VALUE{.-}")
                if specificPropertyChosen then
                    local tmpstring = triggerInteracts[triggerId][2]
                    while specificPropertyChosen do
                        local str = specificPropertyChosen:match("%b{}")
                        tmpstring = tmpstring:gsub(specificPropertyChosen, tostring(tempSaves[str:sub(2,str:len()-1)]))
                        specificPropertyChosen = tmpstring:match("VALUE{.-}")
                    end
                    gaugeHTMLTexture:callJS("execFunc", {tmpstring})
                else
                    gaugeHTMLTexture:callJS("execFunc", {triggerInteracts[triggerId][2]:gsub("VALUE", tostring(tempSaves[triggerId]))})
                end
            else
                triggerInteracts[triggerId][1](saves, xleft, xright)
                local specificPropertyChosen = triggerInteracts[triggerId][2]:match("VALUE{.-}")
                if specificPropertyChosen then
                    local tmpstring = triggerInteracts[triggerId][2]
                    while specificPropertyChosen do
                        local str = specificPropertyChosen:match("%b{}")
                        tmpstring = tmpstring:gsub(specificPropertyChosen, tostring(saves[str:sub(2,str:len()-1)]))
                        specificPropertyChosen = tmpstring:match("VALUE{.-}")
                    end
                    gaugeHTMLTexture:callJS("execFunc", {tmpstring})
                else
                    gaugeHTMLTexture:callJS("execFunc", {triggerInteracts[triggerId][2]:gsub("VALUE", tostring(saves[triggerId]))})
                end
                writeSaveJSON()
            end
        elseif type(triggerInteracts[triggerId]) == "string" then
            sendState(triggerInteracts[triggerId])
        end
    end
end

local function scroll(triggerId, val)
    if triggerInteracts[triggerId] then
        triggerInteracts[triggerId][1](tempSaves, val)
        gaugeHTMLTexture:callJS("execFunc", {triggerInteracts[triggerId][2]:gsub("VALUE", tostring(tempSaves[triggerId]))})
    end
end

local function playlistChanged(idArray, songsInList, playlistId)
    idArray = shallowcopy(idArray)
    tempSaves['audio.list_scroll'] = 0
    table.remove(idArray, 1)
    tempSaves['playlistSize'] = #idArray or 0
end

local function songChanged(songData)
    --tempSaves['audio.list_scroll'] = tempSaves['audio.list_scroll'] + (math.max(songData.currentSongIndex-1-(tempSaves['audio.list_scroll']/2),4)-4)
    --gaugeHTMLTexture:callJS("execFunc", {"function func(s) { s.audio_list_scroll = "..tempSaves['audio.list_scroll'].." }"})
end

local function updateData(path)
end

local function updateGFX(dt)
    if playerInfo.anyPlayerSeated ~= playerSeated then
        onPlayersChanged(playerInfo.anyPlayerSeated)
        playerSeated = playerInfo.anyPlayerSeated
    end
end

local function setupGaugeData(properties, htmlTexture)
    gaugeHTMLTexture = htmlTexture
    sendState("navi")
end

local function radioLuaInit()
    M.playlistChanged = playlistChanged
    M.songChanged = songChanged
end

local function reset()
    sendState("navi")
end

local function getSetting(key)
    return tempSaves[key] or saves[key] or nil
end

local function init(jbeamData)
    triggerInteracts = jbeamData.triggerInteracts or triggerInteracts
    vehType = jbeamData.type or vehType
    savePath = jbeamData.savePath or savePath
    defaultSaves = jbeamData.saves
    saves = jsonReadFile(savePath) or jbeamData.saves or saves
    saveApplyFuncs = jbeamData.saveApplyFuncs

    obj:queueGameEngineLua([[
        extensions.reload("zeit_ccfScreenInteract")
    ]])

    for k,v in pairs(triggerInteracts) do
        if type(v) == "table" and #v == 2 then
            local f, err = load("return "..v[1])
            if not f and err then
                print("Can't create function: "..v[1])
                print(err)
            end

            triggerInteracts[k][3] = v[1]:match("function%(ts%)") ~= nil
            if f then
                triggerInteracts[k][1] = f()
            end
        end
    end
end

M.reset = reset
M.init = init
M.updateGaugeData = updateGaugeData
M.updateData = updateData
M.updateGFX = updateGFX
M.setupGaugeData = setupGaugeData
M.loadSave = loadSave

M.showBox = showBox
M.hideBox = hideBox
M.getSetting = getSetting
M.input = input
M.scroll = scroll
M.playlistChanged = nop
M.songChanged = nop
M.radioLuaInit = radioLuaInit

local dabTable = {
    {"_", "bbc_r1","bbc_r1xtra","bbc_r2","bbc_r3","bbc_r4","bbc_r4x","bbc_r5","bbc_r6","classic_fm","dlf_nova","live_diggi", "ndr1"},
    {
        _ = {
            name = "",
            artist = "",
            coverUrl = "vehicles/ccf/infotainment_screen/radio_info/unselected.png",
            channel = ""
        },
        bbc_r1 = {
            name = "Parallel - Metrik",
            artist = "12B - DAB - R1 DANCE ANTHEMS",
            coverUrl= "vehicles/ccf/infotainment_screen/radio_info/bbc_radio1.png",
            channel = "BBC Radio 1"
        },
        bbc_r1xtra = {
            name = "Rick Ross - The Devil Is a Lie",
            artist = "12B - DAB - RAMPAGE",
            coverUrl= "vehicles/ccf/infotainment_screen/radio_info/bbc_radio1x.png",
            channel = "BBC Radio 1Xtra"
        },
        bbc_r2 = {
            name = "ABBA - The Winner Takes It All",
            artist = "12B - DAB - ROB BECKETT",
            coverUrl= "vehicles/ccf/infotainment_screen/radio_info/bbc_radio2.png",
            channel = "BBC Radio 2"
        },
        bbc_r3 = {
            name = "Words and Music",
            artist = "12B - DAB - WORK AND PLAY",
            coverUrl= "vehicles/ccf/infotainment_screen/radio_info/bbc_radio3.png",
            channel = "BBC Radio 3"
        },
        bbc_r4 = {
            name = "Pick of the Week",
            artist = "12B - DAB - STUART MACONIE",
            coverUrl= "vehicles/ccf/infotainment_screen/radio_info/bbc_radio4.png",
            channel = "BBC Radio 4"
        },
        bbc_r4x = {
            name = "Inheritance Tracks",
            artist = "12B - DAB - ROS ATKINS",
            coverUrl= "vehicles/ccf/infotainment_screen/radio_info/bbc_radio4_extra.png",
            channel = "BBC Radio 4 Extra"
        },
        bbc_r5 = {
            name = "Build-up: France v South Africa",
            artist = "12B - DAB - 5 LIVE SPORT",
            coverUrl= "vehicles/ccf/infotainment_screen/radio_info/bbc_radio5.png",
            channel = "BBC Radio 5"
        },
        bbc_r6 = {
            name = "The Fall - Hip Priest",
            artist = "12B - DAB - STUART MACONIE'S FREAK ZONE",
            coverUrl= "vehicles/ccf/infotainment_screen/radio_info/bbc_radio6.png",
            channel = "BBC Radio 6"
        },
        classic_fm = {
            name = "Christopher Tin - Flocks a Mile Wide",
            artist = "11D - DAB - JOHN HUMPHRYS",
            coverUrl= "vehicles/ccf/infotainment_screen/radio_info/classic_fm.png",
            channel = "Classic FM"
        },
        dlf_nova = {
            name = "Club der Republik",
            artist = "Es ist kompliziert. Dazu guter Pop.",
            coverUrl= "vehicles/ccf/infotainment_screen/radio_info/dlf_nova.png",
            channel = "Deutschlandfunk Nova"
        },
        live_diggi = {
            name = "Ms. Jackson - Pashanim",
            artist = "Für den Sektor.",
            coverUrl= "vehicles/ccf/infotainment_screen/radio_info/live_diggi.png",
            channel = "1LIVE DIGGI"
        },
        ndr1 = {
            name = "Lotusblume - Die Flippers",
            artist = "NDR 1 - Die beste Musik für den Norden",
            coverUrl= "vehicles/ccf/infotainment_screen/radio_info/ndr1.png",
            channel = "NDR 1 Niedersachsen"
        },
    }
}

local fmTable = {
    {"_", "bbc_r1","bbc_r2","bbc_r3","bbc_r4","classic_fm"},
    {
        _ = {
            name = "",
            artist = "",
            coverUrl = "vehicles/ccf/infotainment_screen/radio_info/unselected.png",
            channel = ""
        },
        bbc_r1 = {
            name = "Parallel - Metrik",
            artist = "97.1MHz - FM - R1 DANCE ANTHEMS",
            coverUrl= "vehicles/ccf/infotainment_screen/radio_info/bbc_radio1.png",
            channel = "BBC Radio 1"
        },
        bbc_r2 = {
            name = "ABBA - The Winner Takes It All",
            artist = "88.1MHz - FM - ROB BECKETT",
            coverUrl= "vehicles/ccf/infotainment_screen/radio_info/bbc_radio2.png",
            channel = "BBC Radio 2"
        },
        bbc_r3 = {
            name = "Words and Music",
            artist = "90.2MHz - FM - WORK AND PLAY",
            coverUrl= "vehicles/ccf/infotainment_screen/radio_info/bbc_radio3.png",
            channel = "BBC Radio 3"
        },
        bbc_r4 = {
            name = "Pick of the Week",
            artist = "92.5MHz - FM - STUART MACONIE",
            coverUrl= "vehicles/ccf/infotainment_screen/radio_info/bbc_radio4.png",
            channel = "BBC Radio 4"
        },
        classic_fm = {
            name = "Christopher Tin - Flocks a Mile Wide",
            artist = "99.9MHz - FM - JOHN HUMPHRYS",
            coverUrl= "vehicles/ccf/infotainment_screen/radio_info/classic_fm.png",
            channel = "Classic FM"
        },
    }
}

rawset(_G, "zeitRadioInterface", {
    changeVol = function(val)
        if saves['audio.radioType'] ~= 2 then return end
        if zeitRadio then
            zeitRadio.tuneRadioVolume(val, true)
        end
    end,
    skipTo = function(val)
        if saves['audio.radioType'] ~= 2 then return end
        if zeitRadio then
            zeitRadio.skipTo(val)
        end
    end,
    changeSong = function(val, full)
        if saves['audio.radioType'] ~= 2 then
            if zeitRadio and not zeitRadio.getCurrentlyPlayingSongData().isPaused then
                zeitRadio.pausePlaySong()
            end
            local tbl = deepcopy(saves['audio.radioType']==0 and dabTable[2][dabTable[1][val]] or fmTable[2][fmTable[1][val]])
            tbl.currentSongIndex = val
            controller.getControllerSafe("gauges/customModules/zeitRadio").sendSong(tbl)
            return
        end
        if zeitRadio then
            zeitRadio.changeSong(val, full or false)
        end
    end,
    changePlaylist = function(val, full)
        if saves['audio.radioType'] ~= 2 then return end
        if zeitRadio then
            zeitRadio.changePlaylist(val, full or false)
        end
    end,
    pausePlaySong = function()
        if saves['audio.radioType'] ~= 2 then return end
        if zeitRadio then
            zeitRadio.pausePlaySong()
        end
    end,
    updateRadioType = function(type)
        if type == 2 then
            local songData = zeitRadio.getCurrentlyPlayingSongData()
            local songsInList = {}
            local idArray = zeitRadio.getPlaylistSongsById(songData.playlist)
            for _,v in ipairs(idArray) do
                songsInList[v] = zeitRadio.getSongDataById(v)
            end
            controller.getControllerSafe("gauges/customModules/zeitRadio").sendPlaylist(idArray, songsInList, songData.playlist, type)
            controller.getControllerSafe("gauges/customModules/zeitRadio").sendSong(songData)
        elseif type == 1 then
            controller.getControllerSafe("gauges/customModules/zeitRadio").sendPlaylist(fmTable[1], fmTable[2], 1, type)
            local tbl = fmTable[2][fmTable[1][1]]
            tbl.currentSongIndex = -1
            controller.getControllerSafe("gauges/customModules/zeitRadio").sendSong(tbl)
        else
            controller.getControllerSafe("gauges/customModules/zeitRadio").sendPlaylist(dabTable[1], dabTable[2], 1, type)
            local tbl = dabTable[2][dabTable[1][1]]
            tbl.currentSongIndex = -1
            controller.getControllerSafe("gauges/customModules/zeitRadio").sendSong(tbl)
        end
    end
})

return M