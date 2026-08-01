local M = {}
M.type = "auxiliary"
M.relevantDevice = nil

--Created by Inn0centJok3r

local needleSmoother = newTemporalSmoothingNonLinear(15)
--This smoother is used in order to smoothen the smoothening twofold when the engine is turned off while the car is moving, so that the needle does not move to 0 so rapidly
local needleSmootherOff = newExponentialSmoothing(40) 
local gaugeType
local ignition = 0
local readyForStartup = false
local timer = 0
local rpm = 0
local needlePos = 0
local engineOffSmoothen = 0

local function lerp(a,b,t) 
    return a * (1-t) + b * t 
end

local function clamp(min, max, val)
	if val < min then
		val = min
	elseif max < val then
		val = max
	end
	return val
end

local function updateGFX(dt) 

	if electrics.values["rpm"] == nil then 
		electrics.values["innocent_custom_rpm"] = 0
		return
	end
	
	ignition = electrics.values["ignitionLevel"]
	rpm = electrics.values["rpm"]
	
	if ignition < 2 then
		readyForStartup = true
	end

  if gaugeType == "ice" then
	--If ignition state is 2 or higher and was in a lower state before, initiate start up sequence
	if readyForStartup and ignition >= 2 then
		--Startup logic
		timer = timer + dt
		if timer < 1.2 then
			if (needlePos + 12000 * dt) < 10000 then
				needlePos = needlePos + 12000 * dt
			else
				needlePos = 10000
			end
			electrics.values["innocent_custom_rpm"] = needleSmoother:get(needlePos, dt)

		elseif timer >= 1.2 and timer < 2.4 then
			if (needlePos - 12000 * dt) > 0 then
				needlePos = needlePos - 12000 * dt
			else
				needlePos = 0
			end
			electrics.values["innocent_custom_rpm"] = needleSmoother:get(needlePos, dt)
		elseif timer >= 2.4 and timer < 3 then
			needlePos = needleSmoother:get(rpm, dt)
			electrics.values["innocent_custom_rpm"] = needleSmoother:get(needlePos, dt)
		else
			needlePos = 0
			timer = 0
			readyForStartup = false
		end
		
	else
		--Logic for gauge movement after startup
		if needlePos ~= 0 and timer ~= 0 and readyForStartup then 
			needlePos = 0
			timer = 0
			readyForStartup = false
		end
		if ignition >= 2 then
			electrics.values["innocent_custom_rpm"] = needleSmoother:get(rpm, dt)
			engineOffSmoothen = needleSmootherOff:get(rpm, dt)
		else
			engineOffSmoothen = needleSmootherOff:get(0, dt)
			electrics.values["innocent_custom_rpm"] = needleSmoother:get(engineOffSmoothen, dt)
		end
	end

  elseif gaugeType == "electric" then
	--If ignition state is 2 or higher and was in a lower state before, initiate start up sequence
	if readyForStartup and ignition >= 2 then
		--Startup logic
		timer = timer + dt
		if timer < 1.2 then
			if (needlePos + 24000 * dt) < 20000 then
				needlePos = needlePos + 24000 * dt
			else
				needlePos = 20000
			end
			electrics.values["innocent_custom_rpm"] = needleSmoother:get(needlePos, dt)
			
		elseif timer >= 1.2 and timer < 2.4 then
			if (needlePos - 24000 * dt) > 0 then
				needlePos = needlePos - 24000 * dt
			else
				needlePos = 0
			end
			electrics.values["innocent_custom_rpm"] = needleSmoother:get(needlePos, dt)
		elseif timer >= 2.4 and timer < 3 then
			needlePos = needleSmoother:get(rpm, dt)
			electrics.values["innocent_custom_rpm"] = needleSmoother:get(needlePos, dt)
		else
			needlePos = 0
			timer = 0
			readyForStartup = false
		end
		
	else
		--Logic for gauge movement after startup
		if needlePos ~= 0 and timer ~= 0 and readyForStartup then 
			needlePos = 0
			timer = 0
			readyForStartup = false
		end
		if ignition >= 2 then
			electrics.values["innocent_custom_rpm"] = needleSmoother:get(rpm, dt)
			engineOffSmoothen = needleSmootherOff:get(rpm, dt)
		else
			engineOffSmoothen = needleSmootherOff:get(0, dt)
			electrics.values["innocent_custom_rpm"] = needleSmoother:get(engineOffSmoothen, dt)
		end
	end
  end
end

local function init(jbeamData)
	electrics.values["innocent_custom_rpm"] = 0
	gaugeType = jbeamData.gaugeType or "ice"
	rpm = 0
	timer = 0
	needlePos = 0
	engineOffSmoothen = 0
	readyForStartup = false
end 

M.updateGFX = updateGFX
M.init = init
return M