-- written by DaddelZeit
-- DO NOT USE WITHOUT PERMISSION

local M = {}

local lastLightsState = 0
local highbeamElectricsName = "highbeam_moveupanim"
local targetValue = 0
local valueSmoother = newTemporalSmoothing(3)
local lastVal = 0

local function updateGFX(dt)
	if not electrics.values["isSimpleTrafficCar"] then

		local lightsState = electrics.values.lights_state
		if lightsState ~= lastLightsState then
			targetValue = lightsState == 2 and 1.1 or 0
			lastLightsState = lightsState
		end

		local val = valueSmoother:get(targetValue, dt)
		if lastVal ~= val then
			electrics.values[highbeamElectricsName] = val
			lastVal = val
		end
	else 
		M.updateGFX = nop;
	end
end

M.updateGFX = updateGFX

return M