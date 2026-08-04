-- written by DaddelZeit
-- DO NOT USE WITHOUT PERMISSION

local M = {}

local serviceTimer = 0
local function serviceRequired(dt)
    serviceTimer = serviceTimer + dt

    if serviceTimer >= 3 then
      if damageTracker.getDamage("engine", "oilRadiatorLeak") then return true
      elseif damageTracker.getDamage("engine", "headGasketDamaged") then return true
      elseif damageTracker.getDamage("engine", "pistonRingsDamaged") then return true
      elseif damageTracker.getDamage("engine", "rogBearingsDamaged") then return true
      elseif damageTracker.getDamage("engine", "blockMelted") then return true
      elseif damageTracker.getDamage("engine", "cylinderWallsMelted") then return true
      elseif damageTracker.getDamage("engine", "radiatorLeak") then return true
      elseif damageTracker.getDamage("engine", "exhaustBroken") then return true
      elseif damageTracker.getDamage("engine", "inductionSystemDamaged") then return true
      elseif damageTracker.getDamage("engine", "superchargerDamaged") then return true
      elseif damageTracker.getDamage("engine", "turbochargerDamaged") then return true
      elseif damageTracker.getDamage("engine", "engineTorqueReduced") then return true
      elseif damageTracker.getDamage("engine", "impactDamage") then return true
      elseif damageTracker.getDamage("engine", "catastrophicOverrevDamaged") then return true
      elseif damageTracker.getDamage("engine", "mildOverrevDamage") then return true
      elseif damageTracker.getDamage("engine", "engineDisabled") then return true
      elseif damageTracker.getDamage("engine", "engineLockedUp") then return true
      elseif damageTracker.getDamage("engine", "energyStorage") then return true
      end
      serviceTimer = 0
    end

    return false
end

local function updateGFX(dt)
    if electrics.values.oilPanLeak ~= 1 then -- since we cannot fix the oilpan without reset anyways
        if damageTracker.getDamage("engine", "oilpanLeak") then
            electrics.values.oilPanLeak = 1
        end
    end

    electrics.values.highBraketemp = 0
    for _, v in pairs(electrics.values.wheelThermals) do
        if v.brakeCoreTemperature >= 550 then
            electrics.values.highBraketemp = 1
        end
    end

    electrics.values.tirepressure = 0
    local envPressure = obj:getEnvPressure()*0.0001450377
    if wheels.wheels then
        for _, wd in pairs(wheels.wheels) do
            local pressureGroup = v.data.pressureGroups[wd.pressureGroup]
            if pressureGroup then
                local wheelPressure = obj:getGroupPressure(pressureGroup)*0.0001450377-envPressure
                if wheelPressure < 5 then
                    electrics.values.tirepressure = 1
                end
            end
        end
    end

    electrics.values.checkengineBetter = serviceRequired(dt)
end

local function onBeamBroke(cid)
    local beam = v.data.beams[cid]
    if not beam or not beam.deformGroup then return end

    if tostring(beam.deformGroup):match("light") or tostring(beam.deformGroup):match("signal") or tostring(beam.deformGroup):match("drl") then
        electrics.values.lightBroken = true
    end
end

local function onInit()
	if not electrics.values["isSimpleTrafficCar"] then

		electrics.values.oilPanLeak = 0
		electrics.values.highBraketemp = 0
		electrics.values.tirepressure = 0
		electrics.values.checkengineBetter = false
		electrics.values.lightBroken = false
	else
		M.onReset = nop;
		M.updateGFX = nop;
	end
end

-- public interface
M.onInit = onInit
M.onReset = onInit
M.onBeamBroke = onBeamBroke
M.updateGFX = updateGFX

return M