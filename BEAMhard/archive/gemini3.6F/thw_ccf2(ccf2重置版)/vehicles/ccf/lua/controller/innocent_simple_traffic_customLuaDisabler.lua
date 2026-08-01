--Made by Inn0centJok3r - I know, IMMENSELY complex code right here :p
local M = {}
M.type = "auxiliary"
M.relevantDevice = nil

local function init()

	electrics.values["isSimpleTrafficCar"] = true

end

M.init = init
M.updateGFX = nop

return M
