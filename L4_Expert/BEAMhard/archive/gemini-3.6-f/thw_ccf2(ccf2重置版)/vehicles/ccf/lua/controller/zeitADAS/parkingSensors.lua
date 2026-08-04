-- written by DaddelZeit
-- DO NOT USE WITHOUT PERMISSION

local M = {}

local parkingSensorData = {}
local parkingSensorEnabled = false
M.parkingSensorHits = { parkingSensorMinDist=2, parkingSensorMinDistFront=2, parkingSensorMinDistFrontActual=2, parkingSensorMinDistRear=2, parkingSensorMinDistRearActual=2, frontBumper = {}, rearBumper = {} }
local parkingSensorSoundTimer = 0
local parkingSensorTurnOffTimer = 0
local parkingSensorSpeedThreshold = math.huge
local parkingSensorSoundOnce
local parkingSensorSoundContinuous
local parkingCurrentSensor = 1

local brokenBreakGroupCache = {}
local n = beamstate.nodeNameMap
local soundFileOnce = ""
local soundFileContinuous = ""

local function castRayParkingSensor(origin, dir, staticOnly, maxDistance, mailboxData)
    local staticRay = obj:castRayStatic(origin, dir, maxDistance)
    local triangleData = lpack.decode(obj:getLastMailbox("zeitADASVehTris"))
    local vehicleRay = maxDistance

    if not staticOnly then
        for othervehid, otherveh in pairs(mailboxData) do
            if othervehid == obj:getId() or math.abs(intersectsRay_OBB(origin, dir, otherveh.center, otherveh.x, otherveh.y, otherveh.z)) > 10 then goto skip_vehicle end

            local otherVehSensors = controller.getController("zeitADAS").otherVehSensors
            local otherObj = otherVehSensors.objects[othervehid]
            if not otherObj or not triangleData[othervehid] then goto skip_vehicle end
            for _, colTri in pairs(triangleData[othervehid]) do
                local otherObjPos = otherObj:getPosition()
                if not colTri.id1 or not colTri.id2 or not colTri.id3 then break end
                local newRay = intersectsRay_Triangle(origin, dir, otherObj:getNodePosition(colTri.id1)+otherObjPos, otherObj:getNodePosition(colTri.id2)+otherObjPos, otherObj:getNodePosition(colTri.id3)+otherObjPos)
                vehicleRay = math.min(newRay >= 0 and newRay or math.huge, vehicleRay)
            end

            ::skip_vehicle::
        end
    end

    local combinedRay = math.min(staticRay, vehicleRay)

    --local debugDrawer = obj.debugDrawProxy
    --debugDrawer:drawLine(origin, origin+dir, color(255,0,0,255))
    --debugDrawer:drawSphere(0.05, origin+(dir*combinedRay), color(255,0,0,255))

    return combinedRay
end

local function runCheckParkingSensorsFront(mailboxData)
    if brokenBreakGroupCache[parkingSensorData.frontBumperBreakGroupName] then
        --M.parkingSensorHits.frontBumper = {}
        M.parkingSensorHits.parkingSensorMinDistFrontActual = 2
        return 1
    end

    parkingCurrentSensor = parkingCurrentSensor + 1
    if parkingCurrentSensor > #parkingSensorData.frontBumper then
        parkingCurrentSensor = 0
        --M.parkingSensorHits.frontBumper = {}
        M.parkingSensorHits.parkingSensorMinDistFrontActual = M.parkingSensorHits.parkingSensorMinDistFront
        M.parkingSensorHits.parkingSensorMinDistFront = 2
        M.parkingSensorHits.parkingSensorMinDistRear = 2
        return 1
    end

    local vehPos = obj:getPosition()
    local vehRot = quat(obj:getRotation()):normalized()

    local currentSensorSettings = parkingSensorData.frontBumper[parkingCurrentSensor]
    local currentSensor = { vehPos+obj:getNodePosition(n[currentSensorSettings.startNode])+currentSensorSettings.offsetVec:rotated(vehRot), currentSensorSettings.dirVec:rotated(vehRot) }

    local ray = castRayParkingSensor(currentSensor[1], ((currentSensor[2]+currentSensor[1])-currentSensor[1]):normalized(), currentSensorSettings.isStaticOnly, 2, mailboxData)
    --table.insert(M.parkingSensorHits.frontBumper, ray)
    M.parkingSensorHits.frontBumper[parkingCurrentSensor] = ray
    M.parkingSensorHits.parkingSensorMinDistFront = math.min(M.parkingSensorHits.parkingSensorMinDistFront, ray)
    electrics.values.parkingSensorHits.frontBumper[parkingCurrentSensor] = ray

    electrics.values.parkingSensorShow = (electrics.values.parkingSensorShow == 1 or ray ~= 2) and 1 or 0

    return 0
end

