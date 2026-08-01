-- written by DaddelZeit
-- DO NOT USE WITHOUT PERMISSION

local M = {}

local registeredVehicles = {}
local mailboxData = {}
local lightPropCache = {}
local zoneObbTable = {}
local playerId = be:getPlayerVehicleID(0)
local playerVeh = be:getObjectByID(playerId)
local curSlot = 0

local function getLaneOfPoint(_map, p1, p2, position, vehFwd)
    local needInvert = true --(vehFwd:dot((_map.nodes[p1].pos - position):normalized()) > 0.5)
    local node = needInvert and _map.nodes[p1] or _map.nodes[p2]
    local node2 = needInvert and _map.nodes[p2] or _map.nodes[p1]
    local radius = node.radius

    -- see traffic.lua
    local roadWidth = radius * 2
    local laneWidth = roadWidth >= 6.1 and 3.05 or 2.4

    if node.links[p2] and node.links[p2].oneWay or node2.links[p2] and node2.links[p2].oneWay then
        local dirToNextNode = vec3(node2.pos:z0() - node.pos:z0()):normalized()
        local perpendicularVecDirRight = vec3(dirToNextNode.y, -dirToNextNode.x, 0):normalized()
        local distanceToRight = position:distanceToLine(node.pos + (perpendicularVecDirRight*node.radius), node2.pos + (perpendicularVecDirRight*node2.radius))
        return math.ceil(distanceToRight/laneWidth)
    else
        local distanceToMiddle = position:distanceToLine(node.pos, node2.pos)
        -- https://stackoverflow.com/questions/1560492/how-to-tell-whether-a-point-is-to-the-right-or-left-side-of-a-line
        local roadSide = ((node.pos.x - node2.pos.x) * (position.y - node2.pos.y) - (node.pos.y - node2.pos.y) * (position.x - node2.pos.x)) > 0 and 1 or -1
        return math.ceil(distanceToMiddle/laneWidth)*roadSide
    end
end

local function getLane(vehOBBCenter, vehOBBHalfX, vehOBBAxisX, cornerCheck)
    local p1, p2 = map.findClosestRoad(vehOBBCenter)
    if not p1 or not p2 then return 1 end
    local _map = map.getMap()

    if cornerCheck then
        local checks = {
            vec3(0,0,0), -- center
            vehOBBHalfX*vehOBBAxisX, -- outer left
            -vehOBBHalfX*vehOBBAxisX, -- outer right
        }

        for k,v in ipairs(checks) do
            -- overwrite the vectors with their lane
            checks[k] = getLaneOfPoint(_map, p1, p2, vehOBBCenter+v)
        end

        -- if the player is in the same lane as one of the points use his lane!
        if mailboxData[playerId] and (
            mailboxData[playerId].lane == checks[1] or
            mailboxData[playerId].lane == checks[2] or
            mailboxData[playerId].lane == checks[3]) then

            return mailboxData[playerId].lane
        else
            -- else use rounded avg of all points
            local avgLane = (checks[1]+checks[2]+checks[3])
            return math.floor(avgLane+0.5)
        end
    else
        return getLaneOfPoint(_map, p1, p2, vehOBBCenter)
    end
end

local function getCombinedVec3(ambcolor)
    return (ambcolor[1]+ambcolor[2]+ambcolor[3])/3
end

local function getAmbColor(veh)
    for _,v in pairs(zoneObbTable) do
        if v[1]:isContained(veh:getPosition()) then
            return getCombinedVec3(v[2]:toTable())
        end
    end

    -- we're sure that the vehicle is not inside a zone at this point
    local sky = scenetree.sunsky
    if not sky and scenetree.findClassObjects("ScatterSky")[1] then
        sky = scenetree.findObject(scenetree.findClassObjects("ScatterSky")[1])
    end

    if sky and sky.ambientScale then
        return getCombinedVec3(sky.ambientScale:toTable())
    else
        return 1
    end
end

local function getLightsActive(object, id)
    if not lightPropCache[id] then
        local vdata = core_vehicle_manager.getVehicleData(id) or {}
        vdata = vdata.vdata or {}
        for _,v in pairs(vdata.props or {}) do
            if v.func and (v.func:match("lowbeam") or v.func:match("lowhighbeam")) then
                lightPropCache[id] = v.pid
                break
            end
        end
    else
        if object.getProp and object:getProp(lightPropCache[id]) then
            return object:getProp(lightPropCache[id]):getDataValue() > 0
        end
    end
end

