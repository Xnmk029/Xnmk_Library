-- written by DaddelZeit
-- DO NOT USE WITHOUT PERMISSION

local M = {}

local aebData = {}
local aebEnabled = false
local aebActive = false
local aebResetTimer = 0
local aebEnabledID = 0
local aebSoundTimer = 0
local aebSoundActive = false
local aebSoundPlayed = false
local aebSoundResetTimer = 0
local aebSoundTimer2 = 0
local aebFullStopOverwrite = false
local aebFullStopOverwriteStage = false
local aebDSEEnabled = true
local soundId

local function getBrakingTime(gravity, distToObstacleAhead, speedDifference)
    -- derived from this: https://en.wikipedia.org/wiki/Braking_distance
    --local _, pitch = obj:getRollPitchYaw()
    local kinEnSlowFac = (gravity * (aebData.frictionCoef or 0.9))*(aebData.kinEnSlowFacMultiplier or 2) -- - math.abs(pitch*4)

    local timeToCol = distToObstacleAhead/speedDifference
    local timeToBrake = speedDifference/kinEnSlowFac

    return timeToCol - timeToBrake - (aebData.brakingTimeSubtrahend or 0.15)
end

local function getFuturePosition(vel, center, dir, time, gx2, gy2, gz2)
    local gVec = vec3(gx2 or 0, gy2 or 1, gz2 or 0)*0.25
    local dirVec = vec3(dir):normalized()

    -- having 2 "* time" causes the return positions to equate to a bend, rather than a straight line
    time = time or 1
    return ((vel + (quatFromDir(dirVec) * gVec) * time) * time) + center
end

local function doAEBSound(dt)
    if not soundId then
        soundId = obj:createSFXSource2(aebData and aebData.soundFile or "", "Audio2D", "aebWarningOnce", 0, 0)
    end

    local isInCar = controller.getController("zeitADAS").isInCar
    if not aebData.soundType or aebData.soundType == 0 then
        if aebSoundActive == true then
            aebSoundTimer = aebSoundTimer - dt
            if aebSoundTimer <= 0 then
                obj:playSFXOnce("aebWarningOnce", 0, 1.5, isInCar and 1 or 0)
                aebSoundTimer = aebData.soundDuration
            end

            if not aebActive then
                aebSoundResetTimer = aebSoundResetTimer + dt
                if aebSoundResetTimer >= 0.75 then
                    aebSoundActive = false
                    aebSoundResetTimer = 0
                end
            end
        end
    elseif aebData.soundType == 1 then
        if aebSoundActive == true and not aebSoundPlayed and aebSoundTimer2 == 0 then
            obj:playSFXOnce("aebWarningOnce", 0, 1.5, isInCar and 1 or 0)
            aebSoundPlayed = true
            aebSoundActive = false
            aebSoundTimer2 = dt
        elseif aebSoundTimer2 ~= 0 then
            aebSoundTimer2 = aebSoundTimer2 + dt
            if aebSoundTimer2 >= aebData.soundDuration then
                aebSoundTimer2 = 0
            end
        end
    end
end

local function doAEBBraking(overlap, carInFront, timeUntilBrake, speedDifference, othervehid, aebOverwritten)
    if timeUntilBrake > 0.4 and not aebActive and aebSoundActive then
        aebSoundActive = false
        aebSoundPlayed = false
        electrics.values.aebActive = 0
    end

    if overlap and carInFront and electrics.values.wheelspeed > (aebData.activeSpeedKMH or 10)/3.6 then
        if not aebSoundActive and timeUntilBrake <= 0.4 then
            aebSoundActive = true
            electrics.values.aebActive = 1
        elseif timeUntilBrake > 0.4 and not aebActive then
            aebSoundActive = false
            aebSoundPlayed = false
            electrics.values.aebActive = 0
        end

        if not aebActive and timeUntilBrake <= 0 and not aebOverwritten then
            if cruiseControl then cruiseControl.setEnabled(false) end
            electrics.values.brakeOverride = 1
            electrics.values.throttleOverride = 0
            electrics.values.clutchOverride = 1
            electrics.values.aebBrakeActive = 1
            electrics.values.aebActive = 1
            aebActive = true
            aebResetTimer = 0
            aebEnabledID = othervehid
        end
    else
        if aebActive and othervehid == aebEnabledID and (math.floor(speedDifference) <= 0.05 or not carInFront or electrics.values.wheelspeed < 0.15) then
            aebActive = false
            aebSoundActive = false
            electrics.values.brakeOverride = nil
            electrics.values.throttleOverride = nil
            electrics.values.clutchOverride = nil
            electrics.values.aebBrakeActive = 0
            electrics.values.aebActive = 0
            aebResetTimer = 0

            if electrics.values.gearboxMode ~= "arcade" and electrics.values.wheelspeed < (aebData.speedFullStopThreshold or 2.2222222222) then
                aebFullStopOverwrite = true
                electrics.values.brakeOverride = 1
                electrics.values.clutchOverride = 1
            end
        end
    end
