-- written by DaddelZeit
-- DO NOT USE WITHOUT PERMISSION

local M = {}

local smoother = newTemporalSmoothing(1)
local propsmootherin = newTemporalSmoothing(1)
local propsmootherout = newTemporalSmoothing(1)
local electricsFunc = "window"
local electricsFuncProp = "window"
local electricsStartVal = 0
local targetVal = 0
local direction = "down"
local valueOverwrite = nil

local function updateGFX(dt)
    electrics.values[electricsFunc] = smoother:get(targetVal, dt)
    if direction == "up" then
        electrics.values[electricsFuncProp] = propsmootherout:get(targetVal, dt)
    else
        electrics.values[electricsFuncProp] = propsmootherin:get(targetVal, dt)
    end
end

local function setValue(val)
    val = valueOverwrite or val

    direction = val < targetVal and "up" or "down"
    if direction == "up" then
        propsmootherout:set(electrics.values[electricsFuncProp])
    else
        propsmootherin:set(electrics.values[electricsFuncProp])
    end

    targetVal = val
end

local function toggleWindow()
    setValue(1-targetVal)
end

local function overwriteInput(overwrite, val)
    valueOverwrite = overwrite
    setValue(val or targetVal)
end

local function init(jbeamData)
    smoother = newTemporalSmoothing(jbeamData.smootherValue or 1)
    if jbeamData.propsmoother then
        if type(jbeamData.propsmoother) == "number" then
            propsmootherin = newTemporalSmoothing(jbeamData.propsmoother)
            propsmootherout = newTemporalSmoothing(jbeamData.propsmoother)
        else
            if jbeamData.propsmoother["in"] then
                propsmootherin = newTemporalSigmoidSmoothing(jbeamData.propsmoother["in"][1], jbeamData.propsmoother["in"][2], jbeamData.propsmoother["in"][3], jbeamData.propsmoother["in"][4])
                propsmootherout = newTemporalSigmoidSmoothing(jbeamData.propsmoother["out"][1], jbeamData.propsmoother["out"][2], jbeamData.propsmoother["out"][3], jbeamData.propsmoother["out"][4])
            else
                propsmootherin = newTemporalSigmoidSmoothing(jbeamData.propsmoother[1], jbeamData.propsmoother[2])
                propsmootherout = newTemporalSigmoidSmoothing(jbeamData.propsmoother[1], jbeamData.propsmoother[2])
            end
        end
    else
        propsmootherin = newTemporalSmoothing(jbeamData.smootherValue or 1)
        propsmootherout = newTemporalSmoothing(jbeamData.smootherValue or 1)
    end

    electricsStartVal = jbeamData.electricsStartVal or electricsStartVal
    electricsFunc = jbeamData.electricsFunc or electricsFunc
    electricsFuncProp = jbeamData.electricsFuncProp or jbeamData.electricsFunc or electricsFuncProp

    electrics.values[electricsFunc] = electricsStartVal
    electrics.values[electricsFuncProp] = electricsStartVal
end

local function reset()
    electrics.values[electricsFunc] = electricsStartVal
    electrics.values[electricsFuncProp] = electricsStartVal
    valueOverwrite = nil
    targetVal = 0
    smoother:set(0)
    propsmootherin:set(0)
    propsmootherout:set(0)
end

M.overwriteInput = overwriteInput
M.setValue = setValue
M.toggleWindow = toggleWindow
M.updateGFX = updateGFX
M.init = init
M.reset = reset

return M