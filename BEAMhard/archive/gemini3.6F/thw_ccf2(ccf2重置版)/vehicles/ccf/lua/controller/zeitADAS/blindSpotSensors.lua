-- written by DaddelZeit
-- DO NOT USE WITHOUT PERMISSION

local M = {}

local blindSpotTimer = 0
local blindSpotData = {}
local blindSpotEnabled = true
M.blindSpotRightTriggered = false
M.blindSpotLeftTriggered = false

local function zeitADASUpdate(dt, mailboxData)
    if not blindSpotEnabled then return end
    blindSpotTimer = blindSpotTimer + dt
    if blindSpotTimer > 0.15 then
        local n = beamstate.nodeNameMap
        local nm = blindSpotData.nodePrefixes
        local vehPos = obj:getPosition()

        local data = {}
        data.rightPoint = obj:getNodePosition(n[nm[1].."r"])
        data.leftPoint = obj:getNodePosition(n[nm[1].."l"])

        data.rightPoint2 = #nm == 3 and (obj:getNodePosition(n[nm[2].."r"]) + obj:getNodePosition(n[nm[3].."r"]))/2 or obj:getNodePosition(n[nm[2].."r"])
        data.leftPoint2 = #nm == 3 and (obj:getNodePosition(n[nm[2].."l"]) + obj:getNodePosition(n[nm[3].."l"]))/2 or obj:getNodePosition(n[nm[2].."l"])

        data.rightDir = vec3(data.rightPoint2 - data.rightPoint):normalized()
        data.leftDir = vec3(data.leftPoint2 - data.leftPoint):normalized()

        --[[
        local debugDrawer = obj.debugDrawProxy
        debugDrawer:drawSphere(0.05, vehPos+data.rightPoint, color(255,0,0,255))
        debugDrawer:drawLine(vehPos+data.rightPoint, vehPos+data.rightPoint+data.rightDir, color(255,0,0,255))

        debugDrawer:drawSphere(0.05, vehPos+data.leftPoint, color(255,0,0,255))
        debugDrawer:drawLine(vehPos+data.leftPoint, vehPos+data.leftPoint+data.leftDir, color(255,0,0,255))
        ]]

        M.blindSpotRightTriggered = false
        M.blindSpotLeftTriggered = false

        for k,v in pairs(mailboxData) do
            if k ~= obj:getId() then
                local rightResult1, rightResult2 = intersectsRay_OBB(vehPos + data.rightPoint, data.rightDir, v.center, v.x, v.y2, v.z)
                if rightResult1 > 1 and rightResult1 < 10 then
                    M.blindSpotRightTriggered = true
                end

                local leftResult1, leftResult2 = intersectsRay_OBB(vehPos + data.leftPoint, data.leftDir, v.center, v.x, v.y2, v.z)
                if leftResult1 > 1 and leftResult1 < 10 then
                    M.blindSpotLeftTriggered = true
                end
            end
        end

        electrics.values.rightBlindSpotTriggered = M.blindSpotRightTriggered
        electrics.values.leftBlindSpotTriggered = M.blindSpotLeftTriggered

        blindSpotTimer = 0
    end
end

local function init(jbeamData)
    local n = beamstate.nodeNameMap
    blindSpotData = jbeamData or {}

    for _,v in ipairs(jbeamData.nodePrefixes) do
        if not n[v.."r"] then
            blindSpotEnabled = false
            log("D", "zeitADAS.blindSpotInit", "A node specified for the right mirror does not exit, aborting init")
            break
        end
        if not n[v.."l"] then
            blindSpotEnabled = false
            log("D", "zeitADAS.blindSpotInit", "A node specified for the left mirror does not exit, aborting init")
            break
        end
    end

    electrics.values.rightBlindSpotTriggered = false
    electrics.values.leftBlindSpotTriggered = false
end

M.zeitADASUpdate = zeitADASUpdate
M.init = init

return M