end

local function normalFromTri(a, b, c)
    local v,w = b-a, c-a
    return vec3(
        (v.y*w.z)-(v.z*w.y),
        (v.z*w.x)-(v.x*w.z),
        (v.x*w.y)-(v.y*w.x)
    )
end

local function aebStaticCheck(center, gravity)
    -- static check
    local predictedVehPos =  getFuturePosition(obj:getVelocity(), center, obj:getDirectionVector(), 3, -sensors.gx2*0.75, -sensors.gy2*0.75, 0)
    local dirToNewPos = (predictedVehPos - center):normalized()

    local vehRot = quat(obj:getRotation())
    local zMove = 0.15
    local vecAdd1, vecAdd2, vecAdd3 = vec3(0, 0, 0-zMove), vec3(0, 0, 0.25-zMove), vec3(0.25, 0, 0-zMove):rotated(vehRot)
    local distance1 = obj:castRayStatic(center+vecAdd1, dirToNewPos, 600)
    local distance2 = obj:castRayStatic(center+vecAdd2, dirToNewPos, 600)
    local distance3 = obj:castRayStatic(center+vecAdd3, dirToNewPos, 600)
    local hit1, hit2, hit3 = center+vecAdd1+dirToNewPos*distance1, center+vecAdd2+dirToNewPos*distance2, center+vecAdd3+dirToNewPos*distance3
    local normal = normalFromTri(hit1, hit3, hit2)

    local _, pitch = obj:getRollPitchYaw()
    if math.abs(normal.z) < 0.2 - math.abs(pitch)*0.75 then
        --[[
        local debugDrawer = obj.debugDrawProxy
        debugDrawer:drawSphere(0.05, hit1, color(255,0,0,255))
        debugDrawer:drawSphere(0.05, hit2, color(255,0,0,255))
        debugDrawer:drawSphere(0.05, hit3, color(255,0,0,255))
        debugDrawer:drawLine(hit1, hit1+normal, color(255,0,0,255))
        debugDrawer:drawLine(hit2, hit2+normal, color(255,0,0,255))
        debugDrawer:drawLine(hit3, hit3+normal, color(255,0,0,255))
        ]]

        local speedDifference = math.max(electrics.values.airspeed or 0, 5)
        local timeUntilBrake = getBrakingTime(-gravity, distance1, math.min(speedDifference, 30)+(aebData.speedDifferenceAddend or 0))

        return timeUntilBrake, speedDifference
    end
end

local function aebDynamicCheck(mailboxData, ownVeh, vehVels, vehDirs, vehSensors, gravity)
    -- we need this data to continue, if its not there then skip the entire code
    if not next(vehVels) or not next(vehDirs) or not next(vehSensors) then return end

    local vehFrontPos = ownVeh.center - ownVeh.y

    local carInFrontCheck
    for othervehid,otherveh in pairs(mailboxData) do
        local carInFront = obj:getForwardVector():dot((otherveh.center - ownVeh.center):normalized()) > 0.5
        if othervehid == objectId or not vehSensors[othervehid] or not vehDirs[othervehid] or not vehVels[othervehid] or not carInFront then goto skip_vehicle end

        local speedDifference = (vehVels[othervehid] - obj:getVelocity()):length()

        local dirToOther = (otherveh.center - vehFrontPos):normalized()
        local distance = math.max(intersectsRay_OBB(vehFrontPos, dirToOther, otherveh.center, otherveh.x, otherveh.y, otherveh.z), 0)+2

        -- meters / meters/seconds = seconds to reach target
        -- done so that the future distances are proportional to eachother
        -- i love the metric system
        -- lock to 12.5 max to avoid too much error
        local secondsToTarget = math.min(distance/math.max(speedDifference,6), 12.5)
        local predictedVehPos =  getFuturePosition(obj:getVelocity(), ownVeh.center, obj:getDirectionVector(), secondsToTarget, -sensors.gx2, -sensors.gy2, --[[(sensors.gz-gravity)]] 0)

        local otherVehSensors = vehSensors[othervehid].sensors
        local predictedOtherVehPos = getFuturePosition(vehVels[othervehid], otherveh.center, vehDirs[othervehid], secondsToTarget, -otherVehSensors.gx2, -otherVehSensors.gy2, 1)

        local overlap = overlapsOBB_OBB(predictedVehPos, ownVeh.x09, ownVeh.y, ownVeh.z, predictedOtherVehPos, otherveh.x09, otherveh.y, otherveh.z)

        local ownLaneDir = ownVeh.lane > 0 and 1 or -1
        local otherLaneDir = otherveh.lane > 0 and 1 or -1
        if electrics.values.wheelspeed >= (aebData.exactLaneCheckSpeedThreshold or 27.7777777777) and ownVeh.lane ~= otherveh.lane then
            overlap = false
        elseif electrics.values.wheelspeed >= (aebData.laneCheckSwitchSpeed or 11.1111111111) and ownLaneDir ~= otherLaneDir then
            overlap = false
        end

        --willHitCarInFront = ((distance < aebData.distanceForceBrakeThreshold and electrics.values.wheelspeed >= aebData.distanceForceBrakeSpeedThreshold) or (speedDifference < 7.5 and distance < speedDifference)) and aebLastCarInFrontCheck

        if not carInFrontCheck then
            -- 100m limit
            -- work on a 2d plane to avoid height differences messing stuff up, dir is affected by braking after all
            carInFrontCheck = math.min(math.max(intersectsRay_OBB(vehFrontPos:z0(), obj:getDirectionVector():z0(), otherveh.center:z0(), otherveh.x, otherveh.y, otherveh.z), 0), 40) < 40
        end

        local timeUntilBrake = getBrakingTime(-gravity, distance, math.max(speedDifference,6)+(aebData.speedDifferenceAddend or 0))

        --[[
        local debugDrawer = obj.debugDrawProxy
        debugDrawer:drawSphere(0.05, predictedVehPos, color(255,0,0,255))
        debugDrawer:drawSphere(0.05, predictedOtherVehPos, color(255,255,255,255))
        ]]

        doAEBBraking(overlap, carInFront, timeUntilBrake, speedDifference, othervehid)

        ::skip_vehicle::
    end
    return carInFrontCheck
