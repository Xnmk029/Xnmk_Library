-- written by DaddelZeit
-- DO NOT USE WITHOUT PERMISSION

local M = {}

local steamDataPath = "/temp/vehicles/ccf/steamcache.json"
local steamData = {}
local gaugeHTMLTexture
local currentPlaylist = ""
local enabledSent = false

local currentSong = ""
local paused = false
local availableProperties = {
    songUpdate = false,
    durationUpdate = false,
    playlistUpdate = false,
    playPauseUpdate = false
}

local function sendPlaylist(idArray, songsInList, playlistId, type)
    gaugeHTMLTexture:callJS("zeidioPlaylistChanged", {idArray, songsInList, playlistId, type})
    controller.getControllerSafe("gauges/customModules/stateController").playlistChanged(idArray, songsInList, playlistId, type)
end

local function sendSong(songData)
    gaugeHTMLTexture:callJS("zeidioSongChanged", {songData})
    controller.getControllerSafe("gauges/customModules/stateController").songChanged(songData)
end

local function updateGaugeData(moduleData, dt)
    -- first run
    if not moduleData.steamData then
        moduleData.steamData = {
            name = steamData[1],
            accID = steamData[2],
            lang = steamData[3],
        }
    end

    if zeitRadio then
        if not enabledSent then
            gaugeHTMLTexture:callJS("screenEnableZeidio", {zeitRadio ~= nil})
            enabledSent = true
        end

        if controller.getControllerSafe("gauges/customModules/stateController").getSetting("audio.radioType") == 2 then
            local songData = zeitRadio.getCurrentlyPlayingSongData()
            if availableProperties.playlistUpdate and currentPlaylist ~= songData.playlist then
                local songsInList = {}
                local idArray = zeitRadio.getPlaylistSongsById(songData.playlist)
                for _,v in ipairs(idArray) do
                    songsInList[v] = zeitRadio.getSongDataById(v)
                end
                sendPlaylist(idArray, songsInList, songData.playlist, 2)
                currentPlaylist = songData.playlist
            end
            if availableProperties.songUpdate and currentSong ~= songData.name then
                sendSong(songData)
                currentSong = songData.name
            end
            if availableProperties.durationUpdate then
                gaugeHTMLTexture:callJS("zeidioTimeChanged", {songData.timeSinceStart, songData.duration})
            end
            if availableProperties.playPauseUpdate and paused ~= songData.isPaused then
                gaugeHTMLTexture:callJS("zeidioPlayPauseChanged", {songData.isPaused})
                paused = songData.isPaused
            end
        end
    end
end

local function setupGaugeData(properties, htmlTexture)
    for k,v in pairs(properties) do
        availableProperties[k] = v
    end

    gaugeHTMLTexture = htmlTexture
    controller.getControllerSafe("gauges/customModules/stateController").radioLuaInit()
end

local function init()
    obj:queueGameEngineLua([[
        if Steam.accountLoggedIn then
            jsonWriteFile("]]..steamDataPath..[[", {Steam.playerName, Steam.getAccountIDStr(), Steam.language}, true)
        end
    ]])

    steamData = jsonReadFile(steamDataPath)
    if not steamData then
        steamData = {
            "Theo",
            "0",
            "english"
        }
    end
end

M.init = init
M.setupGaugeData = setupGaugeData
M.updateGaugeData = updateGaugeData

M.sendPlaylist = sendPlaylist
M.sendSong = sendSong

return M