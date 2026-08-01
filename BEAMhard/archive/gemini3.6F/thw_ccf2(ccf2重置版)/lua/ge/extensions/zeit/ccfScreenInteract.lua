-- written by DaddelZeit
-- DO NOT USE WITHOUT PERMISSION

local M = {}

local registeredVehicles = {}
local boxes = {}
local vehicle = nil
local timer = 0

local function drawBox(box, col)
    col = col or ColorF(1,0,0,1)
    local center = box:getCenter()
    local halfExt = box:getHalfExtents()
    local cornerA = center+halfExt.x*box:getAxis(0)+halfExt.y*box:getAxis(1)+halfExt.z*box:getAxis(2)
    local cornerB = center+(-halfExt.x)*box:getAxis(0)+halfExt.y*box:getAxis(1)+halfExt.z*box:getAxis(2)
    local cornerC = center+halfExt.x*box:getAxis(0)+(-halfExt.y)*box:getAxis(1)+halfExt.z*box:getAxis(2)
    local cornerD = center+(-halfExt.x)*box:getAxis(0)+(-halfExt.y)*box:getAxis(1)+halfExt.z*box:getAxis(2)
    debugDrawer:drawLine(cornerA, cornerB, col)
    debugDrawer:drawLine(cornerA, cornerC, col)
    debugDrawer:drawLine(cornerC, cornerD, col)
    debugDrawer:drawLine(cornerD, cornerB, col)

    local cornerE = center+halfExt.x*box:getAxis(0)+halfExt.y*box:getAxis(1)+(-halfExt.z)*box:getAxis(2)
    local cornerF = center+(-halfExt.x)*box:getAxis(0)+halfExt.y*box:getAxis(1)+(-halfExt.z)*box:getAxis(2)
    local cornerG = center+halfExt.x*box:getAxis(0)+(-halfExt.y)*box:getAxis(1)+(-halfExt.z)*box:getAxis(2)
    local cornerH = center+(-halfExt.x)*box:getAxis(0)+(-halfExt.y)*box:getAxis(1)+(-halfExt.z)*box:getAxis(2)
    debugDrawer:drawLine(cornerE, cornerF, col)
    debugDrawer:drawLine(cornerE, cornerG, col)
    debugDrawer:drawLine(cornerG, cornerH, col)
    debugDrawer:drawLine(cornerH, cornerF, col)

    debugDrawer:drawLine(cornerA, cornerE, col)
    debugDrawer:drawLine(cornerB, cornerF, col)
    debugDrawer:drawLine(cornerC, cornerG, col)
    debugDrawer:drawLine(cornerD, cornerH, col)
end

local function send(triggerId, mousewheelORxleft, xright)
    if xright then
        vehicle:queueLuaCommand([[
            controller.getControllerSafe("gauges/customModules/stateController").input("]]..triggerId..[[",]]..mousewheelORxleft..[[,]]..xright..[[)
        ]])
    else
        vehicle:queueLuaCommand([[
            controller.getControllerSafe("gauges/customModules/stateController").scroll("]]..triggerId..[[",]]..mousewheelORxleft..[[)
        ]])
    end
end

local lastTod = -1
local function onUpdate(dt)
    timer = timer + dt
    if timer > 0.5 then
        local tod = core_environment.getTimeOfDay()
        if tod and tod.time ~= lastTod then
            be:sendToMailbox("timeOfDay", (tod.time+0.5)%1*86400000)
            lastTod = tod.time
        end
        timer = 0
    end

    if not vehicle or not vehicle.getPosition or not boxes[1] then return end
    local canClick
    local ray = getCameraMouseRay()
    for k=1, #boxes do local v = boxes[k];
        local obb = OrientedBox3F()
        local matFromRot = vehicle:getRefNodeMatrix()
        matFromRot:setPosition(vehicle:getPosition()+v.pos:rotated(quat(vehicle:getRefNodeRotation())))
        obb:set2(matFromRot, v.size)

        local halfExt = obb:getHalfExtents()
        if v.debugCol then
            drawBox(obb, v.debugCol)
        end

        local dist = intersectsRay_OBB(ray.pos, ray.dir, obb:getCenter(), halfExt.x*obb:getAxis(0), halfExt.y*obb:getAxis(1), halfExt.z*obb:getAxis(2))
        local clickable = dist < 2

        if v.scroll then
            local mousewheel = ui_imgui.GetIO().MouseWheel
            if clickable and mousewheel ~= 0 then
                send(v.id, mousewheel)
            end
        else
            if clickable and ui_imgui.IsMouseClicked(0) then
                local rayHitPos = ray.pos+ray.dir*dist
                local center, halfExtX, halfExtY, halfExtZ = obb:getCenter(), halfExt.x*obb:getAxis(0), halfExt.y*obb:getAxis(1), halfExt.z*obb:getAxis(2)
                send(v.id, rayHitPos:distanceToLine(
                    center+halfExtX+halfExtY+halfExtZ,
                    center+halfExtX+halfExtY-halfExtZ),
                    rayHitPos:distanceToLine(
                        center-halfExtX+halfExtY+halfExtZ,
                        center-halfExtX+halfExtY-halfExtZ))
            end
        end
        canClick = canClick or clickable
    end

    if canClick then
        -- ugly asf but works
        ui_imgui.SetMouseCursor(7)
        canClick = false
    end
end

local function loadBoxes(path)
    boxes = jsonReadFile(path) or {}
    if not boxes[1] then return end
    for k=1, #boxes do local v = boxes[k];
        boxes[k].pos = vec3(v.pos[1],v.pos[2],v.pos[3])
        boxes[k].size = vec3(v.size[1],v.size[2],v.size[3])
        if v.debugCol then
            boxes[k].debugCol = ColorF(v.debugCol[1],v.debugCol[2],v.debugCol[3],v.debugCol[4])
        end
    end
end

local function setFocusCar(id)
    vehicle = scenetree.findObject(id)
    registeredVehicles[id] = true
end

local function onVehicleDestroyed(vid)
    if vehicle and vehicle:getId() == vid then
        vehicle = nil
    end
    registeredVehicles[vid] = nil
    if not next(registeredVehicles) then
        extensions.unload("zeit_ccfScreenInteract")
    end
end

local function onExtensionLoaded()
end

M.onUpdate = onUpdate
M.onExtensionLoaded = onExtensionLoaded
M.setFocusCar = setFocusCar
M.loadBoxes = loadBoxes
M.onVehicleDestroyed = onVehicleDestroyed

return M