local function runCheckParkingSensorsRear(mailboxData)
    if brokenBreakGroupCache[parkingSensorData.rearBumperBreakGroupName] then
        --M.parkingSensorHits.rearBumper = {}
        M.parkingSensorHits.parkingSensorMinDistRearActual = 2
        return 0
    end

    parkingCurrentSensor = parkingCurrentSensor + 1
    if parkingCurrentSensor > #parkingSensorData.rearBumper then
        parkingCurrentSensor = 0
        --M.parkingSensorHits.rearBumper = {}
        M.parkingSensorHits.parkingSensorMinDistRearActual = M.parkingSensorHits.parkingSensorMinDistRear
        M.parkingSensorHits.parkingSensorMinDistFront = 2
        M.parkingSensorHits.parkingSensorMinDistRear = 2
        return 0
    end

    local vehPos = obj:getPosition()
    local vehRot = quat(obj:getRotation()):normalized()

    local currentSensorSettings = parkingSensorData.rearBumper[parkingCurrentSensor]
    local currentSensor = { vehPos+obj:getNodePosition(n[currentSensorSettings.startNode])+currentSensorSettings.offsetVec:rotated(vehRot), currentSensorSettings.dirVec:rotated(vehRot) }

    local ray = castRayParkingSensor(currentSensor[1], ((currentSensor[2]+currentSensor[1])-currentSensor[1]):normalized(), currentSensorSettings.isStaticOnly, 2, mailboxData)
    --table.insert(M.parkingSensorHits.rearBumper, ray)
    M.parkingSensorHits.rearBumper[parkingCurrentSensor] = ray
    M.parkingSensorHits.parkingSensorMinDistRear = math.min(M.parkingSensorHits.parkingSensorMinDistRear, ray)
    electrics.values.parkingSensorHits.rearBumper[parkingCurrentSensor] = ray

    electrics.values.parkingSensorShow = (electrics.values.parkingSensorShow == 1 or ray ~= 2) and 1 or 0

    return 1
end

local function doParkingSensorSound(dt, val)
    if not parkingSensorSoundOnce then
        parkingSensorSoundOnce = obj:createSFXSource2(soundFileOnce or "", "Audio2D", "parkingSensorSoundOnce", 0, 0)
    end
    if not parkingSensorSoundContinuous then
        parkingSensorSoundContinuous = obj:createSFXSource2(soundFileContinuous or "", "AudioLoop2D", "parkingSensorSoundContinuous", 0, 0)
    end

    local isInCar = controller.getController("zeitADAS").isInCar
    obj:setVolume(parkingSensorSoundContinuous, isInCar and 0.75 or 0)

    if electrics.values.gearIndex == 0 then
        obj:stopSFX(parkingSensorSoundContinuous)
        obj:cutSFX(parkingSensorSoundContinuous)
        obj:stopSFX(parkingSensorSoundOnce)
        obj:cutSFX(parkingSensorSoundOnce)
    elseif val < 0.4 then
        parkingSensorTurnOffTimer = 0
        if not obj:isPlayingSFX(parkingSensorSoundContinuous) then
            obj:playSFX(parkingSensorSoundContinuous)
        end
    elseif val < 0.7 then
        parkingSensorTurnOffTimer = 0
        parkingSensorSoundTimer = parkingSensorSoundTimer + dt
        if parkingSensorSoundTimer > 0.15 then
            obj:playSFXOnce("parkingSensorSoundOnce", 0, 0.75, isInCar and 1 or 0)
            parkingSensorSoundTimer = 0
        end
        if obj:isPlayingSFX(parkingSensorSoundContinuous) then
            obj:stopSFX(parkingSensorSoundContinuous)
            obj:cutSFX(parkingSensorSoundContinuous)
        end
    elseif val < 0.9 then
        parkingSensorTurnOffTimer = 0
        parkingSensorSoundTimer = parkingSensorSoundTimer + dt
        if parkingSensorSoundTimer > 0.3 then
            obj:playSFXOnce("parkingSensorSoundOnce", 0, 0.75, isInCar and 1 or 0)
            parkingSensorSoundTimer = 0
        end
        if obj:isPlayingSFX(parkingSensorSoundContinuous) then
            obj:stopSFX(parkingSensorSoundContinuous)
            obj:cutSFX(parkingSensorSoundContinuous)
        end
    elseif val < 1.2 then
        parkingSensorTurnOffTimer = 0
        parkingSensorSoundTimer = parkingSensorSoundTimer + dt
        if parkingSensorSoundTimer > 0.5 then
            obj:playSFXOnce("parkingSensorSoundOnce", 0, 0.75, isInCar and 1 or 0)
            parkingSensorSoundTimer = 0
        end
        if obj:isPlayingSFX(parkingSensorSoundContinuous) then
            obj:stopSFX(parkingSensorSoundContinuous)
            obj:cutSFX(parkingSensorSoundContinuous)
        end
    elseif val < 1.5 then
        parkingSensorTurnOffTimer = 0
        parkingSensorSoundTimer = parkingSensorSoundTimer + dt
        if parkingSensorSoundTimer > 0.7 then
            obj:playSFXOnce("parkingSensorSoundOnce", 0, 0.75, isInCar and 1 or 0)
            parkingSensorSoundTimer = 0
        end
        if obj:isPlayingSFX(parkingSensorSoundContinuous) then
            obj:stopSFX(parkingSensorSoundContinuous)
            obj:cutSFX(parkingSensorSoundContinuous)
        end
    else
        if parkingSensorTurnOffTimer == 1 then
            obj:stopSFX(parkingSensorSoundContinuous)
            obj:cutSFX(parkingSensorSoundContinuous)
        end
        parkingSensorTurnOffTimer = parkingSensorTurnOffTimer + 1
    end
