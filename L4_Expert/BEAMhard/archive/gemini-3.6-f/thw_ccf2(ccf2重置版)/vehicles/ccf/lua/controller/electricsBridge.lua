-- written by DaddelZeit
-- DO NOT USE WITHOUT PERMISSION

local M = {}

local evalCache = {}
local checkList = {}

local function setEval(key, val)
    if evalCache[key] ~= val then
        electrics.values[key] = val and 1 or 0
        evalCache[key] = val
    end
end

local function updateGFX()
    for k,v in pairs(checkList) do
        local INPUT = type(v[2]) == "function" and v[2]() or v[2]

        if type(INPUT) == "number" or type(INPUT) == "string" or type(INPUT) == "boolean" or type(INPUT) == "table" then
            setEval(v[1], v[3](INPUT))
        end
    end
end

local function processEntry(t,entryNum)
    -- convert into local OR func
    if type(t[2]) == "string" then
        local f, err
        if t[4] then
            f, err = load("return function() return "..t[2].." end ")
        else
            f, err = load("return "..t[2])
        end

        if not f then
            log("E", "processEntry", "Entry number "..entryNum.." has an invalid function at [2]")
        else
            t[2] = f()
        end
    end

    -- convert into func
    if type(t[3]) == "string" then
        local f, err = load("return function(INPUT) if INPUT then return "..t[3].." end end", entryNum)
        if not f then
            log("E", "electricsBridge.processEntry", "Entry number "..entryNum.." has an invalid compare function at [3]")
        else
            t[3] = f()
        end
    end
end

local function init(jbeamData)
    checkList = jbeamData.checkList or checkList

    for k,v in ipairs(checkList) do
        processEntry(v,k)
    end
end

M.init = init
M.updateGFX = updateGFX

return M