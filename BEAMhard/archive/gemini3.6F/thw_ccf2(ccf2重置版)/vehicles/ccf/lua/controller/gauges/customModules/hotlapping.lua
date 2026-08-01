-- written by DaddelZeit
-- DO NOT USE WITHOUT PERMISSION

local M = {}

local gaugeHTMLTexture
local timeInfo = {}
local updateTime = 1
local updateTimer = 1

local function updateGaugeData(moduleData, dt)
end

local function evaluateMailbox()
    timeInfo = lpack.decode(obj:getLastMailbox("zeitHotlappingInfo")) or {}
    gaugeHTMLTexture:streamJS("hotLappingInfoUpdate", "hotLappingInfoUpdate", timeInfo)
end

local function updateGFX(dt)
    updateTimer = updateTimer + dt
    if updateTimer > updateTime then
        obj:queueGameEngineLua([[
            if core_hotlapping then
                be:sendToMailbox("zeitHotlappingInfo", lpack.encodeBin(core_hotlapping.getTimeInfo()))
            else
                be:sendToMailbox("zeitHotlappingInfo", lpack.encodeBin({}))
            end
        ]])
        evaluateMailbox()
        updateTimer = 0
    end
end

local function setupGaugeData(properties, htmlTexture)
    gaugeHTMLTexture = htmlTexture
end

local function init(jbeamData)
    updateTime = jbeamData.updateTime or 1
end

M.init = init
M.setupGaugeData = setupGaugeData
M.updateGaugeData = updateGaugeData
M.updateGFX = updateGFX

return M