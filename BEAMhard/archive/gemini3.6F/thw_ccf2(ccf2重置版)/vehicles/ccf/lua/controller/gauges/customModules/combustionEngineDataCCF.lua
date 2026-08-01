-- This Source Code Form is subject to the terms of the bCDDL, v. 1.1.
-- If a copy of the bCDDL was not distributed with this
-- file, You can obtain one at http://beamng.com/bCDDL-1.1.txt

local M = {}
M.type = "auxiliary"

local min = math.min
local max = math.max

local wattToHorsePower = 0.001 * 1.35962

local updateFuelConsumption = false
local updateFuelDisplay = false
local updatePowerCalculation = false
local updateRemainingRange = false
local timeSinceRespawn = true
local gearIndexNoNeutral = false

local engines = {}
local fuelTanks = {}

local averagePower = 0
local avgPowerSmoother = newExponentialSmoothing(1000)

local currentPowerSmoother = newExponentialSmoothing(30)
local currentTorqueSmoother = newExponentialSmoothing(30)
local avgConsumptionSmoother = newExponentialSmoothing(5000)
local avgConsumptionSmootherSinceRefuel = newExponentialSmoothing(5000)
local fuelDisplaySmoother = newTemporalSmoothing(5, 3)
local remainingRangeSmoother = newTemporalSmoothing(50, 50)

local avgConsumptionPer100km = 0
local avgConsumptionSinceRefuel = 0
local timeSinceRespawnSeconds = 0

local previousFuel = 0
local fuelSmoother = newTemporalSmoothing(50, 50)

local function updateGFX(dt)
end

local function updateGaugeData(moduleData, dt)
  local wheelspeed = electrics.values.wheelspeed
  local isMoving = wheelspeed > 0.5

  local fuelVolume = electrics.values.fuelVolume or 0
  local fuelConsumption = min(max((previousFuel - fuelVolume) / (dt * wheelspeed) * 1000 * 100, 0), 100) -- l/100km
  fuelConsumption = fuelSmoother:getUncapped(fuelConsumption, dt)
  previousFuel = fuelVolume

  if updateFuelDisplay then
    local fuelDisplay = min(max((3 * fuelConsumption) / 30, 0), 3)
    if (electrics.values.engineLoad or 0) <= 0 then
      fuelDisplay = -1
    end
    if wheelspeed < 1 and (electrics.values.throttle or 0) <= 0 then
      fuelDisplay = 0
    end
    moduleData.fuelDisplay = fuelDisplaySmoother:getUncapped(fuelDisplay, dt)
  end

  if updateFuelConsumption then
    avgConsumptionPer100km = 0
    if (electrics.values.wheelspeed or 0) > 0.1 then
      avgConsumptionPer100km = avgConsumptionSmoother:get(min(max(fuelConsumption, 0), 50))
      avgConsumptionSinceRefuel = avgConsumptionSmootherSinceRefuel:get(min(max(fuelConsumption, 0), 50))
    end

    moduleData.averageFuelConsumption = avgConsumptionPer100km
    moduleData.averageFuelConsumptionSinceRefuel = avgConsumptionSinceRefuel
    moduleData.currentFuelConsumption = fuelConsumption
  end

  if updatePowerCalculation then
    local currentPower = 0
    local currentTorque = 0
    for _, motor in ipairs(engines) do
      currentPower = currentPower + (motor.outputTorque1 * motor.outputAV1)
      currentTorque = currentTorque + motor.outputTorque1
    end
    currentPower = currentPowerSmoother:get(currentPower) * wattToHorsePower --HP
    averagePower = avgPowerSmoother:get(isMoving and currentPower or averagePower)
    currentTorque = currentTorqueSmoother:get(currentTorque) --Nm
    moduleData.currentPower = isMoving and currentPower or 0
    moduleData.averagePower = averagePower
    moduleData.currentTorque = currentTorque
  end

  if updateRemainingRange then
    local energyLeft = 0
    local JToLiterCoef = 0
    for _, b in ipairs(fuelTanks) do
      local storage = energyStorage.getStorage(b)
      energyLeft = energyLeft + storage.storedEnergy
      JToLiterCoef = storage.energyDensity * storage.fuelLiquidDensity * 0.000000001
    end
    moduleData.remainingRange = remainingRangeSmoother:get(avgConsumptionPer100km > 0 and (energyLeft * JToLiterCoef / avgConsumptionPer100km * 0.0001) or 0, dt)
  end

  if timeSinceRespawn then
    timeSinceRespawnSeconds = timeSinceRespawnSeconds + dt
    local second = timeSinceRespawnSeconds%60
    local minute = timeSinceRespawnSeconds/60%60
    local hours = timeSinceRespawnSeconds/3600
    moduleData.secondsSinceRespawn = math.floor(second)
    moduleData.minutesSinceRespawn = math.floor(minute)
    moduleData.hoursSinceRespawn = math.floor(hours)
  end

  if gearIndexNoNeutral then
    --[[
    local index = electrics.values.gearIndex or 0
    if powertrain.getDevice("gearbox") and powertrain.getDevice("gearbox").type == "manualGearbox" then
      if index ~= (lastGearIndex or 0) then
        gearChangeTimer = 0.0001
        lastGearIndex = index
      end
      if gearChangeTimer ~= 0 then
        gearChangeTimer = gearChangeTimer + dt
        if gearChangeTimer > 0.45 then
          moduleData.gearIndex = index
          gearChangeTimer = 0
        end
      end
    else
      moduleData.gearIndex = index
    end]]
    moduleData.gearIndex = (electrics.values.gearIndex ~= 0 and electrics.values.gearIndex) or (electrics.values.clutch < 0.6 and electrics.values.gearIndex) or moduleData.gearIndex
  end
end

local function setupGaugeData(properties)
  updateFuelConsumption = properties.fuelConsumption or false
  updateFuelDisplay = properties.fuelDisplay or false
  updatePowerCalculation = properties.currentPower or false
  updateRemainingRange = properties.remainingRange or false
  timeSinceRespawn = properties.timeSinceRespawn or false
  gearIndexNoNeutral = properties.gearIndexNoNeutral or false
  if updateRemainingRange then
    updateFuelConsumption = true --we need this if we want the range
  end
  engines = powertrain.getDevicesByType("combustionEngine")
  for _, v in pairs(engines) do
    for _, j in pairs(v.registeredEnergyStorages) do
      table.insert(fuelTanks, j)
    end
  end
end

local function reset()
  avgPowerSmoother:reset()
  currentPowerSmoother:reset()
  currentTorqueSmoother:reset()
  avgConsumptionSmoother:set(0)
  fuelDisplaySmoother:reset()
  fuelSmoother:reset()
  remainingRangeSmoother:reset()
  avgConsumptionPer100km = nil
end

local function init(jbeamData)
end

M.init = init
M.reset = reset
M.updateGFX = updateGFX

M.setupGaugeData = setupGaugeData
M.updateGaugeData = updateGaugeData

return M