end

local function zeitADASUpdate(dt, mailboxData)
    doParkingSensorSound(dt, electrics.values.gearIndex > 0 and M.parkingSensorHits.parkingSensorMinDistFrontActual or M.parkingSensorHits.parkingSensorMinDistRearActual)

    if not parkingSensorEnabled or electrics.values.parkingSensorsEnabled ~= 1 or electrics.values.wheelspeed > parkingSensorSpeedThreshold then
        obj:stopSFX(parkingSensorSoundContinuous)
        obj:cutSFX(parkingSensorSoundContinuous)
        obj:stopSFX(parkingSensorSoundOnce)
        obj:cutSFX(parkingSensorSoundOnce)

        M.parkingSensorHits.parkingSensorMinDistFrontActual = 2
        M.parkingSensorHits.parkingSensorMinDistRearActual = 2
        electrics.values.parkingSensorShow = false
        return
    end

    --if electrics.values.gearIndex > 0 then
        runCheckParkingSensorsFront(mailboxData)
        --M.parkingSensorHits.parkingSensorMinDistRear = 2
    --elseif electrics.values.gearIndex < 0 then
        runCheckParkingSensorsRear(mailboxData)
        --M.parkingSensorHits.parkingSensorMinDistFront = 2
    --end

    M.parkingSensorHits.parkingSensorMinDist = math.min(M.parkingSensorHits.parkingSensorMinDistFrontActual, M.parkingSensorHits.parkingSensorMinDistRearActual)
end

local function init(jbeamData)
    parkingSensorEnabled = next(jbeamData)
    if parkingSensorEnabled then
        electrics.values.parkingSensorsEnabled = 1
        parkingSensorSpeedThreshold = jbeamData.activeSpeedKMH/3.6
        parkingSensorData = {
            frontBumper = tableFromHeaderTable(jbeamData.frontBumper or {}),
            rearBumper = tableFromHeaderTable(jbeamData.rearBumper or {}),
            frontBumperBreakGroupName = jbeamData.frontBumperBreakGroupName,
            rearBumperBreakGroupName = jbeamData.rearBumperBreakGroupName
        }

        for _,v in ipairs(parkingSensorData.frontBumper) do
            v.dirVec = vec3():fromString(v.direction)
            v.offsetVec = vec3():fromString(v.offset)
        end

        for _,v in ipairs(parkingSensorData.rearBumper) do
            v.dirVec = vec3():fromString(v.direction)
            v.offsetVec = vec3():fromString(v.offset)
        end

        for _,v in ipairs(parkingSensorData.frontBumper) do
            if not n[v.startNode] then
                parkingSensorEnabled = false
                log("D", "zeitADAS.parkingSensorInit", "A node specified for a front bumper sensor does not exist, aborting init")
                break
            end
        end
        for _,v in ipairs(parkingSensorData.rearBumper) do
            if not n[v.startNode] then
                parkingSensorEnabled = false
                log("D", "zeitADAS.parkingSensorInit", "A node specified for a rear bumper sensor does not exist, aborting init")
                break
            end
        end

        electrics.values.parkingSensorHits = {frontBumper = {}, rearBumper = {}}
        electrics.values.parkingSensorShow = false

        soundFileOnce = jbeamData.soundFileOnce or ""
        soundFileContinuous = jbeamData.soundFileContinuous or ""
    end
end

local function beamBroken(id, energy)
    local beam = v.data.beams[id]

    if not beam or not beam.breakGroup then return end
    brokenBreakGroupCache[beam.breakGroup] = true
end

local function reset()
    if not parkingSensorSoundOnce then
        parkingSensorSoundOnce = obj:createSFXSource2(soundFileOnce or "", "Audio2D", "parkingSensorSoundOnce", 0, 0)
    end
    if not parkingSensorSoundContinuous then
        parkingSensorSoundContinuous = obj:createSFXSource2(soundFileContinuous or "", "AudioLoop2D", "parkingSensorSoundContinuous", 0, 0)
    end
    obj:stopSFX(parkingSensorSoundContinuous)
    obj:cutSFX(parkingSensorSoundContinuous)
    electrics.values.parkingSensorShow = false
    brokenBreakGroupCache = {}
end

M.beamBroken = beamBroken
M.zeitADASUpdate = zeitADASUpdate
M.init = init
M.reset = reset

return M