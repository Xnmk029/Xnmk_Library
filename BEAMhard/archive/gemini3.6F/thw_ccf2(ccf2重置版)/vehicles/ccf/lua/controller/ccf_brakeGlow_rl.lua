--Thanks to TrackpadUser for the base code and aljowen for the smooth brake glow concept :3
local M = {}
M.type = "auxiliary"
M.relevantDevice = nil

local htmlTexture = require("htmlTexture")

local brakeglow = nil
local htmlPath = nil

local updateTimer = 0
local updateFPS = 30
local invFPS = 1 / updateFPS
local brakeGlow_rl = 0

local function init(jbeamData)
	brakeglow = jbeamData.materialName
	htmlPath = jbeamData.htmlPath
	local width = jbeamData.textureWidth or 256
	local height = jbeamData.textureHeight or 256

	brakeGlow_rl = 0

	electrics.values.brakeTempRL = brakeGlow_rl

    htmlTexture.create(brakeglow, htmlPath, width, height, updateFPS, "automatic")
	htmlTexture.call(brakeglow, "init", brakeGlow_rl)
end

local function updateGFX(dt)
  updateTimer = updateTimer + dt
  if updateTimer > invFPS then

	if electrics.values.wheelThermals.RL then
		brakeGlow_rl = electrics.values.wheelThermals.RL.brakeSurfaceTemperature or 0
	elseif electrics.values.wheelThermals.RL1 then
		brakeGlow_rl = electrics.values.wheelThermals.RL1.brakeSurfaceTemperature or 0
	end
	electrics.values.brakeTempRL = brakeGlow_rl

    htmlTexture.call(brakeglow, "update", brakeGlow_rl)
    updateTimer = 0
  end
end

M.init = init
M.updateGFX = updateGFX

return M
