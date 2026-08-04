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
local brakeGlow_rr = 0
local function init(jbeamData)
	brakeglow = jbeamData.materialName
	htmlPath = jbeamData.htmlPath
	local width = jbeamData.textureWidth or 256
	local height = jbeamData.textureHeight or 256

	brakeGlow_rr = 0

	electrics.values.brakeTempRR = brakeGlow_rr

    htmlTexture.create(brakeglow, htmlPath, width, height, updateFPS, "automatic")
	htmlTexture.call(brakeglow, "init", brakeGlow_rr)
end

local function updateGFX(dt)
  updateTimer = updateTimer + dt
  if updateTimer > invFPS then

	if electrics.values.wheelThermals.RR then
		brakeGlow_rr = electrics.values.wheelThermals.RR.brakeSurfaceTemperature or 0
	elseif electrics.values.wheelThermals.RR1 then
		brakeGlow_rr = electrics.values.wheelThermals.RR1.brakeSurfaceTemperature or 0
	end
	electrics.values.brakeTempRR = brakeGlow_rr

    htmlTexture.call(brakeglow, "update", brakeGlow_rr)
    updateTimer = 0
  end
end

M.init = init
M.updateGFX = updateGFX

return M
