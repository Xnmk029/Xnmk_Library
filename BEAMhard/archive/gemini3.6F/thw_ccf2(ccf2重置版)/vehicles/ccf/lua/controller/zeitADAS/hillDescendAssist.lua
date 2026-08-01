-- written by DaddelZeit
-- DO NOT USE WITHOUT PERMISSION

local M = {}

local hillDescendData = {}
local hillDescendEnabled = false
local hillDescendSpeed = 0
local hillDescendActive = false

local function zeitADASUpdate(dt)
    if not hillDescendEnabled or tonumber(electrics.values.brakeOverride or 0) > 0.7 then return end
    local _, pitch = obj:getRollPitchYaw()
    if not hillDescendActive then
        if pitch <= -hillDescendData.pitchThreshold then
            hillDescendActive = true
            hillDescendSpeed = electrics.values.wheelspeed
        else
            return
        end
    end

    if electrics.values.brake_input == 0 and electrics.values.throttle_input == 0 then
        local speedDifference = electrics.values.wheelspeed - hillDescendSpeed
        local brakeAmount = math.min(speedDifference*hillDescendData.timeToHitSpeed/10, hillDescendData.maxBrakeAmount)
        electrics.values.brakeOverride = brakeAmount > 0 and brakeAmount or electrics.values.brakeOverride
        electrics.values.brakelights = electrics.values.brakeOverride ~= 0 and 0 or electrics.values.brakelights
    else
        electrics.values.brakeOverride = nil
        hillDescendSpeed = electrics.values.wheelspeed
    end

    if pitch >= -hillDescendData.pitchThreshold then
        hillDescendActive = false
        electrics.values.brakeOverride = nil
    end
end

local function init(jbeamData)
    hillDescendEnabled = next(jbeamData) ~= nil
    hillDescendData = jbeamData
end

M.zeitADASUpdate = zeitADASUpdate
M.init = init

return M