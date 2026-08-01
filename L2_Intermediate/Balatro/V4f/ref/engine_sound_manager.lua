require "love.audio"
require "love.sound"
require "love.system"

if (love.system.getOS() == 'OS X' )and (jit.arch == 'arm64' or jit.arch == 'arm') then jit.off() end

--vars needed for sound manager thread
CHANNEL = love.thread.getChannel("sound_request")
LOAD_CHANNEL = love.thread.getChannel('load_channel')
LOAD_CHANNEL:push('audio thread start')
DISABLE_SFX = false

--create all sounds from resources and play one each to load into mem
SOURCES = {}
local sound_files = love.filesystem.getDirectoryItems("resources/sounds")

for _, filename in ipairs(sound_files) do
    local extension = string.sub(filename, -4)
    for i = 1, 1 do
        if extension == '.ogg' then
            LOAD_CHANNEL:push('audio file - '..filename)
            local sound_code = string.sub(filename, 1, -5)
            local s = {
                sound = love.audio.newSource("resources/sounds/"..filename,string.find(sound_code,'music') and "stream" or 'static'),
                filepath = "resources/sounds/"..filename
            }
            SOURCES[sound_code] = {}
            table.insert(SOURCES[sound_code], s)
            s.sound_code = sound_code
            s.sound:setVolume(0)
            love.audio.play(s.sound)
            s.sound:stop()
        end
    end
end

function PLAY_SOUND(args)
    args.per = args.per or 1
    args.vol = args.vol or 1
    SOURCES[args.sound_code] = SOURCES[args.sound_code] or {}

    for _, s in ipairs(SOURCES[args.sound_code]) do
        if s.sound and not s.sound:isPlaying() then
            s.original_pitch = args.per
            s.original_volume = args.vol
            s.created_on_pause = args.overlay_menu
            s.created_on_state = args.state
            s.sfx_handled = 0
            s.transition_timer = 0
            SET_SFX(s, args)
            love.audio.play(s.sound)
            return s
        end
    end

    local should_stream = (string.find(args.sound_code,'music') or string.find(args.sound_code,'ambient'))
    local s = {sound = love.audio.newSource("resources/sounds/"..args.sound_code..'.ogg', should_stream and "stream" or 'static')}
    table.insert(SOURCES[args.sound_code], s)
    s.sound_code = args.sound_code
    s.original_pitch = args.per or 1
    s.original_volume = args.vol or 1
    s.created_on_pause = (args.overlay_menu and true or false)
    s.created_on_state = args.state
    s.sfx_handled = 0
    s.transition_timer = 0
    SET_SFX(s, args)
    love.audio.play(s.sound)
    return s
end

function STOP_AUDIO()
    for _, source in pairs(SOURCES) do
        for _, s in pairs(source) do
            if s.sound:isPlaying() then
                s.sound:stop()
            end
        end
    end
end
  
function SET_SFX(s, args)
    if string.find(s.sound_code,'music') then 
        if s.sound_code == args.desired_track then
            s.current_volume = s.current_volume or 1
            s.current_volume = 1*(args.dt*3) + (1-(args.dt*3))*s.current_volume
        else
            s.current_volume = s.current_volume or 0
            s.current_volume = 0*(args.dt*3) + (1-(args.dt*3))*s.current_volume
        end
        s.sound:setVolume(s.current_volume*s.original_volume*(args.sound_settings.volume/100.0)*(args.sound_settings.music_volume/100.0))
        s.sound:setPitch(s.original_pitch*args.pitch_mod)
    else
        if s.temp_pitch ~= s.original_pitch then 
            s.sound:setPitch(s.original_pitch)
            s.temp_pitch = s.original_pitch
        end
      local sound_vol = s.original_volume*(args.sound_settings.volume/100.0)*(args.sound_settings.game_sounds_volume/100.0)
      if s.created_on_state == 13 then sound_vol = sound_vol*args.splash_vol end
      if sound_vol <= 0 then
        s.sound:stop()
      else
        s.sound:setVolume(sound_vol)
      end
    end
  end
  
  function MODULATE(args)
    for k, v in pairs(SOURCES) do
        if (string.find(k,'music') and (args.desired_track ~= '')) then
            if v[1] and v[1].sound and v[1].sound:isPlaying() then
            else
                RESTART_MUSIC(args)
                break;
            end
        end
    end
    for k, v in pairs(SOURCES) do
      local i=1
      while i <= #v do
          if not v[i].sound:isPlaying() then
            v[i].sound:release()
            table.remove(v, i)
          else
            i = i + 1
          end
      end

      for _, s in pairs(v) do
        if s.sound and s.sound:isPlaying() and s.original_volume then
            SET_SFX(s, args)
        end
      end
    end
  end

  function RESTART_MUSIC(args)
    for k, v in pairs(SOURCES) do
        if string.find(k,'music') then 
            for i, s in ipairs(v) do
                s.sound:stop()
            end
            SOURCES[k] = {}
            args.per = 0.7
            args.vol = 0.6
            args.sound_code = k
            local s = PLAY_SOUND(args)
            s.initialized = true
        end
    end
  end

  function AMBIENT(args)
    for k, v in pairs(SOURCES) do
        if args.ambient_control[k] then 
            local start_ambient = args.ambient_control[k].vol*(args.sound_settings.volume/100.0)*(args.sound_settings.game_sounds_volume/100.0) > 0
        
            for i, s in ipairs(v) do
                if s.sound and s.sound:isPlaying() and s.original_volume then
                    s.original_volume = args.ambient_control[k].vol
                    SET_SFX(s, args)
                    start_ambient = false
                end
            end
            
            if start_ambient then
                args.sound_code = k
                args.vol = args.ambient_control[k].vol
                args.per = args.ambient_control[k].per
                PLAY_SOUND(args)
            end
         end
      end
  end

  function RESET_STATES(state)
    for k, v in pairs(SOURCES) do
        for i, s in ipairs(v) do
            s.created_on_state = state
        end
    end
  end

  LOAD_CHANNEL:push('finished')

  while true do
    --Monitor the channel for any new requests
    local request = CHANNEL:demand() -- Value from channel
    if request then
        --If the request is for an update to the music track, handle it here
        if false then elseif request.type == 'sound' then 
            PLAY_SOUND(request)
        elseif request.type == 'stop' then
            STOP_AUDIO()
        elseif request.type == 'modulate' then 
            MODULATE(request)
            if request.ambient_control then AMBIENT(request) end
        elseif request.type == 'restart_music' then
            RESTART_MUSIC()
        elseif request.type == 'reset_states' then
            for k, v in pairs(SOURCES) do
                for i, s in ipairs(v) do
                    s.created_on_state = request.state
                end
            end
        end
    end
end
