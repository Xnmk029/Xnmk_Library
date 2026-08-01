-- This Source Code Form is subject to the terms of the bCDDL, v. 1.1.
-- If a copy of the bCDDL was not distributed with this
-- file, You can obtain one at http://beamng.com/bCDDL-1.1.txt

local M = {}

local roofIsOpen = false
local roofIsClosed = true
local roofIsOpening = false
local roofIsClosing = false
local message1 = "Please open the roof first."
local message2 = "Please unlatch the roof first."
local message3 = "The roof is broken."
local roofOpenTime = 0.5
local timer = 0
local relevantNodes = {"p4", "stf1", "stf2", "stfc"}
local roofBroken = false

local function updateGFX(dt)
	if timer >= roofOpenTime then
	  timer = 0
	  if roofIsOpening then
		roofIsOpening = false
		roofIsOpen = true
		controller.getControllerSafe('roofClose').toggleGroup()
	  elseif roofIsClosing then
		roofIsClosing = false
		roofIsClosed = true
		controller.getControllerSafe('roofOpen').toggleGroup()
	  end
	  return
	end

	if roofIsOpening or roofIsClosing then timer = timer + dt return end

	if electrics.values.roofOpen == 1 then
	  if roofBroken then
		guihooks.message(message3, 5, "roofCouplerHack")
		electrics.values.roofOpen = 0
		return
	  end
	  if roofIsOpen then
		guihooks.message(message2, 5, "roofCouplerHack")
	  else
		controller.getControllerSafe('roofOpen').toggleGroup()
		roofIsClosed = false
		roofIsOpening = true
	end
	  electrics.values.roofOpen = 0
	end

	if electrics.values.roofClose == 1 then
	  if roofBroken then
		guihooks.message(message3, 5, "roofCouplerHack")
		electrics.values.roofClose = 0
		return
	  end
	  if roofIsClosed then
		guihooks.message(message1, 5, "roofCouplerHack")
	  else
		controller.getControllerSafe('roofClose').toggleGroup()
		roofIsOpen = false
		roofIsClosing = true
	  end
	  electrics.values.roofClose = 0
	end
end

local function onCouplerDetached(nodeId, obj2id, obj2nodeId, breakForce)

  if breakForce > 0 then
	local node = v.data.nodes[nodeId].name
	for _, n in pairs(relevantNodes) do
	  if node == n then roofBroken = true return end
	end
    return
  end

end

local function onInit()
	if not electrics.values["isSimpleTrafficCar"] then

		electrics.values.roofOpen = 0
		electrics.values.roofClose = 0
		roofIsOpen = false
		roofIsClosed = true
		roofIsOpening = false
		roofIsClosing = false
		timer = 0
		roofBroken = false
	else
		M.updateGFX = nop;
		M.onReset = nop;
	end
end

-- public interface
M.updateGFX = updateGFX
M.onInit = onInit
M.onReset = onInit
M.onCouplerDetached = onCouplerDetached

return M