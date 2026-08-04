-- written by DaddelZeit
-- DO NOT USE WITHOUT PERMISSION

local M = {}

M.type = "auxiliary"
M.messages = {
  engine_overheat = {
    issued = false,
    type = "warning"
  },
  engine_broken = {
    issued = false,
    type = "warning"
  },
  turn_on_engine = {
    issued = false,
    type = "warning"
  },
  aeb_activate = {
    issued = false,
    type = "warning"
  },
  brake_overheat = {
    issued = false,
    type = "warning"
  },
  handbrake = {
    issued = false,
    type = "warning"
  },
  low_fuel = {
    issued = false,
    type = "warning"
  },
  no_fuel = {
    issued = false,
    type = "warning"
  },
  crawl_mode = {
    issued = false,
    type = "warning"
  },
  latch_car_boot = {
    issued = false,
    type = "latch"
  },
  latch_car_bonnet = {
    issued = false,
    type = "latch"
  },
  latch_car_left = {
    issued = false,
    type = "latch"
  },
  latch_car_right = {
    issued = false,
    type = "latch"
  }
}

local gaugeHTMLTexture
local timer = 0
local currentWarning = nil
local activeLatchBoxes = {}
local latchBoxesChanged = false
local drivemodeController
local lastDrivemode = ""

local soundURL
local soundActive = false
local soundVolume = 1
local volumeMultiplier = 1
local isInside = false

local driverNodeCid = 0
local camPos
local combinedPos
local function isCamInside()
  camPos = obj:getCameraPosition()
  isInside = combinedPos and (camPos:distance(combinedPos) <= 0.6) or false
  combinedPos = obj:getPosition() + obj:getNodePosition(driverNodeCid)
end

local function updateData(path)
end

local function updateGaugeData(moduleData, dt)
  isCamInside()

  M.messages["aeb_activate"].issued = electrics.values.aebActive == 1
  M.messages["engine_overheat"].issued = electrics.values.watertemp > 125
  M.messages["brake_overheat"].issued = electrics.values.highBraketemp == 1
  M.messages["engine_broken"].issued = electrics.values.checkengineBetter == 1
  M.messages["turn_on_engine"].issued = electrics.values.ignitionLevel < 2
  M.messages["handbrake"].issued = (electrics.values.wheelspeed > 0.15 or electrics.values.throttle > 0.05) and electrics.values.parkingbrake ~= 0

  M.messages["no_fuel"].issued = electrics.values.fuel < 0.005
  if electrics.values.fuel < 0.1 and not M.messages["low_fuel"].issuedThisDrive then
    M.messages["low_fuel"].issuedThisDrive = true
    M.messages["low_fuel"].issued = true
  elseif electrics.values.fuel >= 0.1 then
    M.messages["low_fuel"].issuedThisDrive = false
  else
    M.messages["low_fuel"].issued = false
  end

  if not drivemodeController then
    drivemodeController = controller.getController("driveModes")
  end

  if drivemodeController and electrics.values.ignitionLevel == 2 and currentWarning ~= "turn_on_engine" then
    local drivemode = drivemodeController.getCurrentDriveModeKey()
    M.messages["crawl_mode"].issued = drivemode == "crawl" and lastDrivemode ~= drivemode
    lastDrivemode = drivemode
  end

  M.messages["latch_car_right"].issued = electrics.values.doorRCoupler_notAttached == 1
  M.messages["latch_car_left"].issued = electrics.values.doorLCoupler_notAttached == 1
  M.messages["latch_car_bonnet"].issued = electrics.values.hoodLatchCoupler_notAttached == 1
  M.messages["latch_car_boot"].issued = electrics.values.bootCoupler_notAttached == 1

  if currentWarning then
    timer = timer + dt

    if timer > 4 and not M.messages[currentWarning].issued then
      gaugeHTMLTexture:streamJS("toggleMessageWindow", "toggleMessageWindow", {currentWarning, 0})
      currentWarning = nil
      timer = 0
    end
    return
  end

  local activeLatchBoxesAmount = #activeLatchBoxes
  activeLatchBoxes = {}
  for k,v in pairs(M.messages) do
    if v.issued == true and not currentWarning then
      if v.type == "warning" then
        gaugeHTMLTexture:streamJS("toggleMessageWindow", "toggleMessageWindow", {k, 1})
        currentWarning = k

        if isInside and soundActive and soundURL then
          obj:playSFXOnce("ccfGaugeMessageWindow", driverNodeCid, soundVolume, 1)
        end
      elseif v.type == "latch" then
        table.insert(activeLatchBoxes, k)
      end
    end
  end
  latchBoxesChanged = activeLatchBoxesAmount ~= #activeLatchBoxes
  if not latchBoxesChanged then return end
  gaugeHTMLTexture:streamJS("setActiveLatchBoxes", "setActiveLatchBoxes", activeLatchBoxes)
end

local function setupGaugeData(properties, htmlTexture)
  gaugeHTMLTexture = htmlTexture
end

local function reset()
  local tempTable = {}
  for k,v in pairs(shallowcopy(M.messages)) do
    if v.type == "warning" then
      table.insert(tempTable, k)
    end
  end
  gaugeHTMLTexture:streamJS("hideAllMessageWindows", "hideAllMessageWindows", tempTable)
end

local function init(jbeamData)
  driverNodeCid = beamstate.nodeNameMap["driver"]

  soundURL = jbeamData.soundEvent
  volumeMultiplier = jbeamData.soundVolume or 1
end

local function setSoundVolume(volume)
  soundVolume = volume*volumeMultiplier
end

local function setSoundActive(bool)
  soundActive = bool
end

local function initSounds()
  if soundURL then
    obj:createSFXSource(soundURL, "Audio2D", "ccfGaugeMessageWindow", -1)
  end
end

M.setSoundActive = setSoundActive
M.setSoundVolume = setSoundVolume
M.init = init
M.reset = reset
M.initSounds = initSounds

M.updateData = updateData
M.updateGaugeData = updateGaugeData
M.setupGaugeData = setupGaugeData

return M
