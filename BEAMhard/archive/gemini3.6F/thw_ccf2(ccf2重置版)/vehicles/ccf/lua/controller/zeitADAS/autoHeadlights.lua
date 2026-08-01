-- written by DaddelZeit
-- DO NOT USE WITHOUT PERMISSION

local M = {}

local autoHeadlightsEnabled = false
local autoHeadlightsData = {}

local checktimer = 0
local lightUpdatedTimer = 0
local manuallyTurnedOff = false

local lightBaseVal = 0
local highBeamsVal = 0
local value = 0
local lastValue = -1

local function getHighBeam(ownVeh, mailboxData)
    for _,otherVeh in pairs(mailboxData) do
        if otherVeh.lightsActive then
            local dir = otherVeh.center-ownVeh.center
            local rotation = quatFromDir(dir)

            local cornerLU = otherVeh.center+vec3(-otherVeh.halfExtentsX*15, 0, otherVeh.halfExtentsX*15):rotated(rotation)
            local cornerRU = otherVeh.center+vec3(otherVeh.halfExtentsX*15, 0, otherVeh.halfExtentsX*15):rotated(rotation)
            local cornerLD = otherVeh.center+vec3(-otherVeh.halfExtentsX*15, 0, -otherVeh.halfExtentsX*15):rotated(rotation)
            local cornerRD = otherVeh.center+vec3(otherVeh.halfExtentsX*15, 0, -otherVeh.halfExtentsX*15):rotated(rotation)

            local dist = intersectsRay_Plane(ownVeh.center, obj:getForwardVector(), otherVeh.center, dir)
            if dist > 0 and dist < 450 then
                local hitpos = ownVeh.center+obj:getForwardVector()*dist
                if hitpos:squaredDistanceToLine(cornerLU, cornerLD) + hitpos:squaredDistanceToLine(cornerRU, cornerRD) < (otherVeh.halfExtentsX*30)^2
                and hitpos:squaredDistanceToLine(cornerLU, cornerRU) + hitpos:squaredDistanceToLine(cornerLD, cornerRD) < (otherVeh.halfExtentsX*30)^2 then
                    local staticRay = obj:castRayStatic(ownVeh.center, otherVeh.center-ownVeh.center, 800) or math.huge
                    if staticRay >= ownVeh.center:distance(otherVeh.center) then
                        return 0
                    end
                end
            end
        end
    end

    return 1
end

local function zeitADASUpdate(dt, mailboxData)
    checktimer = checktimer + dt
    if checktimer > 0.15 then checktimer = 0 else return end
    if not mailboxData or not next(mailboxData) or not autoHeadlightsEnabled then return end

    local ownVeh = mailboxData[objectId] or {}
    mailboxData[objectId] = nil
    if not next(ownVeh) or not ownVeh.ambColor then return end

    if highBeamsVal == 1 and electrics.values.lights_state < 2 then
        manuallyTurnedOff = true
    else
        manuallyTurnedOff = false
    end

    lightBaseVal = ownVeh.ambColor < 0.7 and 1 or 0
    highBeamsVal = autoHeadlightsData.highBeamCheck and (ownVeh.ambColor < 0.7 and getHighBeam(ownVeh, mailboxData) or 0) or 0
    value = lightBaseVal+highBeamsVal

    if lastValue == 1 and value == 2 then
        if electrics.values.lights_state == 1 and value == 2 then
            lightUpdatedTimer = lightUpdatedTimer + dt
            if lightUpdatedTimer > 0.5 then
                electrics.setLightsState(2)
                lightUpdatedTimer = 0
                lastValue = value
            end
        end
    else
        if value ~= lastValue and not manuallyTurnedOff or (electrics.values.lights_state == 2 and value == 1) then
            electrics.setLightsState(value)
            lastValue = value
        end
    end
end

local function reset()
    manuallyTurnedOff = false
end

local function init(jbeamData)
    autoHeadlightsEnabled = next(jbeamData) ~= nil
    autoHeadlightsData = jbeamData
end

M.init = init
M.reset = reset
M.zeitADASUpdate = zeitADASUpdate

return M