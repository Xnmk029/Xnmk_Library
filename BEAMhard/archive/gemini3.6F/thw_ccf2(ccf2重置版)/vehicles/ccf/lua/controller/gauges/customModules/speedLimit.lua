-- written by DaddelZeit
-- DO NOT USE WITHOUT PERMISSION


local M = {}

local timer = 1
local gaugeHTMLTexture
local isInside

local sound
local soundNode = 0
local driverNodeCid = 0
local soundVolume = 1
local volumeMultiplier = 1
local soundActive = true

local camPos
local combinedPos
local function isCamInside()
  camPos = obj:getCameraPosition()
  isInside = combinedPos and (camPos:distance(combinedPos) <= 0.6) or false
  combinedPos = obj:getPosition() + obj:getNodePosition(driverNodeCid)
end

local function getSpeedLimit()
    -- mapmgr doesn't immediately have the data, so we have to request it from GE if needed.
    -- Alternatively call requestMap once on vehicle init.
    -- Call the function a second time to actually get a result.

    if not mapmgr.mapData then
        mapmgr.requestMap()
        return
    end

    local n1, n2 = mapmgr.findClosestRoad(obj:getPosition() or vec3(0,0,0))
    local mapNodes = mapmgr.mapData.graph
    local link = {speedLimit = 0}
    if n1 and n2 then
        link = mapNodes[n1][n2] or mapNodes[n2][n1] or {speedLimit = 0}
    end

    return link.speedLimit
end

local function updateGaugeData(moduleData, dt)
    timer = timer + dt
    if timer > 0.75 then
        local speedlimit = getSpeedLimit()

        if moduleData.speedLimit ~= speedlimit then
            gaugeHTMLTexture:callJS("speedLimitChanged", speedlimit)
        end

        moduleData.speedlimit = speedlimit
        timer = 0
    end

    isCamInside()
    if soundActive and sound and moduleData.speedlimit then
        local isPlaying = obj:isPlayingSFX(sound)
        if not isPlaying and moduleData.speedlimit < electrics.values.wheelspeed then
            obj:playSFX(sound)
            obj:setVolume(sound, isInside and soundVolume or 0)
        elseif isPlaying and moduleData.speedlimit > electrics.values.wheelspeed then
            obj:setVolume(sound, isInside and soundVolume or 0)
            obj:stopSFX(sound)
        end
    end
end

local function setupGaugeData(properties, htmlTexture)
    gaugeHTMLTexture = htmlTexture
end

local function init(jbeamData)
    if not jbeamData.soundEvent then return end

    driverNodeCid = beamstate.nodeNameMap["driver"]
    soundActive = false
    volumeMultiplier = jbeamData.soundVolume or 1
end

local function setSoundVolume(volume)
    soundVolume = volume*volumeMultiplier
    if obj:isPlayingSFX(sound) then
        obj:setVolume(sound, isInside and soundVolume or 0)
    end
end

local function setSoundActive(bool)
    soundActive = bool
    if not soundActive and obj:isPlayingSFX(sound) then
        obj:stopSFX(sound)
    end
end

local function initSounds(jbeamData)
    if jbeamData.soundEvent then
        sound = obj:createSFXSource2(jbeamData.soundEvent, "AudioLoop2D", "ccfSpeedWarning", 0, 0)
    end
end

M.setSoundVolume = setSoundVolume
M.setSoundActive = setSoundActive
M.initSounds = initSounds
M.init = init
M.setupGaugeData = setupGaugeData
M.updateGaugeData = updateGaugeData

return M