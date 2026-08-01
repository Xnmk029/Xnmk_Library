-- Made by Inn0centJok3r

local M = {}

local doorL = nil
local doorR = nil
local doorLWindow = nil
local doorRWindow = nil
local roof = nil
local doorsOpen = 0
local roofOpen = 0
local windowsOpen = 0
local doorStateChanged = 0
local roofStateChanged = 0
local windowStateChanged = 0
local doorMissing = false
local cabinFilterCoef = 1
local cabinFilterChanged = false
local windowDamaged = false
local windowRDeformGroup = false
local windowLDeformGroup = false
local windowRearDeformGroup = false
local windowBroken = false
local playerSeated = false
local playerSeatedCache = false
local playerSeatedChanged = false
local timerBecauseGameIsRart = 0

-- This code controls the cabin filter depending on whether the doors or roof are opened
local function init(jbeamData)
	--Get deformGroup name for window damage	
	windowRDeformGroup = jbeamData.windowRDeformGroup or "doorglass_R_break"
	windowLDeformGroup = jbeamData.windowLDeformGroup or "doorglass_L_break"
	windowRearDeformGroup = jbeamData.windowRearDeformGroup or "tonneauglass"
	doorL = nil
	doorR = nil
	doorLWindow = nil
	doorRWindow = nil
	roof = nil
	playerSeated = false
	playerSeatedCache = false
	playerSeatedChanged = false
	
	if v.data.sounds then
		cabinFilterCoef = v.data.sounds.cabinFilterCoef == nil and 1 or v.data.sounds.cabinFilterCoef
		--print(cabinFilterCoef)
	end
end

local function reset()
	windowBroken = false
	windowDamaged = false
	doorsOpen = 0
	roofOpen = 0
	windowsOpen = 0
	doorStateChanged = 0
	roofStateChanged = 0
	windowStateChanged = 0
	playerSeated = false
	playerSeatedCache = false
	playerSeatedChanged = false
	timerBecauseGameIsRart = 0
	
	if cabinFilterChanged then
		obj:queueGameEngineLua(string.format("core_sounds.cabinFilterStrength = %f", cabinFilterCoef))
		cabinFilterChanged = false
	end
end

local function updateGFX(dt)
	
	playerSeated = playerInfo.anyPlayerSeated
	
	if playerSeated ~= playerSeatedCache or timerBecauseGameIsRart > 0 then
		
		if timerBecauseGameIsRart < 0.1 then
			timerBecauseGameIsRart = timerBecauseGameIsRart + dt
		else
			playerSeatedChanged = true
			timerBecauseGameIsRart = 0
		end
	end
	--Door open detection logic as well as domelight and cabin filter logic
	--set to 1 when doesnt exist
	
	--Check if door glass is broken
	--windowBroken is there to prevent the filter command from being spammed
	if windowDamaged and not windowBroken and playerInfo.anyPlayerSeated or playerSeatedChanged and windowDamaged and playerInfo.anyPlayerSeated then
		windowBroken = true
		cabinFilterChanged = true
		obj:queueGameEngineLua(string.format("core_sounds.cabinFilterStrength = %f", 0))
	end
	

	if electrics.values["doorLCoupler_notAttached"] then
		doorL = electrics.values["doorLCoupler_notAttached"]
	else
		doorMissing = true
	end
	if electrics.values["doorRCoupler_notAttached"] then
		doorR = electrics.values["doorRCoupler_notAttached"]
	else
		doorMissing = true
	end
	if electrics.values["window_left_prop"] then
		doorLWindow = electrics.values["window_left_prop"]
	else
		doorMissing = true
	end
	if electrics.values["window_right_prop"] then
		doorRWindow = electrics.values["window_right_prop"]
	else
		doorMissing = true
	end
	if electrics.values["roofOpen_notAttached"] then
		roof = electrics.values["roofOpen_notAttached"]
	else
		roof = 1
	end
	if electrics.values["roofOpen_notAttached"] == 1 or electrics.values["hardtopF_notAttached"] == 1 or electrics.values["hardtopRR_notAttached"] == 1 or electrics.values["hardtopRL_notAttached"] == 1 then
		roof = 1
	elseif electrics.values["roofOpen_notAttached"] == 0 or electrics.values["hardtopF_notAttached"] == 0 or electrics.values["hardtopRR_notAttached"] == 0 or electrics.values["hardtopRL_notAttached"] == 0 then
		roof = 0
	else 
		roof = 1
	end

	if doorR == 1 or doorL == 1 or doorRWindow ~= 0 or doorLWindow ~= 0 or roof == 1 then
	
		if roof == 1 then
			roofOpen = 1
		else
			roofOpen = 0
		end
		
		if doorR == 1 or doorL == 1 then
			doorsOpen = 1
		else
			doorsOpen = 0
		end
		
		if doorRWindow ~= 0 or doorLWindow ~= 0 then
			windowsOpen = 1
		else
			windowsOpen = 0
		end
		
		if doorStateChanged ~= doorsOpen or roofStateChanged ~= roofOpen or windowStateChanged ~= windowsOpen or playerSeatedChanged then
			roofStateChanged = roofOpen
			doorStateChanged = doorsOpen
			windowStateChanged = windowsOpen
			
			if doorR == 1 or doorL == 1 then
				if not doorMissing then electrics.values["ceilingLight"] = 1 end --only change it when ignition is on and no door is missing (otherwise kinda annoying)
			else
				if not doorMissing and electrics.values["ceilingLight"] == 1 then electrics.values["ceilingLight"] = 0 end
			end
	
			if playerInfo.anyPlayerSeated and not windowBroken or playerSeatedChanged then
				cabinFilterChanged = true
				obj:queueGameEngineLua(string.format("core_sounds.cabinFilterStrength = %f", 0))
			end
		end
	else
		doorsOpen = 0
		roofOpen = 0
		windowsOpen = 0
		if doorStateChanged ~= doorsOpen or roofStateChanged ~= roofOpen or windowStateChanged ~= windowsOpen or playerSeatedChanged and not windowBroken then
			roofStateChanged = roofOpen
			doorStateChanged = doorsOpen
			windowStateChanged = windowsOpen
			
			electrics.values["ceilingLight"] = 0
			if playerInfo.anyPlayerSeated and not windowBroken or playerSeatedChanged then
				cabinFilterChanged = false
				obj:queueGameEngineLua(string.format("core_sounds.cabinFilterStrength = %f", cabinFilterCoef))
			end
		end
	end

	if playerSeatedChanged then
		playerSeatedCache = playerSeated
		playerSeatedChanged = false
	end
end

local function beamBroken(id, energy)
    -- Grab the beam data from v.data
    local beam = v.data.beams[id]

    -- Skip if the beam doesn't have a breakGroup
    if not beam or not beam.breakGroup then return end

	if beam.breakGroup == windowRDeformGroup or beam.breakGroup == windowLDeformGroup or beam.breakGroup == windowRearDeformGroup then
		windowDamaged = true
	end
end


-- public interface
M.init = init
M.reset = reset
M.beamBroken = beamBroken
M.updateGFX = updateGFX

return M