local function buildCarTable(veh, vehId)
    if veh and veh:getActive() then
        -- local cast = ffi.cast("struct{float sensorX; float sensorY;}*", obj:getSensorsFFI())

        local vehOBB = veh:getSpawnWorldOOBB()
        local bbCenter = vehOBB:getCenter()
        local axis0, axis1, axis2 = vehOBB:getAxis(0), vehOBB:getAxis(1), vehOBB:getAxis(2)
        local halfExtentsX, halfExtentsY, halfExtentsZ = vehOBB:getHalfExtents().x, vehOBB:getHalfExtents().y, vehOBB:getHalfExtents().z

        local tbl = {
            center = bbCenter,
            lane = getLane(
                bbCenter,
                halfExtentsX,
                axis0,
                (bbCenter:distance(mailboxData[playerId] and mailboxData[playerId].center or vec3(0,0,0)) < 70) and
                (playerVeh:getForwardVector():dot((bbCenter - (mailboxData[playerId] and mailboxData[playerId].center or vec3(0,0,0))):normalized()) > 0.5)
            ),

            halfExtentsX = halfExtentsX,

            x = halfExtentsX*axis0,
            y = halfExtentsY*axis1,
            z = halfExtentsZ*axis2,

            lightsActive = getLightsActive(veh, vehId),

            -- enter this only for the player
            ambColor = vehId == playerId and getAmbColor(playerVeh) or nil
        }

        tbl.x09 = tbl.x*0.9
        --tbl.x6 = tbl.x*6
        tbl.y2 = tbl.y*2
        --tbl.y6 = tbl.y*6
        --tbl.z15 = tbl.z*15

        return tbl
    else
        return nil
    end
end

local function onUpdate(dt)
    local curVeh = be:getObject(curSlot-1)
    if curVeh then
        local curVehId = curVeh:getId()
        mailboxData[curVehId] = buildCarTable(curVeh, curVehId)
    end

    curSlot = curSlot - 1
    if curSlot <= 0 then
        curSlot = be:getObjectCount()
    end

    be:sendToMailbox("zeitADASVehOBBs", lpack.encodeBin(mailboxData))
end

local function updateColTriMailbox()
    local trisMailboxData = {}

    for i = 0, be:getObjectCount()-1 do
        local veh = be:getObject(i)
        local vehId = veh:getId()

        local vdata = core_vehicle_manager.getVehicleData(vehId) or {}
        trisMailboxData[vehId] = vdata.vdata and vdata.vdata.triangles or {}
    end

    be:sendToMailbox("zeitADASVehTris", lpack.encodeBin(trisMailboxData))
end

local function updateAmbientZones()
    zoneObbTable = {}
    for _,id in pairs(scenetree.findClassObjects("Zone")) do
        local object = scenetree.findObject(id)
        if object.useAmbientLightColor then
            local objectId = object:getId()
            local obb = OrientedBox3F()
            obb:set2(object:getTransform(), object:getScale())
            zoneObbTable[objectId] = {obb, object.ambientLightColor}
        end
    end
end

local function registerVehicle(id)
    registeredVehicles[id] = true
end

local function onVehicleDestroyed(vid)
    mailboxData[vid] = nil
    updateColTriMailbox()

    registeredVehicles[vid] = nil
    if not next(registeredVehicles) then
        extensions.unload("zeit_ccfGetVehOBBs")
    end
end

local function onVehicleSpawned()
    updateColTriMailbox()
end

local function onVehicleSwitched(_, newId)
    dump("zeit_ccfGetVehOBBs")
    playerId = newId
    playerVeh = be:getObjectByID(newId)
    curSlot = be:getObjectCount()
end

local function onExtensionLoaded()
    -- MOD INCLUSION: TRY LOADING OFFICIAL MODULE FIRST
    if FS:fileExists("/lua/ge/extensions/zeit/zeitADASGetVehData.lua") then
        extensions.load("zeit_zeitADASGetVehData")
        extensions.unload("zeit_ccfGetVehOBBs")
        rawset(_G, "zeit_ccfGetVehOBBs", zeit_zeitADASGetVehData) -- replace this one with the proper one
        return
    end

    updateAmbientZones()
    updateColTriMailbox()
end

M.onExtensionLoaded = onExtensionLoaded
M.onVehicleSwitched = onVehicleSwitched
M.onVehicleDestroyed = onVehicleDestroyed
M.onVehicleSpawned = onVehicleSpawned
M.onClientPostStartMission = updateAmbientZones
M.registerVehicle = registerVehicle
M.onUpdate = onUpdate

return M