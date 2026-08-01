-- This Source Code Form is subject to the terms of the bCDDL, v. 1.1.
-- If a copy of the bCDDL was not distributed with this
-- file, You can obtain one at http://BeamNG.com/bCDDL-1.1.txt

local M = {}
M.type = 'auxilliary'
M.relevantDevice = nil

local blinkTimerThreshold_1 = 1 * 0.6/12
local blinkTimerThreshold_2 = 2 * 0.6/12
local blinkTimerThreshold_3 = 3 * 0.6/12
local blinkTimerThreshold_4 = 4 * 0.6/12
local blinkTimerThreshold_5 = 5 * 0.6/12
local blinkTimerThreshold_6 = 6 * 0.6/12
local blinkTimerThreshold_7 = 7 * 0.6/12
local blinkTimerThreshold_8 = 8 * 0.6/12
local blinkTimerThreshold_9 = 9 * 0.6/12
local blinkTimerThreshold_10 = 10*0.6/12
local blinkTimerThreshold_11 = 11*0.6/12
local blinkTimerThreshold_12 = 12*0.6/12
local blinkTimerThreshold_13 = 16*0.6/12

local blinkTimer = 0
local blinkPulse_1 = 0
local blinkPulse_2 = 0
local blinkPulse_3 = 0
local blinkPulse_4 = 0
local blinkPulse_5 = 0
local blinkPulse_6 = 0
local blinkPulse_7 = 0
local blinkPulse_8 = 0
local blinkPulse_9 = 0
local blinkPulse_10 = 0
local blinkPulse_11 = 0
local blinkPulse_12 = 0

local function init()
	electrics.values.signal_L_1 = 0
	electrics.values.signal_L_2 = 0
	electrics.values.signal_L_3 = 0
	electrics.values.signal_L_4 = 0
	electrics.values.signal_L_5 = 0
	electrics.values.signal_L_6 = 0
	electrics.values.signal_L_7 = 0
	electrics.values.signal_L_8 = 0
	electrics.values.signal_L_9 = 0
	electrics.values.signal_L_10 = 0
	electrics.values.signal_L_11 = 0
	electrics.values.signal_L_12 = 0

	electrics.values.signal_R_1 = 0
	electrics.values.signal_R_2 = 0
	electrics.values.signal_R_3 = 0
	electrics.values.signal_R_4 = 0
	electrics.values.signal_R_5 = 0
	electrics.values.signal_R_6 = 0
	electrics.values.signal_R_7 = 0
	electrics.values.signal_R_8 = 0
	electrics.values.signal_R_9 = 0
	electrics.values.signal_R_10 = 0
	electrics.values.signal_R_11 = 0
	electrics.values.signal_R_12 = 0
end

local function generatePulse(dt)
	blinkTimer = blinkTimer + dt
	if blinkTimer > blinkTimerThreshold_1 then
	  	blinkPulse_1 = 1
	end
	if blinkTimer > blinkTimerThreshold_2 then
	  	blinkPulse_2 = 1
	end
	if blinkTimer > blinkTimerThreshold_3 then
	  	blinkPulse_3 = 1
	end
	if blinkTimer > blinkTimerThreshold_4 then
	  	blinkPulse_4 = 1
	end
	if blinkTimer > blinkTimerThreshold_5 then
	  	blinkPulse_5 = 1
	end
	if blinkTimer > blinkTimerThreshold_6 then
	  	blinkPulse_6 = 1
	end
	if blinkTimer > blinkTimerThreshold_7 then
	  	blinkPulse_7 = 1
	end
	if blinkTimer > blinkTimerThreshold_8 then
	  	blinkPulse_8 = 1
	end
	if blinkTimer > blinkTimerThreshold_9 then
	  	blinkPulse_9 = 1
	end
	if blinkTimer > blinkTimerThreshold_10 then
	  	blinkPulse_10 = 1
	end
	if blinkTimer > blinkTimerThreshold_11 then
	 	blinkPulse_11 = 1
	end
	if blinkTimer > blinkTimerThreshold_12 then
	  	blinkPulse_12 = 1
	end
	if blinkTimer > blinkTimerThreshold_13 then
		blinkTimer = 0
		blinkPulse_1 = 0
		blinkPulse_2 = 0
		blinkPulse_3 = 0
		blinkPulse_4 = 0
		blinkPulse_5 = 0
		blinkPulse_6 = 0
		blinkPulse_7 = 0
		blinkPulse_8 = 0
		blinkPulse_9 = 0
		blinkPulse_10 = 0
		blinkPulse_11 = 0
		blinkPulse_12 = 0
	end
