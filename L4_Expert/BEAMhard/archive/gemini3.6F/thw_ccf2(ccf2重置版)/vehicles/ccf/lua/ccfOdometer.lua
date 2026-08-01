-- written by DaddelZeit
-- DO NOT USE WITHOUT PERMISSION

local M = {}

local saveFilePath = "settings/zeit/odometer/ccf.json"
M.distance = 0
M.startingDistance = 0
local saveTimer = 0

local function updateGFX(dt)
    if not playerInfo.firstPlayerSeated then return end

    if electrics.values.odometer-electrics.values.trip == 0 then
        if electrics.values.engineRunning ~= 0 and electrics.values.gearIndex ~= 0 then
            if not tonumber(electrics.values.wheelspeed) then return end
            if electrics.values.wheelspeed > 0.1 then
                M.distance = (M.distance or 0) + (electrics.values.wheelspeed * dt) * 0.001
            end
        end
        electrics.values.ccfOdometer = M.startingDistance+M.distance
        electrics.values.ccfOdometerTrip = M.distance

        saveTimer = saveTimer + dt
        if saveTimer >= 5 then
            jsonWriteFile(saveFilePath, {distance = electrics.values.ccfOdometer}, true)
            saveTimer = 0
        end
    else
        electrics.values.ccfOdometer = electrics.values.odometer/1000
        electrics.values.ccfOdometerTrip = partCondition.getRootPartTripValue()/1000
    end
end

local function onInit()
    local data = jsonReadFile(saveFilePath)
    if data and data.distance then
        M.startingDistance = data.distance or 0
        electrics.values.ccfOdometer = M.startingDistance
        electrics.values.ccfOdometerTrip = 0
    end
end

-- public interface
M.updateGFX = updateGFX
M.onInit = onInit
M.onReset = onInit

return M