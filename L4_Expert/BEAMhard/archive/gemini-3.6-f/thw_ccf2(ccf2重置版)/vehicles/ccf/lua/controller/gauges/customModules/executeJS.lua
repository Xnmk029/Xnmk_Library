-- written by DaddelZeit
-- DO NOT USE WITHOUT PERMISSION

local M = {}

local gaugeHTMLTexture
local function executeFunc(func, ...)
    gaugeHTMLTexture:callJS(func, {...})
end

local function setupGaugeData(_, htmlTexture)
    gaugeHTMLTexture = htmlTexture
end

M.init = nop
M.setupGaugeData = setupGaugeData
M.updateGaugeData = nop
M.executeFunc = executeFunc

return M