-- written by DaddelZeit
-- DO NOT USE WITHOUT PERMISSION

local M = {}

local hillStartData = {}
local hillStartTimer = 0
local hillStartActive = false
local hillStartEnabled = false

local function zeitADASUpdate(dt)
    if not hillStartEnabled then return end

    if not hillStartActive then
        local _, pitch = obj:getRollPitchYaw()
        if electrics.values.wheelspeed <= 0.1 and electrics.values.brake >= 0.7 and electrics.values.throttle == 0 and pitch >= hillStartData.pitchThreshold then
            electrics.values.brakeOverride = 1
            hillStartActive = true
            hillStartTimer = 0
        end
    else
        if electrics.values.brake_input == 0 and hillStartActive then
            hillStartTimer = hillStartTimer + dt
            if hillStartTimer > hillStartData.brakeHoldTime or electrics.values.clutch < 0.7 then
                electrics.values.brakeOverride = nil
                hillStartActive = false
            end
        end
    end
end

local function init(jbeamData)
    hillStartEnabled = next(jbeamData) ~= nil
    hillStartData = jbeamData
end

M.zeitADASUpdate = zeitADASUpdate
M.init = init

return M