end

local function updateGFX(dt)
    generatePulse(dt)

	electrics.values.signal_L_1 = (electrics.values.signal_left_input == 1 and blinkPulse_1)
	electrics.values.signal_L_2 = (electrics.values.signal_left_input == 1 and blinkPulse_2)
	electrics.values.signal_L_3 = (electrics.values.signal_left_input == 1 and blinkPulse_3)
	electrics.values.signal_L_4 = (electrics.values.signal_left_input == 1 and blinkPulse_4)
	electrics.values.signal_L_5 = (electrics.values.signal_left_input == 1 and blinkPulse_5)
	electrics.values.signal_L_6 = (electrics.values.signal_left_input == 1 and blinkPulse_6)
	electrics.values.signal_L_7 = (electrics.values.signal_left_input == 1 and blinkPulse_7)
	electrics.values.signal_L_8 = (electrics.values.signal_left_input == 1 and blinkPulse_8)
	electrics.values.signal_L_9 = (electrics.values.signal_left_input == 1 and blinkPulse_9)
	electrics.values.signal_L_10 = (electrics.values.signal_left_input == 1 and blinkPulse_10)
	electrics.values.signal_L_11 = (electrics.values.signal_left_input == 1 and blinkPulse_11)
	electrics.values.signal_L_12 = (electrics.values.signal_left_input == 1 and blinkPulse_12)

	electrics.values.signal_R_1 = (electrics.values.signal_right_input == 1 and blinkPulse_1)
	electrics.values.signal_R_2 = (electrics.values.signal_right_input == 1 and blinkPulse_2)
	electrics.values.signal_R_3 = (electrics.values.signal_right_input == 1 and blinkPulse_3)
	electrics.values.signal_R_4 = (electrics.values.signal_right_input == 1 and blinkPulse_4)
	electrics.values.signal_R_5 = (electrics.values.signal_right_input == 1 and blinkPulse_5)
	electrics.values.signal_R_6 = (electrics.values.signal_right_input == 1 and blinkPulse_6)
	electrics.values.signal_R_7 = (electrics.values.signal_right_input == 1 and blinkPulse_7)
	electrics.values.signal_R_8 = (electrics.values.signal_right_input == 1 and blinkPulse_8)
	electrics.values.signal_R_9 = (electrics.values.signal_right_input == 1 and blinkPulse_9)
	electrics.values.signal_R_10 = (electrics.values.signal_right_input == 1 and blinkPulse_10)
	electrics.values.signal_R_11 = (electrics.values.signal_right_input == 1 and blinkPulse_11)
	electrics.values.signal_R_12 = (electrics.values.signal_right_input == 1 and blinkPulse_12)

	if electrics.values.signal_right_input == 0 and electrics.values.signal_left_input == 0 then
		blinkTimer = 0
		blinkTimer = 0
		blinkPulse_1 = 0
		blinkPulse_2 = 0
		blinkPulse_3 = 0
		blinkPulse_4 = 0
		blinkPulse_5 = 0
		blinkPulse_6 = 0
		blinkPulse_7 = 0
		blinkPulse_8 = 0
		blinkPulse_9 = 0
		blinkPulse_10 = 0
		blinkPulse_11 = 0
		blinkPulse_12 = 0
	end
end

M.init = init
M.updateGFX = updateGFX

return M