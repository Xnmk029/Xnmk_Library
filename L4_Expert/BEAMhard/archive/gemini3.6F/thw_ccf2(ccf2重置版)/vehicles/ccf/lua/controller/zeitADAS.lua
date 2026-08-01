-- written by DaddelZeit
-- DO NOT USE WITHOUT PERMISSION

local M = {}

local controllers = {}

local camPos
local vehPos
local camDistToCar
local isInCar
M.isInCar = false

M.otherVehSensors = {
    sensors = {},
    directions = {},
    velocities = {},
    objects = {},
    idSlotMatch = {}
}

local curSlot = 1

local function checkCamInside()
    camPos = obj:getCameraPosition()

    if camPos and vehPos then
        camDistToCar = camPos:distance(vehPos)
        isInCar = camDistToCar <= 0.6
    end

    M.isInCar = isInCar
    vehPos = obj:getPosition() + obj:getNodePosition((beamstate.nodeNameMap and beamstate.nodeNameMap["driver"]) or 0)
end

local function updateSensors(dt)
    local curVeh = M.otherVehSensors.objects[M.otherVehSensors.idSlotMatch[curSlot-1]]
    if curVeh then
        local id = curVeh:getId()
        if not M.otherVehSensors.sensors[id] then
            M.otherVehSensors.sensors[id] = {
                cast = ffi.cast("struct{float sensorX; float sensorY; float sensorZ; float sensorZnonInertial; float yawAngVel;}*", curVeh:getSensorsFFI()),
                gx_smooth2 = newTemporalSmoothingNonLinear(7),
                gy_smooth2 = newTemporalSmoothingNonLinear(7),
                gz_smooth2 = newTemporalSmoothingNonLinear(7),
                sensors = {}
            }
            M.otherVehSensors.sensors[id].gx_smooth2:reset()
            M.otherVehSensors.sensors[id].gy_smooth2:reset()
            M.otherVehSensors.sensors[id].gz_smooth2:reset()
        end

        local ffiCast = M.otherVehSensors.sensors[id].cast
        M.otherVehSensors.sensors[id].sensors = {
            gx2 = M.otherVehSensors.sensors[id].gx_smooth2:get(ffiCast.sensorX, dt),
            gy2 = M.otherVehSensors.sensors[id].gy_smooth2:get(ffiCast.sensorY, dt),
            gz2 = M.otherVehSensors.sensors[id].gz_smooth2:get(ffiCast.sensorZnonInertial, dt)
        }

        M.otherVehSensors.directions[id] = curVeh:getDirectionVector()
        M.otherVehSensors.velocities[id] = curVeh:getVelocity()
    end

    curSlot = curSlot - 1
    if curSlot == 0 then
        --if BeamEngine:getSlotCount() ~= #M.otherVehSensors.idSlotMatch then
            M.otherVehSensors.idSlotMatch = {}
            M.otherVehSensors.objects = {}

            for i=1, BeamEngine:getSlotCount() do
                local slot = BeamEngine:getSlot(i-1)
                M.otherVehSensors.idSlotMatch[i] = slot:getId()
                M.otherVehSensors.objects[slot:getId()] = slot
            end
        --end

        curSlot = #M.otherVehSensors.idSlotMatch
    end
end

local function updateGFX(dt)
    if not playerInfo.anyPlayerSeated or electrics.values.ignitionLevel == 0 then return end

    checkCamInside()
    local mailboxData = lpack.decode(obj:getLastMailbox("zeitADASVehOBBs"))
    if not mailboxData or not next(mailboxData) then return end

    updateSensors(dt)

    for k=1, #controllers do
        controllers[k].zeitADASUpdate(dt, mailboxData)
    end
end

local function initSecondStage(jbeamData)
    obj:queueGameEngineLua([[
        extensions.load("zeit_ccfGetVehOBBs");
        zeit_ccfGetVehOBBs.registerVehicle(]]..objectId..[[)
    ]])

    for _,controllerData in ipairs(tableFromHeaderTable(jbeamData.components)) do
        controllers[#controllers+1] = controller.getController(controllerData.name)
    end
end

M.updateGFX = updateGFX
M.reset = nop
M.init = nop
M.initSecondStage = initSecondStage

return M