end

local function zeitADASUpdate(dt, mailboxData)
    if not mailboxData or not next(mailboxData) or not aebEnabled or not aebDSEEnabled then return end

    --local n = beamstate.nodeNameMap
    local gravity = obj:getGravity()
    local aebOverwritten = (aebData.pedalThreshold < electrics.values.brake_input) or (aebData.allowThrottleOverwrite and aebData.pedalThreshold < electrics.values.throttle_input)
    local ownVeh = mailboxData[objectId] or {}
    if not next(ownVeh) then return end
    local otherVehSensors = controller.getController("zeitADAS").otherVehSensors
    local vehSensors = otherVehSensors and otherVehSensors.sensors or {}
    local vehDirs = otherVehSensors and otherVehSensors.directions or {}
    local vehVels = otherVehSensors and otherVehSensors.velocities or {}

    local carInFrontCheck = aebDynamicCheck(mailboxData, ownVeh, vehVels, vehDirs, vehSensors, gravity)
    if electrics.values.wheelspeed <= (aebData.laneCheckSwitchSpeed or 11.1111111111) then
        local timeUntilBrake, speedDifference = aebStaticCheck(ownVeh.center, gravity)
        if timeUntilBrake and speedDifference then
            doAEBBraking(true, true, timeUntilBrake, speedDifference, 0, aebOverwritten)
        end
    end

    doAEBSound(dt)

    if aebFullStopOverwrite then
        if not aebFullStopOverwriteStage then
            if electrics.values.throttle_input <= 0 or electrics.values.brake_input <= 0 then
                aebFullStopOverwriteStage = true
            end
        elseif aebFullStopOverwriteStage then
            if electrics.values.throttle_input > 0.1 or electrics.values.brake_input > 0.1 then
                aebFullStopOverwriteStage = false
                electrics.values.brakeOverride = nil
                electrics.values.clutchOverride = nil
                aebFullStopOverwrite = false
            end
        end
    end

    if aebActive and (not carInFrontCheck) then
        aebResetTimer = aebResetTimer + dt
        if aebResetTimer >= 0.75 then
            aebActive = false
            electrics.values.brakeOverride = nil
            electrics.values.throttleOverride = nil
            electrics.values.clutchOverride = nil
            electrics.values.aebBrakeActive = 0
            electrics.values.aebActive = 0
            aebResetTimer = 0
            aebSoundActive = false
            aebSoundPlayed = false
        end
    end
end

local function init(jbeamData)
    aebEnabled = next(jbeamData) ~= nil
    aebData = jbeamData
    electrics.values.aebBrakeActive = 0
    electrics.values.aebActive = 0

    local adasOverwrite = v.data.zeitADAS_overwrite or {}
    for k,v in pairs(adasOverwrite.aebData or {}) do
        aebData[k] = v
    end
end

local function reset()
    aebSoundActive = false
    electrics.values.aebBrakeActive = 0
    electrics.values.aebActive = 0
end

local function setParameters(params)
    aebDSEEnabled = params.isEnabled
    if not aebDSEEnabled then
        doAEBBraking(false, false, 1, 0, false, aebEnabledID)
    end
end

M.setParameters = setParameters
M.zeitADASUpdate = zeitADASUpdate
M.init = init
M.reset = reset

-- DEBUG, FOR USE WITH IMGUI
M.setAEBVal = function(key, val)
    print("before: "..tostring(aebData[key]))
    aebData[key] = val
end

return M