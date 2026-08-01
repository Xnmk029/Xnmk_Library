--Class
Game = Object:extend()

--Class Methods
function Game:init()
    G = self

    self:set_globals()
end

function Game:start_up()
    --Load the settings file
    local settings = get_compressed('settings.jkr')
    local settings_ver = nil
    if settings then 
        local settings_file = STR_UNPACK(settings)
        if G.VERSION >= '1.0.0' and (love.system.getOS() == 'NOPE') and ((not settings_file.version) or (settings_file.version < '1.0.0')) then 
            for i = 1, 3 do
                love.filesystem.remove(i..'/'..'profile.jkr')
                love.filesystem.remove(i..'/'..'save.jkr')
                love.filesystem.remove(i..'/'..'meta.jkr')
                love.filesystem.remove(i..'/'..'unlock_notify.jkr')
                love.filesystem.remove(i..'')
            end
            for k, v in pairs(settings_file) do
                self.SETTINGS[k] = v
            end
            self.SETTINGS.profile = 1
            self.SETTINGS.tutorial_progress = nil
        else 
            if G.VERSION < '1.0.0' then 
                settings_ver = settings_file.version
            end
            for k, v in pairs(settings_file) do
                self.SETTINGS[k] = v
            end
        end
    end
    self.SETTINGS.version = settings_ver or G.VERSION
    self.SETTINGS.paused = nil

    local new_colour_proto = self.C["SO_"..(self.SETTINGS.colourblind_option and 2 or 1)]
    self.C.SUITS.Hearts = new_colour_proto.Hearts
    self.C.SUITS.Diamonds = new_colour_proto.Diamonds
    self.C.SUITS.Spades = new_colour_proto.Spades
    self.C.SUITS.Clubs = new_colour_proto.Clubs

    boot_timer('start', 'settings', 0.1)

    if self.SETTINGS.GRAPHICS.texture_scaling then
        self.SETTINGS.GRAPHICS.texture_scaling = self.SETTINGS.GRAPHICS.texture_scaling > 1 and 2 or 1
    end

    if self.SETTINGS.DEMO and not self.F_CTA then
        self.SETTINGS.DEMO = {
            total_uptime = 0,
            timed_CTA_shown = true,
            win_CTA_shown = true,
            quit_CTA_shown = true
        }
    end

    --create all sounds from resources and play one each to load into mem
    SOURCES = {}
    local sound_files = love.filesystem.getDirectoryItems("resources/sounds")

    for _, filename in ipairs(sound_files) do
        local extension = string.sub(filename, -4)
        if extension == '.ogg' then
            local sound_code = string.sub(filename, 1, -5)
            SOURCES[sound_code] = {}
        end
    end

    self.SETTINGS.language = self.SETTINGS.language or 'en-us'
    boot_timer('settings', 'window init', 0.2)
    self:init_window()

    if G.F_SOUND_THREAD then
        boot_timer('window init', 'soundmanager2')
        --call the sound manager to prepare the thread to play sounds
        self.SOUND_MANAGER = {
            thread = love.thread.newThread('engine/sound_manager.lua'),
            channel = love.thread.getChannel('sound_request'),
            load_channel = love.thread.getChannel('load_channel')
        }
        self.SOUND_MANAGER.thread:start(1)

        local sound_loaded, prev_file = false, 'none'
        while not sound_loaded and false do
            --Monitor the channel for any new requests
            local request = self.SOUND_MANAGER.load_channel:pop() -- Value from channel
            if request then
                --If the request is for an update to the music track, handle it here
                if request == 'finished' then sound_loaded = true
                else
                    boot_timer(request, prev_file)
                    prev_file = request
                end
            end
            love.timer.sleep(0.001)
        end
    
        boot_timer('soundmanager2', 'savemanager',0.22)
    end

    boot_timer('window init', 'savemanager')
    --call the save manager to wait for any save requests
    G.SAVE_MANAGER = {
        thread = love.thread.newThread('engine/save_manager.lua'),
        channel = love.thread.getChannel('save_request')
    }
    G.SAVE_MANAGER.thread:start(2)
    boot_timer('savemanager', 'shaders',0.4)

    --call the http manager
    G.HTTP_MANAGER = {
        thread = love.thread.newThread('engine/http_manager.lua'),
        out_channel = love.thread.getChannel('http_request'),
        in_channel = love.thread.getChannel('http_response')
    }
    if G.F_HTTP_SCORES then
        G.HTTP_MANAGER.thread:start()
    end

    --Load all shaders from resources
    self.SHADERS = {}
    local shader_files = love.filesystem.getDirectoryItems("resources/shaders")
    for k, filename in ipairs(shader_files) do
        local extension = string.sub(filename, -3)
        if extension == '.fs' then
            local shader_name = string.sub(filename, 1, -4)
            self.SHADERS[shader_name] = love.graphics.newShader("resources/shaders/"..filename)
        end
    end

    boot_timer('shaders', 'controllers',0.7)

    --Input handler/controller for game objects
    self.CONTROLLER = Controller()
    love.joystick.loadGamepadMappings("resources/gamecontrollerdb.txt")
    if self.F_RUMBLE then 
        local joysticks = love.joystick.getJoysticks()
        if joysticks then 
            if joysticks[1] then 
                self.CONTROLLER:set_gamepad(joysticks[2] or joysticks[1])
            end
        end
    end
    boot_timer('controllers', 'localization',0.8)

    if self.SETTINGS.GRAPHICS.texture_scaling then
        self.SETTINGS.GRAPHICS.texture_scaling = self.SETTINGS.GRAPHICS.texture_scaling > 1 and 2 or 1
    end

    self:load_profile(G.SETTINGS.profile or 1)

    self.SETTINGS.QUEUED_CHANGE = {}
    self.SETTINGS.music_control = {desired_track = '', current_track = '', lerp = 1} 

    self:set_render_settings()

    self:set_language()

    self:init_item_prototypes()
    boot_timer('protos', 'shared sprites',0.9)

    --For globally shared sprites
    self.shared_debuff = Sprite(0, 0, self.CARD_W, self.CARD_H, self.ASSET_ATLAS["centers"], {x=4, y = 0})

    self.shared_soul = Sprite(0, 0, self.CARD_W, self.CARD_H, self.ASSET_ATLAS["centers"], self.P_CENTERS.soul.pos)
    self.shared_undiscovered_joker = Sprite(0, 0, self.CARD_W, self.CARD_H, self.ASSET_ATLAS["centers"], self.P_CENTERS.undiscovered_joker.pos)
    self.shared_undiscovered_tarot = Sprite(0, 0, self.CARD_W, self.CARD_H, self.ASSET_ATLAS["centers"], self.P_CENTERS.undiscovered_tarot.pos)

    self.shared_sticker_eternal = Sprite(0, 0, self.CARD_W, self.CARD_H, self.ASSET_ATLAS["stickers"], {x = 0,y = 0})
    self.shared_sticker_perishable = Sprite(0, 0, self.CARD_W, self.CARD_H, self.ASSET_ATLAS["stickers"], {x = 0,y = 2})
    self.shared_sticker_rental = Sprite(0, 0, self.CARD_W, self.CARD_H, self.ASSET_ATLAS["stickers"], {x = 1,y = 2})
    
    self.shared_stickers = {
        White = Sprite(0, 0, self.CARD_W, self.CARD_H, self.ASSET_ATLAS["stickers"], {x = 1,y = 0}),
        Red = Sprite(0, 0, self.CARD_W, self.CARD_H, self.ASSET_ATLAS["stickers"], {x = 2,y = 0}),
        Green = Sprite(0, 0, self.CARD_W, self.CARD_H, self.ASSET_ATLAS["stickers"], {x = 3,y = 0}),
        Black = Sprite(0, 0, self.CARD_W, self.CARD_H, self.ASSET_ATLAS["stickers"], {x = 0,y = 1}),
        Blue = Sprite(0, 0, self.CARD_W, self.CARD_H, self.ASSET_ATLAS["stickers"], {x = 4,y = 0}),
        Purple = Sprite(0, 0, self.CARD_W, self.CARD_H, self.ASSET_ATLAS["stickers"], {x = 1,y = 1}),
        Orange = Sprite(0, 0, self.CARD_W, self.CARD_H, self.ASSET_ATLAS["stickers"], {x = 2,y = 1}),
        Gold = Sprite(0, 0, self.CARD_W, self.CARD_H, self.ASSET_ATLAS["stickers"], {x = 3,y = 1})
    }
    self.shared_seals = {
        Gold = Sprite(0, 0, self.CARD_W, self.CARD_H, self.ASSET_ATLAS["centers"], {x = 2,y = 0}),
        Purple = Sprite(0, 0, self.CARD_W, self.CARD_H, self.ASSET_ATLAS["centers"], {x = 4,y = 4}),
        Red = Sprite(0, 0, self.CARD_W, self.CARD_H, self.ASSET_ATLAS["centers"], {x = 5,y = 4}),
        Blue = Sprite(0, 0, self.CARD_W, self.CARD_H, self.ASSET_ATLAS["centers"], {x = 6,y = 4}),
    }
    self.sticker_map = {
        'White','Red','Green','Black','Blue','Purple','Orange','Gold'
    }
    boot_timer('shared sprites', 'prep stage',0.95)

    --For the visible cursor
    G.STAGE_OBJECT_INTERRUPT =true
    self.CURSOR = Sprite(0,0,0.3, 0.3, self.ASSET_ATLAS['gamepad_ui'], {x = 18, y = 0})
    self.CURSOR.states.collide.can = false
    G.STAGE_OBJECT_INTERRUPT = false

    --Create the event manager for the game
    self.E_MANAGER = EventManager()
    self.SPEEDFACTOR = 1

    set_profile_progress()
    boot_timer('prep stage', 'splash prep',1)
    self:splash_screen()
    boot_timer('splash prep', 'end',1)
end

function Game:init_item_prototypes()
    --Initialize all prototypes for units/items
    self.P_SEALS = {
        Gold =      {order = 1,  discovered = false, set = "Seal"},
        Red =       {order = 2,  discovered = false, set = "Seal"},
        Blue =      {order = 3,  discovered = false, set = "Seal"},
        Purple =    {order = 4,  discovered = false, set = "Seal"},
    }
    self.P_TAGS = {
        tag_uncommon =      {name = 'Uncommon Tag',     set = 'Tag', discovered = false, min_ante = nil, order = 1, config = {type = 'store_joker_create'}, pos = {x = 0,y = 0}},
        tag_rare =          {name = 'Rare Tag',         set = 'Tag', discovered = false, min_ante = nil, order = 2, config = {type = 'store_joker_create', odds = 3}, requires = 'j_blueprint', pos = {x = 1,y = 0}},
        tag_negative =      {name = 'Negative Tag',     set = 'Tag', discovered = false, min_ante = 2,   order = 3, config = {type = 'store_joker_modify', edition = 'negative', odds = 5}, requires = 'e_negative', pos = {x = 2, y = 0}},
        tag_foil =          {name = 'Foil Tag',         set = 'Tag', discovered = false, min_ante = nil, order = 4, config = {type = 'store_joker_modify', edition = 'foil', odds = 2}, requires = 'e_foil', pos = {x = 3,y = 0}},
        tag_holo =          {name = 'Holographic Tag',  set = 'Tag', discovered = false, min_ante = nil, order = 5, config = {type = 'store_joker_modify', edition = 'holo', odds = 3}, requires = 'e_holo', pos = {x = 0,y = 1}},
        tag_polychrome =    {name = 'Polychrome Tag',   set = 'Tag', discovered = false, min_ante = nil, order = 6, config = {type = 'store_joker_modify', edition = 'polychrome', odds = 4}, requires = 'e_polychrome', pos = {x = 1,y = 1}},
        tag_investment =    {name = 'Investment Tag',   set = 'Tag', discovered = false, min_ante = nil, order = 7, config = {type = 'eval', dollars = 25}, pos = {x = 2,y = 1}},
        tag_voucher =       {name = 'Voucher Tag',      set = 'Tag', discovered = false, min_ante = nil, order = 8, config = {type = 'voucher_add'}, pos = {x = 3,y = 1}},
        tag_boss =          {name = 'Boss Tag',         set = 'Tag', discovered = false, min_ante = nil, order = 9, config = {type = 'new_blind_choice', }, pos = {x = 0,y = 2}},
        tag_standard =      {name = 'Standard Tag',     set = 'Tag', discovered = false, min_ante = 2,   order = 10, config = {type = 'new_blind_choice', }, pos = {x = 1,y = 2}},
        tag_charm =         {name = 'Charm Tag',        set = 'Tag', discovered = false, min_ante = nil, order = 11, config = {type = 'new_blind_choice', }, pos = {x = 2,y = 2}},
        tag_meteor =        {name = 'Meteor Tag',       set = 'Tag', discovered = false, min_ante = 2,   order = 12, config = {type = 'new_blind_choice', }, pos = {x = 3,y = 2}},
        tag_buffoon =       {name = 'Buffoon Tag',      set = 'Tag', discovered = false, min_ante = 2,   order = 13, config = {type = 'new_blind_choice', }, pos = {x = 4,y = 2}},
        tag_handy =         {name = 'Handy Tag',        set = 'Tag', discovered = false, min_ante = 2,   order = 14, config = {type = 'immediate', dollars_per_hand = 1}, pos = {x = 1,y = 3}},
        tag_garbage =       {name = 'Garbage Tag',      set = 'Tag', discovered = false, min_ante = 2,   order = 15, config = {type = 'immediate', dollars_per_discard = 1}, pos = {x = 2,y = 3}},
        tag_ethereal =      {name = 'Ethereal Tag',     set = 'Tag', discovered = false, min_ante = 2,   order = 16, config = {type = 'new_blind_choice'}, pos = {x = 3,y = 3}},
        tag_coupon =        {name = 'Coupon Tag',       set = 'Tag', discovered = false, min_ante = nil, order = 17, config = {type = 'shop_final_pass', }, pos = {x = 4,y = 0}},
        tag_double =        {name = 'Double Tag',       set = 'Tag', discovered = false, min_ante = nil, order = 18, config = {type = 'tag_add', }, pos = {x = 5,y = 0}},
        tag_juggle =        {name = 'Juggle Tag',       set = 'Tag', discovered = false, min_ante = nil, order = 19, config = {type = 'round_start_bonus', h_size = 3}, pos = {x = 5,y = 1}},
        tag_d_six =         {name = 'D6 Tag',           set = 'Tag', discovered = false, min_ante = nil, order = 20, config = {type = 'shop_start', }, pos = {x = 5,y = 3}},
        tag_top_up =        {name = 'Top-up Tag',       set = 'Tag', discovered = false, min_ante = 2,   order = 21, config = {type = 'immediate', spawn_jokers = 2}, pos = {x = 4,y = 1}},
        tag_skip =          {name = 'Skip Tag',         set = 'Tag', discovered = false, min_ante = nil, order = 22, config = {type = 'immediate', skip_bonus = 5}, pos = {x = 0,y = 3}},
        tag_orbital =       {name = 'Orbital Tag',      set = 'Tag', discovered = false, min_ante = 2,   order = 23, config = {type = 'immediate', levels = 3}, pos = {x = 5,y = 2}},
        tag_economy =       {name = 'Economy Tag',      set = 'Tag', discovered = false, min_ante = nil, order = 24, config = {type = 'immediate', max = 40}, pos = {x = 4,y = 3}},
    }
    self.tag_undiscovered = {name = 'Not Discovered', order = 1, config = {type = ''}, pos = {x=3,y=4}}

    self.P_STAKES = {
        stake_white =   {name = 'White Chip',   unlocked = true,  order = 1, pos = {x = 0,y = 0}, stake_level = 1, set = 'Stake'},
        stake_red =     {name = 'Red Chip',     unlocked = false, order = 2, pos = {x = 1,y = 0}, stake_level = 2, set = 'Stake'},
        stake_green =   {name = 'Green Chip',   unlocked = false, order = 3, pos = {x = 2,y = 0}, stake_level = 3, set = 'Stake'},  
        stake_black =   {name = 'Black Chip',   unlocked = false, order = 4, pos = {x = 4,y = 0}, stake_level = 4, set = 'Stake'},
        stake_blue =    {name = 'Blue Chip',    unlocked = false, order = 5, pos = {x = 3,y = 0}, stake_level = 5, set = 'Stake'},
        stake_purple =  {name = 'Purple Chip',  unlocked = false, order = 6, pos = {x = 0,y = 1}, stake_level = 6, set = 'Stake'},
        stake_orange =  {name = 'Orange Chip',  unlocked = false, order = 7, pos = {x = 1,y = 1}, stake_level = 7, set = 'Stake'},
        stake_gold =    {name = 'Gold Chip',    unlocked = false, order = 8, pos = {x = 2,y = 1}, stake_level = 8, set = 'Stake'},
    }

    self.P_BLINDS = {
        bl_small =           {name = 'Small Blind',  defeated = false, order = 1, dollars = 3, mult = 1,  vars = {}, debuff_text = '', debuff = {}, pos = {x=0, y=0}},
        bl_big =             {name = 'Big Blind',    defeated = false, order = 2, dollars = 4, mult = 1.5,vars = {}, debuff_text = '', debuff = {}, pos = {x=0, y=1}},
        bl_ox =              {name = 'The Ox',       defeated = false, order = 4, dollars = 5, mult = 2,  vars = {localize('ph_most_played')}, debuff = {}, pos = {x=0, y=2}, boss = {min = 6, max = 10}, boss_colour = HEX('b95b08')},
        bl_hook =            {name = 'The Hook',     defeated = false, order = 3, dollars = 5, mult = 2,  vars = {}, debuff = {}, pos = {x=0, y=7}, boss = {min = 1, max = 10}, boss_colour = HEX('a84024')},
        bl_mouth =           {name = 'The Mouth',    defeated = false, order = 17, dollars = 5, mult = 2, vars = {}, debuff = {}, pos = {x=0, y=18}, boss = {min = 2, max = 10}, boss_colour = HEX('ae718e')},
        bl_fish =            {name = 'The Fish',     defeated = false, order = 10, dollars = 5, mult = 2, vars = {}, debuff = {}, pos = {x=0, y=5}, boss = {min = 2, max = 10}, boss_colour = HEX('3e85bd')},
        bl_club =            {name = 'The Club',     defeated = false, order = 9, dollars = 5, mult = 2,  vars = {}, debuff = {suit = 'Clubs'}, pos = {x=0, y=4}, boss = {min = 1, max = 10}, boss_colour = HEX('b9cb92')},
        bl_manacle =         {name = 'The Manacle',  defeated = false, order = 15, dollars = 5, mult = 2, vars = {}, debuff = {}, pos = {x=0, y=8}, boss = {min = 1, max = 10}, boss_colour = HEX('575757')},
        bl_tooth =           {name = 'The Tooth',    defeated = false, order = 23, dollars = 5, mult = 2, vars = {}, debuff = {}, pos = {x=0, y=22}, boss = {min = 3, max = 10}, boss_colour = HEX('b52d2d')},
        bl_wall =            {name = 'The Wall',     defeated = false, order = 6, dollars = 5, mult = 4,  vars = {}, debuff = {}, pos = {x=0, y=9}, boss = {min = 2, max = 10}, boss_colour = HEX('8a59a5')},
        bl_house =           {name = 'The House',    defeated = false, order = 5, dollars = 5, mult = 2,  vars = {}, debuff = {}, pos = {x=0, y=3}, boss ={min = 2, max = 10}, boss_colour = HEX('5186a8')},
        bl_mark =            {name = 'The Mark',     defeated = false, order = 25, dollars = 5, mult = 2, vars = {}, debuff = {}, pos = {x=0, y=23}, boss = {min = 2, max = 10}, boss_colour = HEX('6a3847')},

        bl_final_bell =      {name = 'Cerulean Bell',defeated = false, order = 30, dollars = 8, mult = 2, vars = {}, debuff = {}, pos = {x=0, y=26}, boss = {showdown = true, min = 10, max = 10}, boss_colour = HEX('009cfd')},
        bl_wheel =           {name = 'The Wheel',    defeated = false, order = 7, dollars = 5, mult = 2,  vars = {}, debuff = {}, pos = {x=0, y=10}, boss = {min = 2, max = 10}, boss_colour = HEX('50bf7c')},
        bl_arm =             {name = 'The Arm',      defeated = false, order = 8, dollars = 5, mult = 2,  vars = {}, debuff = {}, pos = {x=0, y=11}, boss = {min = 2, max = 10}, boss_colour = HEX('6865f3')},
        bl_psychic =         {name = 'The Psychic',  defeated = false, order = 11, dollars = 5, mult = 2, vars = {}, debuff = {h_size_ge = 5}, pos = {x=0, y=12}, boss = {min = 1, max = 10}, boss_colour = HEX('efc03c')},
        bl_goad =            {name = 'The Goad',     defeated = false, order = 12, dollars = 5, mult = 2, vars = {}, debuff = {suit = 'Spades'}, pos = {x=0, y=13}, boss = {min = 1, max = 10}, boss_colour = HEX('b95c96')},
        bl_water =           {name = 'The Water',    defeated = false, order = 13, dollars = 5, mult = 2, vars = {}, debuff = {}, pos = {x=0, y=14}, boss = {min = 2, max = 10}, boss_colour = HEX('c6e0eb')},
        bl_eye =             {name = 'The Eye',      defeated = false, order = 16, dollars = 5, mult = 2, vars = {}, debuff = {}, pos = {x=0, y=17}, boss = {min = 3, max = 10}, boss_colour = HEX('4b71e4')},
        bl_plant =           {name = 'The Plant',    defeated = false, order = 18, dollars = 5, mult = 2, vars = {}, debuff = {is_face = 'face'}, pos = {x=0, y=19}, boss = {min = 4, max = 10}, boss_colour = HEX('709284')},
        bl_needle =          {name = 'The Needle',   defeated = false, order = 21, dollars = 5, mult = 1, vars = {}, debuff = {}, pos = {x=0, y=20}, boss = {min = 2, max = 10}, boss_colour = HEX('5c6e31')},
        bl_head =            {name = 'The Head',     defeated = false, order = 22, dollars = 5, mult = 2, vars = {}, debuff = {suit = 'Hearts'}, pos = {x=0, y=21}, boss = {min = 1, max = 10}, boss_colour = HEX('ac9db4')},
        bl_final_leaf =      {name = 'Verdant Leaf', defeated = false, order = 27, dollars = 8, mult = 2, vars = {}, debuff = {}, pos = {x=0, y=28}, boss = {showdown = true, min = 10, max = 10}, boss_colour = HEX('56a786')},
        bl_final_vessel =    {name = 'Violet Vessel',defeated = false, order = 28, dollars = 8, mult = 6, vars = {}, debuff = {}, pos = {x=0, y=29}, boss = {showdown = true, min = 10, max = 10}, boss_colour = HEX('8a71e1')},
        bl_window =          {name = 'The Window',   defeated = false, order = 14, dollars = 5, mult = 2, vars = {}, debuff = {suit = 'Diamonds'}, pos = {x=0, y=6}, boss = {min = 1, max = 10}, boss_colour = HEX('a9a295')},
        bl_serpent =         {name = 'The Serpent',  defeated = false, order = 19, dollars = 5, mult = 2, vars = {}, debuff = {}, pos = {x=0, y=15}, boss = {min = 5, max = 10}, boss_colour = HEX('439a4f')},
        bl_pillar =          {name = 'The Pillar',   defeated = false, order = 20, dollars = 5, mult = 2, vars = {}, debuff = {}, pos = {x=0, y=16}, boss = {min = 1, max = 10}, boss_colour = HEX('7e6752')},
        bl_flint =           {name = 'The Flint',    defeated = false, order = 24, dollars = 5, mult = 2, vars = {}, debuff = {}, pos = {x=0, y=24}, boss = {min = 2, max = 10}, boss_colour = HEX('e56a2f')},
        bl_final_acorn =     {name = 'Amber Acorn',  defeated = false, order = 26, dollars = 8, mult = 2, vars = {}, debuff = {}, pos = {x=0, y=27}, boss = {showdown = true, min = 10, max = 10}, boss_colour = HEX('fda200')},
        bl_final_heart =     {name = 'Crimson Heart',defeated = false, order = 29, dollars = 8, mult = 2, vars = {}, debuff = {}, pos = {x=0, y=25}, boss = {showdown = true, min = 10, max = 10}, boss_colour = HEX('ac3232')},
        
    }
    self.b_undiscovered = {name = 'Undiscovered', debuff_text = 'Defeat this blind to discover', pos = {x=0,y=30}}

    self.P_CARDS = {
        H_2={name = "2 of Hearts",value = '2', suit = 'Hearts', pos = {x=0,y=0}},
        H_3={name = "3 of Hearts",value = '3', suit = 'Hearts', pos = {x=1,y=0}},
        H_4={name = "4 of Hearts",value = '4', suit = 'Hearts', pos = {x=2,y=0}},
        H_5={name = "5 of Hearts",value = '5', suit = 'Hearts', pos = {x=3,y=0}},
        H_6={name = "6 of Hearts",value = '6', suit = 'Hearts', pos = {x=4,y=0}},
        H_7={name = "7 of Hearts",value = '7', suit = 'Hearts', pos = {x=5,y=0}},
        H_8={name = "8 of Hearts",value = '8', suit = 'Hearts', pos = {x=6,y=0}},
        H_9={name = "9 of Hearts",value = '9', suit = 'Hearts', pos = {x=7,y=0}},
        H_T={name = "10 of Hearts",value = '10', suit = 'Hearts', pos = {x=8,y=0}},
        H_J={name = "Jack of Hearts",value = 'Jack', suit = 'Hearts', pos = {x=9,y=0}},
        H_Q={name = "Queen of Hearts",value = 'Queen', suit = 'Hearts', pos = {x=10,y=0}},
        H_K={name = "King of Hearts",value = 'King', suit = 'Hearts', pos = {x=11,y=0}},
        H_A={name = "Ace of Hearts",value = 'Ace', suit = 'Hearts', pos = {x=12,y=0}},
        C_2={name = "2 of Clubs",value = '2', suit = 'Clubs', pos = {x=0,y=1}},
        C_3={name = "3 of Clubs",value = '3', suit = 'Clubs', pos = {x=1,y=1}},
        C_4={name = "4 of Clubs",value = '4', suit = 'Clubs', pos = {x=2,y=1}},
        C_5={name = "5 of Clubs",value = '5', suit = 'Clubs', pos = {x=3,y=1}},
        C_6={name = "6 of Clubs",value = '6', suit = 'Clubs', pos = {x=4,y=1}},
        C_7={name = "7 of Clubs",value = '7', suit = 'Clubs', pos = {x=5,y=1}},
        C_8={name = "8 of Clubs",value = '8', suit = 'Clubs', pos = {x=6,y=1}},
        C_9={name = "9 of Clubs",value = '9', suit = 'Clubs', pos = {x=7,y=1}},
        C_T={name = "10 of Clubs",value = '10', suit = 'Clubs', pos = {x=8,y=1}},
        C_J={name = "Jack of Clubs",value = 'Jack', suit = 'Clubs', pos = {x=9,y=1}},
        C_Q={name = "Queen of Clubs",value = 'Queen', suit = 'Clubs', pos = {x=10,y=1}},
        C_K={name = "King of Clubs",value = 'King', suit = 'Clubs', pos = {x=11,y=1}},
        C_A={name = "Ace of Clubs",value = 'Ace', suit = 'Clubs', pos = {x=12,y=1}},
        D_2={name = "2 of Diamonds",value = '2', suit = 'Diamonds', pos = {x=0,y=2}},
        D_3={name = "3 of Diamonds",value = '3', suit = 'Diamonds', pos = {x=1,y=2}},
        D_4={name = "4 of Diamonds",value = '4', suit = 'Diamonds', pos = {x=2,y=2}},
        D_5={name = "5 of Diamonds",value = '5', suit = 'Diamonds', pos = {x=3,y=2}},
        D_6={name = "6 of Diamonds",value = '6', suit = 'Diamonds', pos = {x=4,y=2}},
        D_7={name = "7 of Diamonds",value = '7', suit = 'Diamonds', pos = {x=5,y=2}},
        D_8={name = "8 of Diamonds",value = '8', suit = 'Diamonds', pos = {x=6,y=2}},
        D_9={name = "9 of Diamonds",value = '9', suit = 'Diamonds', pos = {x=7,y=2}},
        D_T={name = "10 of Diamonds",value = '10', suit = 'Diamonds', pos = {x=8,y=2}},
        D_J={name = "Jack of Diamonds",value = 'Jack', suit = 'Diamonds', pos = {x=9,y=2}},
        D_Q={name = "Queen of Diamonds",value = 'Queen', suit = 'Diamonds', pos = {x=10,y=2}},
        D_K={name = "King of Diamonds",value = 'King', suit = 'Diamonds', pos = {x=11,y=2}},
        D_A={name = "Ace of Diamonds",value = 'Ace', suit = 'Diamonds', pos = {x=12,y=2}},
        S_2={name = "2 of Spades",value = '2', suit = 'Spades', pos = {x=0,y=3}},
        S_3={name = "3 of Spades",value = '3', suit = 'Spades', pos = {x=1,y=3}},
        S_4={name = "4 of Spades",value = '4', suit = 'Spades', pos = {x=2,y=3}},
        S_5={name = "5 of Spades",value = '5', suit = 'Spades', pos = {x=3,y=3}},
        S_6={name = "6 of Spades",value = '6', suit = 'Spades', pos = {x=4,y=3}},
        S_7={name = "7 of Spades",value = '7', suit = 'Spades', pos = {x=5,y=3}},
        S_8={name = "8 of Spades",value = '8', suit = 'Spades', pos = {x=6,y=3}},
        S_9={name = "9 of Spades",value = '9', suit = 'Spades', pos = {x=7,y=3}},
        S_T={name = "10 of Spades",value = '10', suit = 'Spades', pos = {x=8,y=3}},
        S_J={name = "Jack of Spades",value = 'Jack', suit = 'Spades', pos = {x=9,y=3}},
        S_Q={name = "Queen of Spades",value = 'Queen', suit = 'Spades', pos = {x=10,y=3}},
        S_K={name = "King of Spades",value = 'King', suit = 'Spades', pos = {x=11,y=3}},
        S_A={name = "Ace of Spades",value = 'Ace', suit = 'Spades', pos = {x=12,y=3}},
    }

    self.j_locked = {unlocked = false, max = 1, name = "Locked", pos = {x=8,y=9}, set = "Joker", cost_mult = 1.0,config = {}}
    self.v_locked = {unlocked = false, max = 1, name = "Locked", pos = {x=8,y=3}, set = "Voucher", cost_mult = 1.0,config = {}}
    self.c_locked = {unlocked = false, max = 1, name = "Locked", pos = {x=4,y=2}, set = "Tarot", cost_mult = 1.0,config = {}}
    self.j_undiscovered = {unlocked = false, max = 1, name = "Locked", pos = {x=9,y=9}, set = "Joker", cost_mult = 1.0,config = {}}
    self.t_undiscovered = {unlocked = false, max = 1, name = "Locked", pos = {x=6,y=2}, set = "Tarot", cost_mult = 1.0,config = {}}
    self.p_undiscovered = {unlocked = false, max = 1, name = "Locked", pos = {x=7,y=2}, set = "Planet", cost_mult = 1.0,config = {}}
    self.s_undiscovered = {unlocked = false, max = 1, name = "Locked", pos = {x=5,y=2}, set = "Spectral", cost_mult = 1.0,config = {}}
    self.v_undiscovered = {unlocked = false, max = 1, name = "Locked", pos = {x=8,y=2}, set = "Voucher", cost_mult = 1.0,config = {}}
    self.booster_undiscovered = {unlocked = false, max = 1, name = "Locked", pos = {x=0,y=5}, set = "Booster", cost_mult = 1.0,config = {}}

    self.P_CENTERS = {
        c_base={max = 500, freq = 1, line = 'base', name = "Default Base", pos = {x=1,y=0}, set = "Default", label = 'Base Card', effect = "Base", cost_mult = 1.0, config = {}},

        --Jokers
        j_joker=            {order = 1,  unlocked = true,   start_alerted = true, discovered = true,  blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 1, cost = 2, name = "Joker", pos = {x=0,y=0}, set = "Joker", effect = "Mult", cost_mult = 1.0, config = {mult = 4}},
        j_greedy_joker=     {order = 2,  unlocked = true,   discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 1, cost = 5, name = "Greedy Joker", pos = {x=6,y=1}, set = "Joker", effect = "Suit Mult", cost_mult = 1.0, config = {extra = {s_mult = 3, suit = 'Diamonds'}}},
        j_lusty_joker=      {order = 3,  unlocked = true,   discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 1, cost = 5, name = "Lusty Joker", pos = {x=7,y=1}, set = "Joker", effect = "Suit Mult", cost_mult = 1.0, config = {extra = {s_mult = 3, suit = 'Hearts'}}},
        j_wrathful_joker=   {order = 4,  unlocked = true,   discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 1, cost = 5, name = "Wrathful Joker", pos = {x=8,y=1}, set = "Joker", effect = "Suit Mult", cost_mult = 1.0, config = {extra = {s_mult = 3, suit = 'Spades'}}},
        j_gluttenous_joker= {order = 5,  unlocked = true,   discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 1, cost = 5, name = "Gluttonous Joker", pos = {x=9,y=1}, set = "Joker", effect = "Suit Mult", cost_mult = 1.0, config = {extra = {s_mult = 3, suit = 'Clubs'}}},
        j_jolly=            {order = 6,  unlocked = true,   discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 1, cost = 3, name = "Jolly Joker", pos = {x=2,y=0}, set = "Joker", effect = "Type Mult", cost_mult = 1.0, config = {t_mult = 8, type = 'Pair'}},
        j_zany=             {order = 7,  unlocked = true,   discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 1, cost = 4, name = "Zany Joker", pos = {x=3,y=0}, set = "Joker", effect = "Type Mult", cost_mult = 1.0, config = {t_mult = 12, type = 'Three of a Kind'}},
        j_mad=              {order = 8,  unlocked = true,   discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 1, cost = 4, name = "Mad Joker", pos = {x=4,y=0}, set = "Joker", effect = "Type Mult", cost_mult = 1.0, config = {t_mult = 10, type = 'Two Pair'}},
        j_crazy=            {order = 9,  unlocked = true,   discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 1, cost = 4, name = "Crazy Joker", pos = {x=5,y=0}, set = "Joker", effect = "Type Mult", cost_mult = 1.0, config = {t_mult = 12, type = 'Straight'}},
        j_droll=            {order = 10,  unlocked = true,  discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 1, cost = 4, name = "Droll Joker", pos = {x=6,y=0}, set = "Joker", effect = "Type Mult", cost_mult = 1.0, config = {t_mult = 10, type = 'Flush'}},
        j_sly=              {order = 11,  unlocked = true,  discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 1, cost = 3, name = "Sly Joker",set = "Joker", config = {t_chips = 50, type = 'Pair'}, pos = {x=0,y=14}},
        j_wily=             {order = 12,  unlocked = true,  discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 1, cost = 4, name = "Wily Joker",set = "Joker", config = {t_chips = 100, type = 'Three of a Kind'}, pos = {x=1,y=14}},
        j_clever=           {order = 13,  unlocked = true,  discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 1, cost = 4, name = "Clever Joker",set = "Joker", config = {t_chips = 80, type = 'Two Pair'}, pos = {x=2,y=14}},
        j_devious=          {order = 14,  unlocked = true,  discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 1, cost = 4, name = "Devious Joker",set = "Joker", config = {t_chips = 100, type = 'Straight'}, pos = {x=3,y=14}},
        j_crafty=           {order = 15,  unlocked = true,  discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 1, cost = 4, name = "Crafty Joker",set = "Joker", config = {t_chips = 80, type = 'Flush'}, pos = {x=4,y=14}},

        j_half=             {order = 16,  unlocked = true,   discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 1, cost = 5, name = "Half Joker", pos = {x=7,y=0}, set = "Joker", effect = "Hand Size Mult", cost_mult = 1.0, config = {extra = {mult = 20, size = 3}}},
        j_stencil=          {order = 17,  unlocked = true,  discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 2, cost = 8, name = "Joker Stencil", pos = {x=2,y=5}, set = "Joker", effect = "Hand Size Mult", cost_mult = 1.0, config = {}},
        j_four_fingers=     {order = 18,  unlocked = true,  discovered = false, blueprint_compat = false, perishable_compat = true, eternal_compat = true, rarity = 2, cost = 7, name = "Four Fingers", pos = {x=6,y=6}, set = "Joker", effect = "", config = {}},
        j_mime=             {order = 19,  unlocked = true,  discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 2, cost = 5, name = "Mime", pos = {x=4,y=1}, set = "Joker", effect = "Hand card double", cost_mult = 1.0, config = {extra = 1}},
        j_credit_card=      {order = 20,  unlocked = true,  discovered = false, blueprint_compat = false, perishable_compat = true, eternal_compat = true, rarity = 1, cost = 1, name = "Credit Card", pos = {x=5,y=1}, set = "Joker", effect = "Credit", cost_mult = 1.0, config = {extra = 20}},
        j_ceremonial=       {order = 21,  unlocked = true,  discovered = false, blueprint_compat = true, perishable_compat = false, eternal_compat = true, rarity = 2, cost = 6, name = "Ceremonial Dagger", pos = {x=5,y=5}, set = "Joker", effect = "", config = {mult = 0}},
        j_banner=           {order = 22,  unlocked = true,  discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 1, cost = 5, name = "Banner", pos = {x=1,y=2}, set = "Joker", effect = "Discard Chips", cost_mult = 1.0, config = {extra = 30}},
        j_mystic_summit=    {order = 23,  unlocked = true,  discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 1, cost = 5, name = "Mystic Summit", pos = {x=2,y=2}, set = "Joker", effect = "No Discard Mult", cost_mult = 1.0, config = {extra = {mult = 15, d_remaining = 0}}},
        j_marble=           {order = 24,  unlocked = true,  discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 2, cost = 6, name = "Marble Joker", pos = {x=3,y=2}, set = "Joker", effect = "Stone card hands", cost_mult = 1.0, config = {extra = 1}},
        j_loyalty_card=     {order = 25,  unlocked = true,  discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 2, cost = 5, name = "Loyalty Card", pos = {x=4,y=2}, set = "Joker", effect = "1 in 10 mult", cost_mult = 1.0, config = {extra = {Xmult = 4, every = 5, remaining = "5 remaining"}}},
        j_8_ball=           {order = 26,  unlocked = true,  discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 1, cost = 5, name = "8 Ball", pos = {x=0,y=5}, set = "Joker", effect = "Spawn Tarot", cost_mult = 1.0, config = {extra=4}},
        j_misprint=         {order = 27,  unlocked = true,  discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 1, cost = 4, name = "Misprint", pos = {x=6,y=2}, set = "Joker", effect = "Random Mult", cost_mult = 1.0, config = {extra = {max = 23, min = 0}}},
        j_dusk=             {order = 28,  unlocked = true,  discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 2, cost = 5, name = "Dusk", pos = {x=4,y=7}, set = "Joker", effect = "", config = {extra = 1}, unlock_condition = {type = '', extra = '', hidden = true}},
        j_raised_fist=      {order = 29,  unlocked = true,  discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 1, cost = 5, name = "Raised Fist", pos = {x=8,y=2}, set = "Joker", effect = "Socialized Mult", cost_mult = 1.0, config = {}},
        j_chaos=            {order = 30,  unlocked = true,  discovered = false, blueprint_compat = false, perishable_compat = true, eternal_compat = true, rarity = 1, cost = 4, name = "Chaos the Clown", pos = {x=1,y=0}, set = "Joker", effect = "Bonus Rerolls", cost_mult = 1.0, config = {extra = 1}},
        
        j_fibonacci=        {order = 31,  unlocked = true,  discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 2, cost = 8, name = "Fibonacci", pos = {x=1,y=5}, set = "Joker", effect = "Card Mult", cost_mult = 1.0, config = {extra = 8}},
        j_steel_joker=      {order = 32,  unlocked = true,  discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 2, cost = 7, name = "Steel Joker", pos = {x=7,y=2}, set = "Joker", effect = "Steel Card Buff", cost_mult = 1.0, config = {extra = 0.2}, enhancement_gate = 'm_steel'},
        j_scary_face=       {order = 33,  unlocked = true,  discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 1, cost = 4, name = "Scary Face", pos = {x=2,y=3}, set = "Joker", effect = "Scary Face Cards", cost_mult = 1.0, config = {extra = 30}},
        j_abstract=         {order = 34,  unlocked = true,  discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 1, cost = 4, name = "Abstract Joker", pos = {x=3,y=3}, set = "Joker", effect = "Joker Mult", cost_mult = 1.0, config = {extra = 3}},
        j_delayed_grat=     {order = 35,  unlocked = true,  discovered = false, blueprint_compat = false, perishable_compat = true, eternal_compat = true, rarity = 1, cost = 4, name = "Delayed Gratification", pos = {x=4,y=3}, set = "Joker", effect = "Discard dollars", cost_mult = 1.0, config = {extra = 2}},
        j_hack=             {order = 36,  unlocked = true,  discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 2, cost = 6, name = "Hack", pos = {x=5,y=2}, set = "Joker", effect = "Low Card double", cost_mult = 1.0, config = {extra = 1}},
        j_pareidolia=       {order = 37,  unlocked = true,  discovered = false, blueprint_compat = false, perishable_compat = true, eternal_compat = true, rarity = 2, cost = 5, name = "Pareidolia", pos = {x=6,y=3}, set = "Joker", effect = "All face cards", cost_mult = 1.0, config = {}},
        j_gros_michel=      {order = 38,  unlocked = true,  discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = false, rarity = 1, cost = 5, name = "Gros Michel", pos = {x=7,y=6}, set = "Joker", effect = "", config = {extra = {odds = 6, mult = 15}}, no_pool_flag = 'gros_michel_extinct'},
        j_even_steven=      {order = 39,  unlocked = true,  discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 1, cost = 4, name = "Even Steven", pos = {x=8,y=3}, set = "Joker", effect = "Even Card Buff", cost_mult = 1.0, config = {extra = 4}},
        j_odd_todd=         {order = 40,  unlocked = true,  discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 1, cost = 4, name = "Odd Todd", pos = {x=9,y=3}, set = "Joker", effect = "Odd Card Buff", cost_mult = 1.0, config = {extra = 31}},
        j_scholar=          {order = 41,  unlocked = true,  discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 1, cost = 4, name = "Scholar", pos = {x=0,y=4}, set = "Joker", effect = "Ace Buff", cost_mult = 1.0, config = {extra = {mult = 4, chips = 20}}},
        j_business=         {order = 42,  unlocked = true,  discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 1, cost = 4, name = "Business Card", pos = {x=1,y=4}, set = "Joker", effect = "Face Card dollar Chance", cost_mult = 1.0, config = {extra = 2}},
        j_supernova=        {order = 43,  unlocked = true,  discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 1, cost = 5, name = "Supernova", pos = {x=2,y=4}, set = "Joker", effect = "Hand played mult", cost_mult = 1.0, config = {extra = 1}},
        j_ride_the_bus=     {order = 44,  unlocked = true,  discovered = false, blueprint_compat = true, perishable_compat = false, eternal_compat = true, rarity = 1, cost = 6, name = "Ride the Bus", pos = {x=1,y=6}, set = "Joker", effect = "", config = {extra = 1}, unlock_condition = {type = 'discard_custom'}},
        j_space=            {order = 45,  unlocked = true,  discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 2, cost = 5, name = "Space Joker", pos = {x=3,y=5}, set = "Joker", effect = "Upgrade Hand chance", cost_mult = 1.0, config = {extra = 4}},
        
        j_egg=              {order = 46,  unlocked = true,  discovered = false, blueprint_compat = false, perishable_compat = true, eternal_compat = true, rarity = 1, cost = 4, name = 'Egg', pos = {x = 0, y = 10}, set = 'Joker', config = {extra = 3}},
        j_burglar=          {order = 47,  unlocked = true,  discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 2, cost = 6, name = 'Burglar', pos = {x = 1, y = 10}, set = 'Joker', config = {extra = 3}},
        j_blackboard=       {order = 48,  unlocked = true,  discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 2, cost = 6, name = 'Blackboard', pos = {x = 2, y = 10}, set = 'Joker', config = {extra = 3}},
        j_runner=           {order = 49,  unlocked = true,  discovered = false, blueprint_compat = true, perishable_compat = false, eternal_compat = true, rarity = 1, cost = 5, name = 'Runner', pos = {x = 3, y = 10}, set = 'Joker', config = {extra = {chips = 0, chip_mod = 15}}},
        j_ice_cream=        {order = 50,  unlocked = true,  discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = false, rarity = 1, cost = 5, name = 'Ice Cream', pos = {x = 4, y = 10}, set = 'Joker', config = {extra = {chips = 100, chip_mod = 5}}},
        j_dna=              {order = 51,  unlocked = true,  discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 3, cost = 8, name = 'DNA', pos = {x = 5, y = 10}, set = 'Joker', config = {}},
        j_splash=           {order = 52,  unlocked = true,  discovered = false, blueprint_compat = false, perishable_compat = true, eternal_compat = true, rarity = 1, cost = 3, name = 'Splash', pos = {x = 6, y = 10}, set = 'Joker', config = {}},
        j_blue_joker=       {order = 53,  unlocked = true,  discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 1, cost = 5, name = 'Blue Joker', pos = {x = 7, y = 10}, set = 'Joker', config = {extra = 2}},
        j_sixth_sense=      {order = 54,  unlocked = true,  discovered = false, blueprint_compat = false, perishable_compat = true, eternal_compat = true, rarity = 2, cost = 6, name = 'Sixth Sense', pos = {x = 8, y = 10}, set = 'Joker', config = {}},
        j_constellation=    {order = 55,  unlocked = true,  discovered = false, blueprint_compat = true, perishable_compat = false, eternal_compat = true, rarity = 2, cost = 6, name = 'Constellation', pos = {x = 9, y = 10}, set = 'Joker', config = {extra = 0.1, Xmult = 1}},
        j_hiker=            {order = 56,  unlocked = true,  discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 2, cost = 5, name = 'Hiker', pos = {x = 0, y = 11}, set = 'Joker', config = {extra = 5}},
        j_faceless=         {order = 57,  unlocked = true,  discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 1, cost = 4, name = 'Faceless Joker', pos = {x = 1, y = 11}, set = 'Joker', config = {extra = {dollars = 5, faces = 3}}},
        j_green_joker=      {order = 58,  unlocked = true,  discovered = false, blueprint_compat = true, perishable_compat = false, eternal_compat = true, rarity = 1, cost = 4, name = 'Green Joker', pos = {x = 2, y = 11}, set = 'Joker', config = {extra = {hand_add = 1, discard_sub = 1}}},
        j_superposition=    {order = 59,  unlocked = true,  discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 1, cost = 4, name = 'Superposition', pos = {x = 3, y = 11}, set = 'Joker', config = {}},
        j_todo_list=        {order = 60,  unlocked = true,  discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 1, cost = 4, name = 'To Do List', pos = {x = 4, y = 11}, set = 'Joker', config = {extra = {dollars = 4, poker_hand = 'High Card'}}},

        j_cavendish=        {order = 61,  unlocked = true, discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = false, rarity = 1, cost = 4, name = "Cavendish", pos = {x=5,y=11}, set = "Joker", cost_mult = 1.0, config = {extra = {odds = 1000, Xmult = 3}}, yes_pool_flag = 'gros_michel_extinct'},
        j_card_sharp=       {order = 62,  unlocked = true, discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 2, cost = 6, name = "Card Sharp", pos = {x=6,y=11}, set = "Joker", cost_mult = 1.0, config = {extra = {Xmult = 3}}},
        j_red_card=         {order = 63,  unlocked = true, discovered = false, blueprint_compat = true, perishable_compat = false, eternal_compat = true, rarity = 1, cost = 5, name = "Red Card", pos = {x=7,y=11}, set = "Joker", cost_mult = 1.0, config = {extra = 3}},
        j_madness=          {order = 64,  unlocked = true, discovered = false, blueprint_compat = true, perishable_compat = false, eternal_compat = true, rarity = 2, cost = 7, name = "Madness", pos = {x=8,y=11}, set = "Joker", cost_mult = 1.0, config = {extra = 0.5}},
        j_square=           {order = 65,  unlocked = true, discovered = false, blueprint_compat = true, perishable_compat = false, eternal_compat = true, rarity = 1, cost = 4, name = "Square Joker", pos = {x=9,y=11}, set = "Joker", cost_mult = 1.0, config = {extra = {chips = 0, chip_mod = 4}}},
        j_seance=           {order = 66,  unlocked = true, discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 2, cost = 6, name = "Seance", pos = {x=0,y=12}, set = "Joker", cost_mult = 1.0, config = {extra = {poker_hand = 'Straight Flush'}}},
        j_riff_raff=        {order = 67,  unlocked = true, discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 1, cost = 6, name = "Riff-raff", pos = {x=1,y=12}, set = "Joker", cost_mult = 1.0, config = {extra = 2}},
        j_vampire=          {order = 68,  unlocked = true, discovered = false, blueprint_compat = true, perishable_compat = false, eternal_compat = true, rarity = 2, cost = 7, name = "Vampire",set = "Joker", config = {extra = 0.1, Xmult = 1},  pos = {x=2,y=12}},
        j_shortcut=         {order = 69,  unlocked = true, discovered = false, blueprint_compat = false, perishable_compat = true, eternal_compat = true, rarity = 2, cost = 7, name = "Shortcut",set = "Joker", config = {},  pos = {x=3,y=12}},
        j_hologram=         {order = 70,  unlocked = true, discovered = false, blueprint_compat = true, perishable_compat = false, eternal_compat = true, rarity = 2, cost = 7, name = "Hologram",set = "Joker", config = {extra = 0.25, Xmult = 1},  pos = {x=4,y=12}, soul_pos = {x=2, y=9},},
        j_vagabond=         {order = 71,  unlocked = true, discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 3, cost = 8, name = "Vagabond",set = "Joker", config = {extra = 4}, pos = {x=5,y=12}},
        j_baron=            {order = 72,  unlocked = true, discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 3, cost = 8, name = "Baron",set = "Joker", config = {extra = 1.5}, pos = {x=6,y=12}},
        j_cloud_9=          {order = 73,  unlocked = true, discovered = false, blueprint_compat = false, perishable_compat = true, eternal_compat = true, rarity = 2, cost = 7, name = "Cloud 9",set = "Joker", config = {extra = 1}, pos = {x=7,y=12}},
        j_rocket=           {order = 74,  unlocked = true, discovered = false, blueprint_compat = false, perishable_compat = false, eternal_compat = true, rarity = 2, cost = 6, name = "Rocket",set = "Joker", config = {extra = {dollars = 1, increase = 2}}, pos = {x=8,y=12}},
        j_obelisk=          {order = 75,  unlocked = true, discovered = false, blueprint_compat = true, perishable_compat = false, eternal_compat = true, rarity = 3, cost = 8, name = "Obelisk",set = "Joker", config = {extra = 0.2, Xmult = 1}, pos = {x=9,y=12}},

        j_midas_mask=       {order = 76,  unlocked = true,  discovered = false, blueprint_compat = false, perishable_compat = true, eternal_compat = true, rarity = 2, cost = 7, name = "Midas Mask",set = "Joker", config = {}, pos = {x=0,y=13}},
        j_luchador=         {order = 77,  unlocked = true,  discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = false, rarity = 2, cost = 5, name = "Luchador",set = "Joker", config = {}, pos = {x=1,y=13}},
        j_photograph=       {order = 78,  unlocked = true,  discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 1, cost = 5, name = "Photograph",set = "Joker", config = {extra = 2}, pos = {x=2,y=13}},
        j_gift=             {order = 79,  unlocked = true,  discovered = false, blueprint_compat = false, perishable_compat = true, eternal_compat = true, rarity = 2, cost = 6, name = "Gift Card",set = "Joker", config = {extra = 1}, pos = {x=3,y=13}},
        j_turtle_bean=      {order = 80,  unlocked = true,  discovered = false, blueprint_compat = false, perishable_compat = true, eternal_compat = false, rarity = 2, cost = 6, name = "Turtle Bean",set = "Joker", config = {extra = {h_size = 5, h_mod = 1}}, pos = {x=4,y=13}},
        j_erosion=          {order = 81,  unlocked = true,  discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 2, cost = 6, name = "Erosion",set = "Joker", config = {extra = 4}, pos = {x=5,y=13}},
        j_reserved_parking= {order = 82,  unlocked = true,  discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 1, cost = 6, name = "Reserved Parking",set = "Joker", config = {extra = {odds = 2, dollars = 1}}, pos = {x=6,y=13}},
        j_mail=             {order = 83,  unlocked = true,  discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 1, cost = 4, name = "Mail-In Rebate",set = "Joker", config = {extra = 5}, pos = {x=7,y=13}},
        j_to_the_moon=      {order = 84,  unlocked = true,  discovered = false, blueprint_compat = false, perishable_compat = true, eternal_compat = true, rarity = 2, cost = 5, name = "To the Moon",set = "Joker", config = {extra = 1}, pos = {x=8,y=13}},
        j_hallucination=    {order = 85,  unlocked = true,  discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 1, cost = 4, name = "Hallucination",set = "Joker", config = {extra = 2}, pos = {x=9,y=13}},
        j_fortune_teller=   {order = 86,  unlocked = true,  discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 1, cost = 6, name = "Fortune Teller", pos = {x=7,y=5}, set = "Joker", effect = "", config = {extra = 1}},
        j_juggler=          {order = 87,  unlocked = true,  discovered = false, blueprint_compat = false, perishable_compat = true, eternal_compat = true, rarity = 1, cost = 4, name = "Juggler", pos = {x=0,y=1}, set = "Joker", effect = "Hand Size", cost_mult = 1.0, config = {h_size = 1}},
        j_drunkard=         {order = 88,  unlocked = true,  discovered = false, blueprint_compat = false, perishable_compat = true, eternal_compat = true, rarity = 1, cost = 4, name = "Drunkard", pos = {x=1,y=1}, set = "Joker", effect = "Discard Size", cost_mult = 1.0, config = {d_size = 1}},
        j_stone=            {order = 89,  unlocked = true,  discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 2, cost = 6, name = "Stone Joker", pos = {x=9,y=0}, set = "Joker", effect = "Stone Card Buff", cost_mult = 1.0, config = {extra = 25}, enhancement_gate = 'm_stone'},
        j_golden=           {order = 90,  unlocked = true,  discovered = false, blueprint_compat = false, perishable_compat = true, eternal_compat = true, rarity = 1, cost = 6, name = "Golden Joker", pos = {x=9,y=2}, set = "Joker", effect = "Bonus dollars", cost_mult = 1.0, config = {extra = 4}},

        j_lucky_cat=        {order = 91,   unlocked = true, discovered = false, blueprint_compat = true, perishable_compat = false, eternal_compat = true, rarity = 2, cost = 6, name = "Lucky Cat",set = "Joker", config = {Xmult = 1, extra = 0.25}, pos = {x=5,y=14}, enhancement_gate = 'm_lucky'},
        j_baseball=         {order = 92,   unlocked = true, discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 3, cost = 8, name = "Baseball Card",set = "Joker", config = {extra = 1.5}, pos = {x=6,y=14}},
        j_bull=             {order = 93,   unlocked = true, discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 2, cost = 6, name = "Bull",set = "Joker", config = {extra = 2}, pos = {x=7,y=14}},
        j_diet_cola=        {order = 94,   unlocked = true, discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = false, rarity = 2, cost = 6, name = "Diet Cola",set = "Joker", config = {}, pos = {x=8,y=14}},
        j_trading=          {order = 95,   unlocked = true, discovered = false, blueprint_compat = false, perishable_compat = true, eternal_compat = true, rarity = 2, cost = 6, name = "Trading Card",set = "Joker", config = {extra = 3}, pos = {x=9,y=14}},
        j_flash=            {order = 96,   unlocked = true, discovered = false, blueprint_compat = true, perishable_compat = false, eternal_compat = true, rarity = 2, cost = 5, name = "Flash Card",set = "Joker", config = {extra = 2, mult = 0}, pos = {x=0,y=15}},
        j_popcorn=          {order = 97,   unlocked = true, discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = false, rarity = 1, cost = 5, name = "Popcorn",set = "Joker", config = {mult = 20, extra = 4}, pos = {x=1,y=15}},
        j_trousers=         {order = 98,   unlocked = true, discovered = false, blueprint_compat = true, perishable_compat = false, eternal_compat = true, rarity = 2, cost = 6, name = "Spare Trousers",set = "Joker", config = {extra = 2}, pos = {x=4,y=15}},
        j_ancient=          {order = 99,   unlocked = true, discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 3, cost = 8, name = "Ancient Joker",set = "Joker", config = {extra = 1.5}, pos = {x=7,y=15}},
        j_ramen=            {order = 100,  unlocked = true, discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = false, rarity = 2, cost = 6, name = "Ramen",set = "Joker", config = {Xmult = 2, extra = 0.01}, pos = {x=2,y=15}},
        j_walkie_talkie=    {order = 101,  unlocked = true, discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 1, cost = 4, name = "Walkie Talkie",set = "Joker", config = {extra = {chips = 10, mult = 4}}, pos = {x=8,y=15}},
        j_selzer=           {order = 102,  unlocked = true, discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = false, rarity = 2, cost = 6, name = "Seltzer",set = "Joker", config = {extra = 10}, pos = {x=3,y=15}},
        j_castle=           {order = 103,  unlocked = true, discovered = false, blueprint_compat = true, perishable_compat = false, eternal_compat = true, rarity = 2, cost = 6, name = "Castle",set = "Joker", config = {extra = {chips = 0, chip_mod = 3}}, pos = {x=9,y=15}},
        j_smiley=           {order = 104,  unlocked = true, discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 1, cost = 4, name = "Smiley Face",set = "Joker", config = {extra = 5}, pos = {x=6,y=15}},
        j_campfire=         {order = 105,  unlocked = true, discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 3, cost = 9, name = "Campfire",set = "Joker", config = {extra = 0.25}, pos = {x=5,y=15}},

        j_ticket=           {order = 106,  unlocked = false, discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 1, cost = 5, name = "Golden Ticket", pos = {x=5,y=3}, set = "Joker", effect = "dollars for Gold cards", cost_mult = 1.0, config = {extra = 4},unlock_condition = {type = 'hand_contents', extra = 'Gold'}, enhancement_gate = 'm_gold'},
        j_mr_bones=         {order = 107,  unlocked = false, discovered = false, blueprint_compat = false, perishable_compat = true, eternal_compat = false, rarity = 2, cost = 5, name = "Mr. Bones", pos = {x=3,y=4}, set = "Joker", effect = "Prevent Death", cost_mult = 1.0, config = {},unlock_condition = {type = 'c_losses', extra = 5}},
        j_acrobat=          {order = 108,  unlocked = false, discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 2, cost = 6, name = "Acrobat", pos = {x=2,y=1}, set = "Joker", effect = "Shop size", cost_mult = 1.0, config = {extra = 3},unlock_condition = {type = 'c_hands_played', extra = 200}},
        j_sock_and_buskin=  {order = 109,  unlocked = false, discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 2, cost = 6, name = "Sock and Buskin", pos = {x=3,y=1}, set = "Joker", effect = "Face card double", cost_mult = 1.0, config = {extra = 1},unlock_condition = {type = 'c_face_cards_played', extra = 300}},
        j_swashbuckler=     {order = 110,  unlocked = false, discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 1, cost = 4, name = "Swashbuckler", pos = {x=9,y=5}, set = "Joker", effect = "Set Mult", cost_mult = 1.0, config = {mult = 1},unlock_condition = {type = 'c_jokers_sold', extra = 20}},
        j_troubadour=       {order = 111,  unlocked = false, discovered = false, blueprint_compat = false, perishable_compat = true, eternal_compat = true, rarity = 2, cost = 6, name = "Troubadour", pos = {x=0,y=2}, set = "Joker", effect = "Hand Size, Plays", cost_mult = 1.0, config = {extra = {h_size = 2, h_plays = -1}}, unlock_condition = {type = 'round_win', extra = 5}},
        j_certificate=      {order = 112,  unlocked = false, discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 2, cost = 6, name = "Certificate", pos = {x=8,y=8}, set = "Joker", effect = "", config = {}, unlock_condition = {type = 'double_gold'}},
        j_smeared=          {order = 113,  unlocked = false, discovered = false, blueprint_compat = false, perishable_compat = true, eternal_compat = true, rarity = 2, cost = 7, name = "Smeared Joker", pos = {x=4,y=6}, set = "Joker", effect = "", config = {}, unlock_condition = {type = 'modify_deck', extra = {count = 3, enhancement = 'Wild Card', e_key = 'm_wild'}}},
        j_throwback=        {order = 114,  unlocked = false, discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 2, cost = 6, name = "Throwback", pos = {x=5,y=7}, set = "Joker", effect = "", config = {extra = 0.25}, unlock_condition = {type = 'continue_game'}},        
        j_hanging_chad=     {order = 115,  unlocked = false, discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 1, cost = 4, name = "Hanging Chad", pos = {x=9,y=6}, set = "Joker", effect = "", config = {extra = 2}, unlock_condition = {type = 'round_win', extra = 'High Card'}},
        j_rough_gem=        {order = 116,  unlocked = false, discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 2, cost = 7, name = "Rough Gem", pos = {x=9,y=7}, set = "Joker", effect = "", config = {extra = 1}, unlock_condition = {type = 'modify_deck', extra = {count = 30, suit = 'Diamonds'}}},
        j_bloodstone=       {order = 117,  unlocked = false, discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 2, cost = 7, name = "Bloodstone", pos = {x=0,y=8}, set = "Joker", effect = "", config = {extra = {odds = 2, Xmult = 1.5}}, unlock_condition = {type = 'modify_deck', extra = {count = 30, suit = 'Hearts'}}},
        j_arrowhead=        {order = 118,  unlocked = false, discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 2, cost = 7, name = "Arrowhead", pos = {x=1,y=8}, set = "Joker", effect = "", config = {extra = 50}, unlock_condition = {type = 'modify_deck', extra = {count = 30, suit = 'Spades'}}},
        j_onyx_agate=       {order = 119,  unlocked = false, discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 2, cost = 7, name = "Onyx Agate", pos = {x=2,y=8}, set = "Joker", effect = "", config = {extra = 7}, unlock_condition = {type = 'modify_deck', extra = {count = 30, suit = 'Clubs'}}},
        j_glass=            {order = 120,  unlocked = false, discovered = false, blueprint_compat = true, perishable_compat = false, eternal_compat = true, rarity = 2, cost = 6, name = "Glass Joker", pos = {x=1,y=3}, set = "Joker", effect = "Glass Card", cost_mult = 1.0, config = {extra = 0.75, Xmult = 1}, unlock_condition = {type = 'modify_deck', extra = {count = 5, enhancement = 'Glass Card', e_key = 'm_glass'}}, enhancement_gate = 'm_glass'},

        j_ring_master=      {order = 121,  unlocked = false, discovered = false, blueprint_compat = false, perishable_compat = true, eternal_compat = true, rarity = 2, cost = 5, name = "Showman", pos = {x=6,y=5}, set = "Joker", effect = "", config = {}, unlock_condition = {type = 'ante_up', ante = 4}},
        j_flower_pot=       {order = 122,  unlocked = false, discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 2, cost = 6, name = "Flower Pot", pos = {x=0,y=6}, set = "Joker", effect = "", config = {extra = 3}, unlock_condition = {type = 'ante_up', ante = 8}},
        j_blueprint=        {order = 123,  unlocked = false, discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 3, cost = 10,name = "Blueprint", pos = {x=0,y=3}, set = "Joker", effect = "Copycat", cost_mult = 1.0, config = {},unlock_condition = {type = 'win_custom'}},
        j_wee=              {order = 124,  unlocked = false, discovered = false, blueprint_compat = true, perishable_compat = false, eternal_compat = true, rarity = 3, cost = 8, name = "Wee Joker", pos = {x=0,y=0}, set = "Joker", effect = "", config = {extra = {chips = 0, chip_mod = 8}}, unlock_condition = {type = 'win', n_rounds = 18}},
        j_merry_andy=       {order = 125,  unlocked = false, discovered = false, blueprint_compat = false, perishable_compat = true, eternal_compat = true, rarity = 2, cost = 7, name = "Merry Andy", pos = {x=8,y=0}, set = "Joker", effect = "", cost_mult = 1.0, config = {d_size = 3, h_size = -1}, unlock_condition = {type = 'win', n_rounds = 12}},
        j_oops=             {order = 126,  unlocked = false, discovered = false, blueprint_compat = false, perishable_compat = true, eternal_compat = true, rarity = 2, cost = 4, name = "Oops! All 6s", pos = {x=5,y=6}, set = "Joker", effect = "", config = {}, unlock_condition = {type = 'chip_score', chips = 10000}},
        j_idol=             {order = 127,  unlocked = false, discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 2, cost = 6, name = "The Idol", pos = {x=6,y=7}, set = "Joker", effect = "", config = {extra = 2}, unlock_condition = {type = 'chip_score', chips = 1000000}},
        j_seeing_double=    {order = 128,  unlocked = false, discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 2, cost = 6, name = "Seeing Double", pos = {x=4,y=4}, set = "Joker", effect = "X1.5 Mult club 7", cost_mult = 1.0, config = {extra = 2},unlock_condition = {type = 'hand_contents', extra = 'four 7 of Clubs'}},
        j_matador=          {order = 129,  unlocked = false, discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 2, cost = 7, name = "Matador", pos = {x=4,y=5}, set = "Joker", effect = "", config = {extra = 8}, unlock_condition = {type = 'round_win'}},
        j_hit_the_road=     {order = 130,  unlocked = false, discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 3, cost = 8, name = "Hit the Road", pos = {x=8,y=5}, set = "Joker", effect = "Jack Discard Effect", cost_mult = 1.0, config = {extra = 0.5}, unlock_condition = {type = 'discard_custom'}},
        j_duo=              {order = 131,  unlocked = false, discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 3, cost = 8, name = "The Duo", pos = {x=5,y=4}, set = "Joker", effect = "X1.5 Mult", cost_mult = 1.0, config = {Xmult = 2, type = 'Pair'}, unlock_condition = {type = 'win_no_hand', extra = 'Pair'}},
        j_trio=             {order = 132,  unlocked = false, discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 3, cost = 8, name = "The Trio", pos = {x=6,y=4}, set = "Joker", effect = "X2 Mult", cost_mult = 1.0, config = {Xmult = 3, type = 'Three of a Kind'}, unlock_condition = {type = 'win_no_hand', extra = 'Three of a Kind'}},
        j_family=           {order = 133,  unlocked = false, discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 3, cost = 8, name = "The Family", pos = {x=7,y=4}, set = "Joker", effect = "X3 Mult", cost_mult = 1.0, config = {Xmult = 4, type = 'Four of a Kind'}, unlock_condition = {type = 'win_no_hand', extra = 'Four of a Kind'}},
        j_order=            {order = 134,  unlocked = false, discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 3, cost = 8, name = "The Order", pos = {x=8,y=4}, set = "Joker", effect = "X3 Mult", cost_mult = 1.0, config = {Xmult = 3, type = 'Straight'}, unlock_condition = {type = 'win_no_hand', extra = 'Straight'}},
        j_tribe=            {order = 135,  unlocked = false, discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 3, cost = 8, name = "The Tribe", pos = {x=9,y=4}, set = "Joker", effect = "X3 Mult", cost_mult = 1.0, config = {Xmult = 2, type = 'Flush'}, unlock_condition = {type = 'win_no_hand', extra = 'Flush'}},
        
        j_stuntman=         {order = 136,  unlocked = false, discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 3, cost = 7, name = "Stuntman", pos = {x=8,y=6}, set = "Joker", effect = "", config = {extra = {h_size = 2, chip_mod = 250}}, unlock_condition = {type = 'chip_score', chips = 100000000}},
        j_invisible=        {order = 137,  unlocked = false, discovered = false, blueprint_compat = false, perishable_compat = true, eternal_compat = false, rarity = 3, cost = 8, name = "Invisible Joker", pos = {x=1,y=7}, set = "Joker", effect = "", config = {extra = 2}, unlock_condition = {type = 'win_custom'}},
        j_brainstorm=       {order = 138,  unlocked = false, discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 3, cost = 10, name = "Brainstorm", pos = {x=7,y=7}, set = "Joker", effect = "Copycat", config = {}, unlock_condition = {type = 'discard_custom'}},
        j_satellite=        {order = 139,  unlocked = false, discovered = false, blueprint_compat = false, perishable_compat = true, eternal_compat = true, rarity = 2, cost = 6, name = "Satellite", pos = {x=8,y=7}, set = "Joker", effect = "", config = {extra = 1}, unlock_condition = {type = 'money', extra = 400}},
        j_shoot_the_moon=   {order = 140,  unlocked = false, discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 1, cost = 5, name = "Shoot the Moon", pos = {x=2,y=6}, set = "Joker", effect = "", config = {extra = 13}, unlock_condition = {type = 'play_all_hearts'}},
        j_drivers_license=  {order = 141,  unlocked = false, discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 3, cost = 7, name = "Driver's License", pos = {x=0,y=7}, set = "Joker", effect = "", config = {extra = 3}, unlock_condition = {type = 'modify_deck', extra = {count = 16, tally = 'total'}}},
        j_cartomancer=      {order = 142,  unlocked = false, discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 2, cost = 6, name = "Cartomancer", pos = {x=7,y=3}, set = "Joker", effect = "Tarot Buff", cost_mult = 1.0, config = {}, unlock_condition = {type = 'discover_amount', tarot_count = 22}},
        j_astronomer=       {order = 143,  unlocked = false, discovered = false, blueprint_compat = false, perishable_compat = true, eternal_compat = true, rarity = 2, cost = 8, name = "Astronomer", pos = {x=2,y=7}, set = "Joker", effect = "", config = {}, unlock_condition = {type = 'discover_amount', planet_count = 12}},
        j_burnt=            {order = 144,  unlocked = false, discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 3, cost = 8, name = "Burnt Joker", pos = {x=3,y=7}, set = "Joker", effect = "", config = {h_size = 0, extra = 4}, unlock_condition = {type = 'c_cards_sold', extra = 50}},
        j_bootstraps=       {order = 145,  unlocked = false, discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 2, cost = 7, name = "Bootstraps", pos = {x=9,y=8}, set = "Joker", effect = "", config = {extra = {mult = 2, dollars = 5}}, unlock_condition = {type = 'modify_jokers', extra = {polychrome = true, count = 2}}},
        j_caino=            {order = 146,  unlocked = false, discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 4, cost = 20, name = "Caino", pos = {x=3,y=8}, soul_pos = {x=3, y=9}, set = "Joker", effect = "", config = {extra = 1}, unlock_condition = {type = '', extra = '', hidden = true}},
        j_triboulet=        {order = 147,  unlocked = false, discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 4, cost = 20, name = "Triboulet", pos = {x=4,y=8}, soul_pos = {x=4, y=9}, set = "Joker", effect = "", config = {extra = 2}, unlock_condition = {type = '', extra = '', hidden = true}},
        j_yorick=           {order = 148,  unlocked = false, discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 4, cost = 20, name = "Yorick", pos = {x=5,y=8}, soul_pos = {x=5, y=9}, set = "Joker", effect = "", config = {extra = {xmult = 1, discards = 23}}, unlock_condition = {type = '', extra = '', hidden = true}},
        j_chicot=           {order = 149,  unlocked = false, discovered = false, blueprint_compat = false, perishable_compat = true, eternal_compat = true, rarity = 4, cost = 20, name = "Chicot", pos = {x=6,y=8}, soul_pos = {x=6, y=9}, set = "Joker", effect = "", config = {}, unlock_condition = {type = '', extra = '', hidden = true}},
        j_perkeo=           {order = 150,  unlocked = false, discovered = false, blueprint_compat = true, perishable_compat = true, eternal_compat = true, rarity = 4, cost = 20, name = "Perkeo", pos = {x=7,y=8}, soul_pos = {x=7, y=9}, set = "Joker", effect = "", config = {}, unlock_condition = {type = '', extra = '', hidden = true}},



        --All Consumeables

        --Tarots
        c_fool=             {order = 1,     discovered = false, cost = 3, consumeable = true, name = "The Fool", pos = {x=0,y=0}, set = "Tarot", effect = "Disable Blind Effect", cost_mult = 1.0, config = {}},
        c_magician=         {order = 2,     discovered = false, cost = 3, consumeable = true, name = "The Magician", pos = {x=1,y=0}, set = "Tarot", effect = "Enhance", cost_mult = 1.0, config = {mod_conv = 'm_lucky', max_highlighted = 2}},
        c_high_priestess=   {order = 3,     discovered = false, cost = 3, consumeable = true, name = "The High Priestess", pos = {x=2,y=0}, set = "Tarot", effect = "Round Bonus", cost_mult = 1.0, config = {planets = 2}},
        c_empress=          {order = 4,     discovered = false, cost = 3, consumeable = true, name = "The Empress", pos = {x=3,y=0}, set = "Tarot", effect = "Enhance", cost_mult = 1.0, config = {mod_conv = 'm_mult', max_highlighted = 2}},
        c_emperor=          {order = 5,     discovered = false, cost = 3, consumeable = true, name = "The Emperor", pos = {x=4,y=0}, set = "Tarot", effect = "Round Bonus", cost_mult = 1.0, config = {tarots = 2}},
        c_heirophant=       {order = 6,     discovered = false, cost = 3, consumeable = true, name = "The Hierophant", pos = {x=5,y=0}, set = "Tarot", effect = "Enhance", cost_mult = 1.0, config = {mod_conv = 'm_bonus', max_highlighted = 2}},
        c_lovers=           {order = 7,     discovered = false, cost = 3, consumeable = true, name = "The Lovers", pos = {x=6,y=0}, set = "Tarot", effect = "Enhance", cost_mult = 1.0, config = {mod_conv = 'm_wild', max_highlighted = 1}},
        c_chariot=          {order = 8,     discovered = false, cost = 3, consumeable = true, name = "The Chariot", pos = {x=7,y=0}, set = "Tarot", effect = "Enhance", cost_mult = 1.0, config = {mod_conv = 'm_steel', max_highlighted = 1}},
        c_justice=          {order = 9,     discovered = false, cost = 3, consumeable = true, name = "Justice", pos = {x=8,y=0}, set = "Tarot", effect = "Enhance", cost_mult = 1.0, config = {mod_conv = 'm_glass', max_highlighted = 1}},
        c_hermit=           {order = 10,    discovered = false, cost = 3, consumeable = true, name = "The Hermit", pos = {x=9,y=0}, set = "Tarot", effect = "Dollar Doubler", cost_mult = 1.0, config = {extra = 20}},
        c_wheel_of_fortune= {order = 11,    discovered = false, cost = 3, consumeable = true, name = "The Wheel of Fortune", pos = {x=0,y=1}, set = "Tarot", effect = "Round Bonus", cost_mult = 1.0, config = {extra = 4}},
        c_strength=         {order = 12,    discovered = false, cost = 3, consumeable = true, name = "Strength", pos = {x=1,y=1}, set = "Tarot", effect = "Round Bonus", cost_mult = 1.0, config = {mod_conv = 'up_rank', max_highlighted = 2}},
        c_hanged_man=       {order = 13,    discovered = false, cost = 3, consumeable = true, name = "The Hanged Man", pos = {x=2,y=1}, set = "Tarot", effect = "Card Removal", cost_mult = 1.0, config = {remove_card = true, max_highlighted = 2}},
        c_death=            {order = 14,    discovered = false, cost = 3, consumeable = true, name = "Death", pos = {x=3,y=1}, set = "Tarot", effect = "Card Conversion", cost_mult = 1.0, config = {mod_conv = 'card', max_highlighted = 2, min_highlighted = 2}},
        c_temperance=       {order = 15,    discovered = false, cost = 3, consumeable = true, name = "Temperance", pos = {x=4,y=1}, set = "Tarot", effect = "Joker Payout", cost_mult = 1.0, config = {extra = 50}},
        c_devil=            {order = 16,    discovered = false, cost = 3, consumeable = true, name = "The Devil", pos = {x=5,y=1}, set = "Tarot", effect = "Enhance", cost_mult = 1.0, config = {mod_conv = 'm_gold', max_highlighted = 1}},
        c_tower=            {order = 17,    discovered = false, cost = 3, consumeable = true, name = "The Tower", pos = {x=6,y=1}, set = "Tarot", effect = "Enhance", cost_mult = 1.0, config = {mod_conv = 'm_stone', max_highlighted = 1}},
        c_star=             {order = 18,    discovered = false, cost = 3, consumeable = true, name = "The Star", pos = {x=7,y=1}, set = "Tarot", effect = "Suit Conversion", cost_mult = 1.0, config = {suit_conv = 'Diamonds', max_highlighted = 3}},
        c_moon=             {order = 19,    discovered = false, cost = 3, consumeable = true, name = "The Moon", pos = {x=8,y=1}, set = "Tarot", effect = "Suit Conversion", cost_mult = 1.0, config = {suit_conv = 'Clubs', max_highlighted = 3}},
        c_sun=              {order = 20,    discovered = false, cost = 3, consumeable = true, name = "The Sun", pos = {x=9,y=1}, set = "Tarot", effect = "Suit Conversion", cost_mult = 1.0, config = {suit_conv = 'Hearts', max_highlighted = 3}},
        c_judgement=        {order = 21,    discovered = false, cost = 3, consumeable = true, name = "Judgement", pos = {x=0,y=2}, set = "Tarot", effect = "Random Joker", cost_mult = 1.0, config = {}},
        c_world=            {order = 22,    discovered = false, cost = 3, consumeable = true, name = "The World", pos = {x=1,y=2}, set = "Tarot", effect = "Suit Conversion", cost_mult = 1.0, config = {suit_conv = 'Spades', max_highlighted = 3}},

        --Planets
        c_mercury=          {order = 1,    discovered = false, cost = 3, consumeable = true, freq = 1, name = "Mercury", pos = {x=0,y=3}, set = "Planet", effect = "Hand Upgrade", cost_mult = 1.0, config = {hand_type = 'Pair'}},
        c_venus=            {order = 2,    discovered = false, cost = 3, consumeable = true, freq = 1, name = "Venus", pos = {x=1,y=3}, set = "Planet", effect = "Hand Upgrade", cost_mult = 1.0, config = {hand_type = 'Three of a Kind'}},
        c_earth=            {order = 3,    discovered = false, cost = 3, consumeable = true, freq = 1, name = "Earth", pos = {x=2,y=3}, set = "Planet", effect = "Hand Upgrade", cost_mult = 1.0, config = {hand_type = 'Full House'}},
        c_mars=             {order = 4,    discovered = false, cost = 3, consumeable = true, freq = 1, name = "Mars", pos = {x=3,y=3}, set = "Planet", effect = "Hand Upgrade", cost_mult = 1.0, config = {hand_type = 'Four of a Kind'}},
        c_jupiter=          {order = 5,    discovered = false, cost = 3, consumeable = true, freq = 1, name = "Jupiter", pos = {x=4,y=3}, set = "Planet", effect = "Hand Upgrade", cost_mult = 1.0, config = {hand_type = 'Flush'}},
        c_saturn=           {order = 6,    discovered = false, cost = 3, consumeable = true, freq = 1, name = "Saturn", pos = {x=5,y=3}, set = "Planet", effect = "Hand Upgrade", cost_mult = 1.0, config = {hand_type = 'Straight'}},
        c_uranus=           {order = 7,    discovered = false, cost = 3, consumeable = true, freq = 1, name = "Uranus", pos = {x=6,y=3}, set = "Planet", effect = "Hand Upgrade", cost_mult = 1.0, config = {hand_type = 'Two Pair'}},
        c_neptune=          {order = 8,    discovered = false, cost = 3, consumeable = true, freq = 1, name = "Neptune", pos = {x=7,y=3}, set = "Planet", effect = "Hand Upgrade", cost_mult = 1.0, config = {hand_type = 'Straight Flush'}},
        c_pluto=            {order = 9,    discovered = false, cost = 3, consumeable = true, freq = 1, name = "Pluto", pos = {x=8,y=3}, set = "Planet", effect = "Hand Upgrade", cost_mult = 1.0, config = {hand_type = 'High Card'}},
        c_planet_x=         {order = 10,   discovered = false, cost = 3, consumeable = true, freq = 1, name = "Planet X", pos = {x=9,y=2}, set = "Planet", effect = "Hand Upgrade", cost_mult = 1.0, config = {hand_type = 'Five of a Kind', softlock = true}},
        c_ceres=            {order = 11,   discovered = false, cost = 3, consumeable = true, freq = 1, name = "Ceres", pos = {x=8,y=2}, set = "Planet", effect = "Hand Upgrade", cost_mult = 1.0, config = {hand_type = 'Flush House', softlock = true}},
        c_eris=             {order = 12,   discovered = false, cost = 3, consumeable = true, freq = 1, name = "Eris", pos = {x=3,y=2}, set = "Planet", effect = "Hand Upgrade", cost_mult = 1.0, config = {hand_type = 'Flush Five', softlock = true}},

        --Spectral
        c_familiar=         {order = 1,    discovered = false, cost = 4, consumeable = true, name = "Familiar", pos = {x=0,y=4}, set = "Spectral", config = {remove_card = true, extra = 3}},
        c_grim=             {order = 2,    discovered = false, cost = 4, consumeable = true, name = "Grim",     pos = {x=1,y=4}, set = "Spectral", config = {remove_card = true, extra = 2}},
        c_incantation=      {order = 3,    discovered = false, cost = 4, consumeable = true, name = "Incantation", pos = {x=2,y=4}, set = "Spectral", config = {remove_card = true, extra = 4}},
        c_talisman=         {order = 4,    discovered = false, cost = 4, consumeable = true, name = "Talisman", pos = {x=3,y=4}, set = "Spectral", config = {extra = 'Gold', max_highlighted = 1}},
        c_aura=             {order = 5,    discovered = false, cost = 4, consumeable = true, name = "Aura", pos = {x=4,y=4}, set = "Spectral", config = {}},
        c_wraith=           {order = 6,    discovered = false, cost = 4, consumeable = true, name = "Wraith", pos = {x=5,y=4}, set = "Spectral", config = {}},
        c_sigil=            {order = 7,    discovered = false, cost = 4, consumeable = true, name = "Sigil", pos = {x=6,y=4}, set = "Spectral", config = {}},
        c_ouija=            {order = 8,    discovered = false, cost = 4, consumeable = true, name = "Ouija", pos = {x=7,y=4}, set = "Spectral", config = {}},
        c_ectoplasm=        {order = 9,    discovered = false, cost = 4, consumeable = true, name = "Ectoplasm", pos = {x=8,y=4}, set = "Spectral", config = {}},
        c_immolate=         {order = 10,   discovered = false, cost = 4, consumeable = true, name = "Immolate", pos = {x=9,y=4}, set = "Spectral", config = {remove_card = true, extra = {destroy = 5, dollars = 20}}},
        c_ankh=             {order = 11,   discovered = false, cost = 4, consumeable = true, name = "Ankh", pos = {x=0,y=5}, set = "Spectral", config = {extra = 2}},
        c_deja_vu=          {order = 12,   discovered = false, cost = 4, consumeable = true, name = "Deja Vu", pos = {x=1,y=5}, set = "Spectral", config = {extra = 'Red', max_highlighted = 1}},
        c_hex=              {order = 13,   discovered = false, cost = 4, consumeable = true, name = "Hex", pos = {x=2,y=5}, set = "Spectral", config = {extra = 2}},
        c_trance=           {order = 14,   discovered = false, cost = 4, consumeable = true, name = "Trance", pos = {x=3,y=5}, set = "Spectral", config = {extra = 'Blue', max_highlighted = 1}},
        c_medium=           {order = 15,   discovered = false, cost = 4, consumeable = true, name = "Medium", pos = {x=4,y=5}, set = "Spectral", config = {extra = 'Purple', max_highlighted = 1}},
        c_cryptid=          {order = 16,   discovered = false, cost = 4, consumeable = true, name = "Cryptid", pos = {x=5,y=5}, set = "Spectral", config = {extra = 2, max_highlighted = 1}},
        c_soul=             {order = 17,   discovered = false, cost = 4, consumeable = true, name = "The Soul", pos = {x=2,y=2}, set = "Spectral", effect = "Unlocker", config = {}, hidden = true},
        c_black_hole=       {order = 18,   discovered = false, cost = 4, consumeable = true, name = "Black Hole", pos = {x=9,y=3}, set = "Spectral", config = {}, hidden = true},

        --Vouchers

        v_overstock_norm =  {order = 1,     discovered = false, unlocked = true , available = true, cost = 10, name = "Overstock", pos = {x=0,y=0}, set = "Voucher", config = {}},
        v_clearance_sale=   {order = 3,     discovered = false, unlocked = true , available = true, cost = 10, name = "Clearance Sale", pos = {x=3,y=0}, set = "Voucher", config = {extra = 25}},
        v_hone=             {order = 5,     discovered = false, unlocked = true , available = true, cost = 10, name = "Hone", pos = {x=4,y=0}, set = "Voucher", config = {extra = 2}},
        v_reroll_surplus=   {order = 7,    discovered = false, unlocked = true , available = true, cost = 10, name = "Reroll Surplus", pos = {x=0,y=2}, set = "Voucher", config = {extra = 2}},
        v_crystal_ball=     {order = 9,    discovered = false, unlocked = true , available = true, cost = 10, name = "Crystal Ball", pos = {x=2,y=2}, set = "Voucher", config = {extra = 3}},
        v_telescope=        {order = 11,    discovered = false, unlocked = true , available = true, cost = 10, name = "Telescope", pos = {x=3,y=2}, set = "Voucher", config = {extra = 3}},
        v_grabber=          {order = 13,    discovered = false, unlocked = true , available = true, cost = 10, name = "Grabber", pos = {x=5,y=0}, set = "Voucher", config = {extra = 1}},
        v_wasteful=         {order = 15,    discovered = false, unlocked = true , available = true, cost = 10, name = "Wasteful", pos = {x=6,y=0}, set = "Voucher", config = {extra = 1}},
        v_tarot_merchant=   {order = 17,     discovered = false, unlocked = true , available = true, cost = 10, name = "Tarot Merchant", pos = {x=1,y=0}, set = "Voucher", config = {extra = 9.6/4, extra_disp = 2}},
        v_planet_merchant=  {order = 19,     discovered = false, unlocked = true , available = true, cost = 10, name = "Planet Merchant", pos = {x=2,y=0}, set = "Voucher", config = {extra = 9.6/4, extra_disp = 2}},
        v_seed_money=       {order = 21,    discovered = false, unlocked = true , available = true, cost = 10, name = "Seed Money", pos = {x=1,y=2}, set = "Voucher", config = {extra = 50}},
        v_blank=            {order = 23,    discovered = false, unlocked = true , available = true, cost = 10, name = "Blank", pos = {x=7,y=0}, set = "Voucher", config = {extra = 5}},
        v_magic_trick=      {order = 25,    discovered = false, unlocked = true , available = true, cost = 10, name = "Magic Trick", pos = {x=4,y=2}, set = "Voucher", config = {extra = 4}},
        v_hieroglyph=       {order = 27,    discovered = false, unlocked = true , available = true, cost = 10, name = "Hieroglyph", pos = {x=5,y=2}, set = "Voucher", config = {extra = 1}},
        v_directors_cut=    {order = 29,    discovered = false, unlocked = true , available = true, cost = 10, name = "Director's Cut", pos = {x=6,y=2}, set = "Voucher", config = {extra = 10}},
        v_paint_brush=      {order = 31,    discovered = false, unlocked = true , available = true, cost = 10, name = "Paint Brush", pos = {x=7,y=2}, set = "Voucher", config = {extra = 1}},
  
        v_overstock_plus=   {order = 2,     discovered = false, unlocked = false, available = true, cost = 10, name = "Overstock Plus", pos = {x=0,y=1}, set = "Voucher", config = {}, requires = {'v_overstock_norm'},unlock_condition = {type = 'c_shop_dollars_spent', extra = 2500}},
        v_liquidation=      {order = 4,     discovered = false, unlocked = false, available = true, cost = 10, name = "Liquidation", pos = {x=3,y=1}, set = "Voucher", config = {extra = 50}, requires = {'v_clearance_sale'},unlock_condition = {type = 'run_redeem', extra = 10}},
        v_glow_up=          {order = 6,    discovered = false, unlocked = false, available = true,  cost = 10, name = "Glow Up", pos = {x=4,y=1}, set = "Voucher", config = {extra = 4}, requires = {'v_hone'},unlock_condition = {type = 'have_edition', extra = 5}},
        v_reroll_glut=      {order = 8,    discovered = false, unlocked = false, available = true,  cost = 10, name = "Reroll Glut", pos = {x=0,y=3}, set = "Voucher", config = {extra = 2}, requires = {'v_reroll_surplus'},unlock_condition = {type = 'c_shop_rerolls', extra = 100}},
        v_omen_globe=       {order = 10,    discovered = false, unlocked = false, available = true, cost = 10, name = "Omen Globe", pos = {x=2,y=3}, set = "Voucher", config = {extra = 4}, requires = {'v_crystal_ball'},unlock_condition = {type = 'c_tarot_reading_used', extra = 25}},
        v_observatory=      {order = 12,    discovered = false, unlocked = false, available = true, cost = 10, name = "Observatory", pos = {x=3,y=3}, set = "Voucher", config = {extra = 1.5}, requires = {'v_telescope'},unlock_condition = {type = 'c_planetarium_used', extra = 25}},
        v_nacho_tong=       {order = 14,    discovered = false, unlocked = false, available = true, cost = 10, name = "Nacho Tong", pos = {x=5,y=1}, set = "Voucher", config = {extra = 1}, requires = {'v_grabber'},unlock_condition = {type = 'c_cards_played', extra = 2500}},
        v_recyclomancy=     {order = 16,    discovered = false, unlocked = false, available = true, cost = 10, name = "Recyclomancy", pos = {x=6,y=1}, set = "Voucher", config = {extra = 1}, requires = {'v_wasteful'},unlock_condition = {type = 'c_cards_discarded', extra = 2500}},
        v_tarot_tycoon=     {order = 18,     discovered = false, unlocked = false, available = true,cost = 10, name = "Tarot Tycoon", pos = {x=1,y=1}, set = "Voucher", config = {extra = 32/4, extra_disp = 4}, requires = {'v_tarot_merchant'},unlock_condition = {type = 'c_tarots_bought', extra = 50}},
        v_planet_tycoon=    {order = 20,     discovered = false, unlocked = false, available = true,cost = 10, name = "Planet Tycoon", pos = {x=2,y=1}, set = "Voucher", config = {extra = 32/4, extra_disp = 4}, requires = {'v_planet_merchant'},unlock_condition = {type = 'c_planets_bought', extra = 50}},
        v_money_tree=       {order = 22,    discovered = false, unlocked = false, available = true, cost = 10, name = "Money Tree", pos = {x=1,y=3}, set = "Voucher", config = {extra = 100}, requires = {'v_seed_money'},unlock_condition = {type = 'interest_streak', extra = 10}},
        v_antimatter=       {order = 24,    discovered = false, unlocked = false, available = true, cost = 10, name = "Antimatter", pos = {x=7,y=1}, set = "Voucher", config = {extra = 15}, requires = {'v_blank'},unlock_condition = {type = 'blank_redeems', extra = 10}},
        v_illusion=         {order = 26,    discovered = false, unlocked = false, available = true, cost = 10, name = "Illusion", pos = {x=4,y=3}, set = "Voucher", config = {extra = 4}, requires = {'v_magic_trick'},unlock_condition = {type = 'c_playing_cards_bought', extra = 20}},
        v_petroglyph=       {order = 28,    discovered = false, unlocked = false, available = true, cost = 10, name = "Petroglyph", pos = {x=5,y=3}, set = "Voucher", config = {extra = 1}, requires = {'v_hieroglyph'},unlock_condition = {type = 'ante_up', ante = 12, extra = 12}},
        v_retcon=           {order = 30,    discovered = false, unlocked = false, available = true, cost = 10, name = "Retcon", pos = {x=6,y=3}, set = "Voucher", config = {extra = 10}, requires = {'v_directors_cut'},unlock_condition = {type = 'blind_discoveries', extra = 25}},
        v_palette=          {order = 32,    discovered = false, unlocked = false, available = true, cost = 10, name = "Palette", pos = {x=7,y=3}, set = "Voucher", config = {extra = 1}, requires = {'v_paint_brush'},unlock_condition = {type = 'min_hand_size', extra = 5}},

        --Backs

        b_red=              {name = "Red Deck",         stake = 1, unlocked = true,order = 1, pos =   {x=0,y=0}, set = "Back", config = {discards = 1}, discovered = true},
        b_blue=             {name = "Blue Deck",        stake = 1, unlocked = false,order = 2, pos =  {x=0,y=2}, set = "Back", config = {hands = 1}, unlock_condition = {type = 'discover_amount', amount = 20}},
        b_yellow=           {name = "Yellow Deck",      stake = 1, unlocked = false,order = 3, pos =  {x=1,y=2}, set = "Back", config = {dollars = 10}, unlock_condition = {type = 'discover_amount', amount = 50}},
        b_green=            {name = "Green Deck",       stake = 1, unlocked = false,order = 4, pos =  {x=2,y=2}, set = "Back", config = {extra_hand_bonus = 2, extra_discard_bonus = 1, no_interest = true}, unlock_condition = {type = 'discover_amount', amount = 75}},
        b_black=            {name = "Black Deck",       stake = 1, unlocked = false,order = 5, pos =  {x=3,y=2}, set = "Back", config = {hands = -1, joker_slot = 1}, unlock_condition = {type = 'discover_amount', amount = 100}},
        b_magic=            {name = "Magic Deck",       stake = 1, unlocked = false,order = 6, pos =  {x=0,y=3}, set = "Back", config = {voucher = 'v_crystal_ball', consumables = {'c_fool', 'c_fool'}}, unlock_condition = {type = 'win_deck', deck = 'b_red'}},
        b_nebula=           {name = "Nebula Deck",      stake = 1, unlocked = false,order = 7, pos =  {x=3,y=0}, set = "Back", config = {voucher = 'v_telescope', consumable_slot = -1}, unlock_condition = {type = 'win_deck', deck = 'b_blue'}},
        b_ghost=            {name = "Ghost Deck",       stake = 1, unlocked = false,order = 8, pos =  {x=6,y=2}, set = "Back", config = {spectral_rate = 2, consumables = {'c_hex'}}, unlock_condition = {type = 'win_deck', deck = 'b_yellow'}},
        b_abandoned=        {name = "Abandoned Deck",   stake = 1, unlocked = false,order = 9, pos =  {x=3,y=3}, set = "Back", config = {remove_faces = true}, unlock_condition = {type = 'win_deck', deck = 'b_green'}},
        b_checkered=        {name = "Checkered Deck",   stake = 1, unlocked = false,order = 10,pos =  {x=1,y=3}, set = "Back", config = {}, unlock_condition = {type = 'win_deck', deck = 'b_black'}},
        b_zodiac=           {name = "Zodiac Deck",      stake = 1, unlocked = false,order = 11, pos = {x=3,y=4}, set = "Back", config = {vouchers = {'v_tarot_merchant','v_planet_merchant', 'v_overstock_norm'}}, unlock_condition = {type = 'win_stake', stake = 2}},
        b_painted=          {name = "Painted Deck",     stake = 1, unlocked = false,order = 12, pos = {x=4,y=3}, set = "Back", config = {hand_size = 2, joker_slot = -1}, unlock_condition = {type = 'win_stake', stake=3}},
        b_anaglyph=         {name = "Anaglyph Deck",    stake = 1, unlocked = false,order = 13, pos = {x=2,y=4}, set = "Back", config = {}, unlock_condition = {type = 'win_stake', stake = 4}},
        b_plasma=           {name = "Plasma Deck",      stake = 1, unlocked = false,order = 14, pos = {x=4,y=2}, set = "Back", config = {ante_scaling = 2}, unlock_condition = {type = 'win_stake', stake=5}},
        b_erratic=          {name = "Erratic Deck",     stake = 1, unlocked = false,order = 15, pos = {x=2,y=3}, set = "Back", config = {randomize_rank_suit = true}, unlock_condition = {type = 'win_stake', stake=7}},
    
        b_challenge=        {name = "Challenge Deck",   stake = 1, unlocked = true,order = 16, pos = {x=0,y=4}, set = "Back", config = {}, omit = true}, 

        
        --All enhanced card types here
        m_bonus =   {max = 500, order = 2, name = "Bonus", set = "Enhanced", pos = {x=1,y=1}, effect = "Bonus Card", label = "Bonus Card", config = {bonus=30}},
        m_mult =    {max = 500, order = 3, name = "Mult", set = "Enhanced", pos = {x=2,y=1}, effect = "Mult Card", label = "Mult Card", config = {mult = 4}},
        m_wild =    {max = 500, order = 4, name = "Wild Card", set = "Enhanced", pos = {x=3,y=1}, effect = "Wild Card", label = "Wild Card", config = {}},
        m_glass =   {max = 500, order = 5, name = "Glass Card", set = "Enhanced", pos = {x=5,y=1}, effect = "Glass Card", label = "Glass Card", config = {Xmult = 2, extra = 4}},
        m_steel =   {max = 500, order = 6, name = "Steel Card", set = "Enhanced", pos = {x=6,y=1}, effect = "Steel Card", label = "Steel Card", config = {h_x_mult = 1.5}},
        m_stone =   {max = 500, order = 7, name = "Stone Card", set = "Enhanced", pos = {x=5,y=0}, effect = "Stone Card", label = "Stone Card", config = {bonus = 50}},
        m_gold =    {max = 500, order = 8, name = "Gold Card", set = "Enhanced", pos = {x=6,y=0}, effect = "Gold Card", label = "Gold Card", config = {h_dollars = 3}},
        m_lucky =   {max = 500, order = 9, name = "Lucky Card", set = "Enhanced", pos = {x=4,y=1}, effect = "Lucky Card", label = "Lucky Card", config = {mult=20, p_dollars = 20}},

        --editions
        e_base =       {order = 1,  unlocked = true, discovered = false, name = "Base", pos = {x=0,y=0}, atlas = 'Joker', set = "Edition", config = {}},
        e_foil =       {order = 2,  unlocked = true, discovered = false, name = "Foil", pos = {x=0,y=0}, atlas = 'Joker', set = "Edition", config = {extra = 50}},
        e_holo =       {order = 3,  unlocked = true, discovered = false, name = "Holographic", pos = {x=0,y=0}, atlas = 'Joker', set = "Edition", config = {extra = 10}},
        e_polychrome = {order = 4,  unlocked = true, discovered = false, name = "Polychrome", pos = {x=0,y=0}, atlas = 'Joker', set = "Edition", config = {extra = 1.5}},
        e_negative =   {order = 5,  unlocked = true, discovered = false, name = "Negative", pos = {x=0,y=0}, atlas = 'Joker', set = "Edition", config = {extra = 1}},

        --booster packs
        p_arcana_normal_1 =         {order = 1,  discovered = false, name = "Arcana Pack", weight = 1, kind = 'Arcana', cost = 4, pos = {x=0,y=0}, atlas = 'Booster', set = 'Booster', config = {extra = 3, choose = 1}},
        p_arcana_normal_2 =         {order = 2,  discovered = false, name = "Arcana Pack", weight = 1, kind = 'Arcana', cost = 4, pos = {x=1,y=0}, atlas = 'Booster', set = 'Booster', config = {extra = 3, choose = 1}},
        p_arcana_normal_3 =         {order = 3,  discovered = false, name = "Arcana Pack", weight = 1, kind = 'Arcana', cost = 4, pos = {x=2,y=0}, atlas = 'Booster', set = 'Booster', config = {extra = 3, choose = 1}},
        p_arcana_normal_4 =         {order = 4,  discovered = false, name = "Arcana Pack", weight = 1, kind = 'Arcana', cost = 4, pos = {x=3,y=0}, atlas = 'Booster', set = 'Booster', config = {extra = 3, choose = 1}},
        p_arcana_jumbo_1 =          {order = 5,  discovered = false, name = "Jumbo Arcana Pack", weight = 1, kind = 'Arcana', cost = 6, pos = {x=0,y=2}, atlas = 'Booster', set = 'Booster', config = {extra = 5, choose = 1}},
        p_arcana_jumbo_2 =          {order = 6,  discovered = false, name = "Jumbo Arcana Pack", weight = 1, kind = 'Arcana', cost = 6, pos = {x=1,y=2}, atlas = 'Booster', set = 'Booster', config = {extra = 5, choose = 1}},
        p_arcana_mega_1 =           {order = 7,  discovered = false, name = "Mega Arcana Pack", weight = 0.25, kind = 'Arcana', cost = 8, pos = {x=2,y=2}, atlas = 'Booster', set = 'Booster', config = {extra = 5, choose = 2}},
        p_arcana_mega_2 =           {order = 8,  discovered = false, name = "Mega Arcana Pack", weight = 0.25, kind = 'Arcana', cost = 8, pos = {x=3,y=2}, atlas = 'Booster', set = 'Booster', config = {extra = 5, choose = 2}},
        p_celestial_normal_1 =      {order = 9,  discovered = false, name = "Celestial Pack", weight = 1, kind = 'Celestial', cost = 4, pos = {x=0,y=1}, atlas = 'Booster', set = 'Booster', config = {extra = 3, choose = 1}},
        p_celestial_normal_2 =      {order = 10, discovered = false, name = "Celestial Pack", weight = 1, kind = 'Celestial', cost = 4, pos = {x=1,y=1}, atlas = 'Booster', set = 'Booster', config = {extra = 3, choose = 1}},
        p_celestial_normal_3 =      {order = 11, discovered = false, name = "Celestial Pack", weight = 1, kind = 'Celestial', cost = 4, pos = {x=2,y=1}, atlas = 'Booster', set = 'Booster', config = {extra = 3, choose = 1}},
        p_celestial_normal_4 =      {order = 12, discovered = false, name = "Celestial Pack", weight = 1, kind = 'Celestial', cost = 4, pos = {x=3,y=1}, atlas = 'Booster', set = 'Booster', config = {extra = 3, choose = 1}},
        p_celestial_jumbo_1 =       {order = 13, discovered = false, name = "Jumbo Celestial Pack", weight = 1, kind = 'Celestial', cost = 6, pos = {x=0,y=3}, atlas = 'Booster', set = 'Booster', config = {extra = 5, choose = 1}},
        p_celestial_jumbo_2 =       {order = 14, discovered = false, name = "Jumbo Celestial Pack", weight = 1, kind = 'Celestial', cost = 6, pos = {x=1,y=3}, atlas = 'Booster', set = 'Booster', config = {extra = 5, choose = 1}},
        p_celestial_mega_1 =        {order = 15, discovered = false, name = "Mega Celestial Pack", weight = 0.25, kind = 'Celestial', cost = 8, pos = {x=2,y=3}, atlas = 'Booster', set = 'Booster', config = {extra = 5, choose = 2}},
        p_celestial_mega_2 =        {order = 16, discovered = false, name = "Mega Celestial Pack", weight = 0.25, kind = 'Celestial', cost = 8, pos = {x=3,y=3}, atlas = 'Booster', set = 'Booster', config = {extra = 5, choose = 2}},
        p_spectral_normal_1 =       {order = 29, discovered = false, name = "Spectral Pack", weight = 0.3, kind = 'Spectral', cost = 4, pos = {x=0,y=4}, atlas = 'Booster', set = 'Booster', config = {extra = 2, choose = 1}},
        p_spectral_normal_2 =       {order = 30, discovered = false, name = "Spectral Pack", weight = 0.3, kind = 'Spectral', cost = 4, pos = {x=1,y=4}, atlas = 'Booster', set = 'Booster', config = {extra = 2, choose = 1}},
        p_spectral_jumbo_1 =        {order = 31, discovered = false, name = "Jumbo Spectral Pack", weight = 0.3, kind = 'Spectral', cost = 6, pos = {x=2,y=4}, atlas = 'Booster', set = 'Booster', config = {extra = 4, choose = 1}},
        p_spectral_mega_1 =         {order = 32, discovered = false, name = "Mega Spectral Pack", weight = 0.07, kind = 'Spectral', cost = 8, pos = {x=3,y=4}, atlas = 'Booster', set = 'Booster', config = {extra = 4, choose = 2}},
        p_standard_normal_1 =       {order = 17, discovered = false, name = "Standard Pack", weight = 1, kind = 'Standard', cost = 4, pos = {x=0,y=6}, atlas = 'Booster', set = 'Booster', config = {extra = 3, choose = 1}},
        p_standard_normal_2 =       {order = 18, discovered = false, name = "Standard Pack", weight = 1, kind = 'Standard', cost = 4, pos = {x=1,y=6}, atlas = 'Booster', set = 'Booster', config = {extra = 3, choose = 1}},
        p_standard_normal_3 =       {order = 19, discovered = false, name = "Standard Pack", weight = 1, kind = 'Standard', cost = 4, pos = {x=2,y=6}, atlas = 'Booster', set = 'Booster', config = {extra = 3, choose = 1}},
        p_standard_normal_4 =       {order = 20, discovered = false, name = "Standard Pack", weight = 1, kind = 'Standard', cost = 4, pos = {x=3,y=6}, atlas = 'Booster', set = 'Booster', config = {extra = 3, choose = 1}},
        p_standard_jumbo_1 =        {order = 21, discovered = false, name = "Jumbo Standard Pack", weight = 1, kind = 'Standard', cost = 6, pos = {x=0,y=7}, atlas = 'Booster', set = 'Booster', config = {extra = 5, choose = 1}},
        p_standard_jumbo_2 =        {order = 22, discovered = false, name = "Jumbo Standard Pack", weight = 1, kind = 'Standard', cost = 6, pos = {x=1,y=7}, atlas = 'Booster', set = 'Booster', config = {extra = 5, choose = 1}},
        p_standard_mega_1 =         {order = 23, discovered = false, name = "Mega Standard Pack", weight = 0.25, kind = 'Standard', cost = 8, pos = {x=2,y=7}, atlas = 'Booster', set = 'Booster', config = {extra = 5, choose = 2}},
        p_standard_mega_2 =         {order = 24, discovered = false, name = "Mega Standard Pack", weight = 0.25, kind = 'Standard', cost = 8, pos = {x=3,y=7}, atlas = 'Booster', set = 'Booster', config = {extra = 5, choose = 2}},
        p_buffoon_normal_1 =        {order = 25, discovered = false, name = "Buffoon Pack", weight = 0.6, kind = 'Buffoon', cost = 4, pos = {x=0,y=8}, atlas = 'Booster', set = 'Booster', config = {extra = 2, choose = 1}},
        p_buffoon_normal_2 =        {order = 26, discovered = false, name = "Buffoon Pack", weight = 0.6, kind = 'Buffoon', cost = 4, pos = {x=1,y=8}, atlas = 'Booster', set = 'Booster', config = {extra = 2, choose = 1}},
        p_buffoon_jumbo_1 =         {order = 27, discovered = false, name = "Jumbo Buffoon Pack", weight = 0.6, kind = 'Buffoon', cost = 6, pos = {x=2,y=8}, atlas = 'Booster', set = 'Booster', config = {extra = 4, choose = 1}},
        p_buffoon_mega_1 =          {order = 28, discovered = false, name = "Mega Buffoon Pack", weight = 0.15, kind = 'Buffoon', cost = 8, pos = {x=3,y=8}, atlas = 'Booster', set = 'Booster', config = {extra = 4, choose = 2}},

        --Extras       
        soul={pos = {x=0,y=1}},
        undiscovered_joker={pos = {x=5,y=3}},
        undiscovered_tarot={pos = {x=6,y=3}},
    }

    self.P_CENTER_POOLS = {
        Booster = {},
        Default = {},
        Enhanced = {},
        Edition = {},
        Joker = {},
        Tarot = {},
        Planet = {},
        Tarot_Planet = {},
        Spectral = {},
        Consumeables = {},
        Voucher = {},
        Back = {},
        Tag = {},
        Seal = {},
        Stake = {},
        Demo = {}
    }

    self.P_JOKER_RARITY_POOLS = {
        {},{},{},{}
    }

    self.P_LOCKED = {}

    self:save_progress()


    -------------------------------------
    local TESTHELPER_unlocks = false and not _RELEASE_MODE
    -------------------------------------
    if not love.filesystem.getInfo(G.SETTINGS.profile..'') then love.filesystem.createDirectory( G.SETTINGS.profile..'' ) end
    if not love.filesystem.getInfo(G.SETTINGS.profile..'/'..'meta.jkr') then love.filesystem.append( G.SETTINGS.profile..'/'..'meta.jkr', 'return {}') end

    convert_save_to_meta()

    local meta = STR_UNPACK(get_compressed(G.SETTINGS.profile..'/'..'meta.jkr') or 'return {}')
    meta.unlocked = meta.unlocked or {}
    meta.discovered = meta.discovered or {}
    meta.alerted = meta.alerted or {}
    
    for k, v in pairs(self.P_CENTERS) do
        if not v.wip and not v.demo then 
            if TESTHELPER_unlocks then v.unlocked = true; v.discovered = true;v.alerted = true end --REMOVE THIS
            if not v.unlocked and (string.find(k, '^j_') or string.find(k, '^b_') or string.find(k, '^v_')) and meta.unlocked[k] then 
                v.unlocked = true
            end
            if not v.unlocked and (string.find(k, '^j_') or string.find(k, '^b_') or string.find(k, '^v_')) then self.P_LOCKED[#self.P_LOCKED+1] = v end
            if not v.discovered and (string.find(k, '^j_') or string.find(k, '^b_') or string.find(k, '^e_') or string.find(k, '^c_') or string.find(k, '^p_') or string.find(k, '^v_')) and meta.discovered[k] then 
                v.discovered = true
            end
            if v.discovered and meta.alerted[k] or v.set == 'Back' or v.start_alerted then 
                v.alerted = true
            elseif v.discovered then
                v.alerted = false
            end
        end
    end

    table.sort(self.P_LOCKED, function (a, b) return not a.order or not b.order or a.order < b.order end)

    for k, v in pairs(self.P_BLINDS) do
        v.key = k
        if not v.wip and not v.demo then 
            if TESTHELPER_unlocks then v.discovered = true; v.alerted = true  end --REMOVE THIS
            if not v.discovered and meta.discovered[k] then 
                v.discovered = true
            end
            if v.discovered and meta.alerted[k] then 
                v.alerted = true
            elseif v.discovered then
                v.alerted = false
            end
        end
    end
    for k, v in pairs(self.P_TAGS) do
        v.key = k
        if not v.wip and not v.demo then 
            if TESTHELPER_unlocks then v.discovered = true; v.alerted = true  end --REMOVE THIS
            if not v.discovered and meta.discovered[k] then 
                v.discovered = true
            end
            if v.discovered and meta.alerted[k] then 
                v.alerted = true
            elseif v.discovered then
                v.alerted = false
            end
            table.insert(self.P_CENTER_POOLS['Tag'], v)
        end
    end
    for k, v in pairs(self.P_SEALS) do
        v.key = k
        if not v.wip and not v.demo then 
            if TESTHELPER_unlocks then v.discovered = true; v.alerted = true  end --REMOVE THIS
            if not v.discovered and meta.discovered[k] then 
                v.discovered = true
            end
            if v.discovered and meta.alerted[k] then 
                v.alerted = true
            elseif v.discovered then
                v.alerted = false
            end
            table.insert(self.P_CENTER_POOLS['Seal'], v)
        end
    end
    for k, v in pairs(self.P_STAKES) do
        v.key = k
        table.insert(self.P_CENTER_POOLS['Stake'], v)
    end

    for k, v in pairs(self.P_CENTERS) do
        v.key = k
        if v.set == 'Joker' then table.insert(self.P_CENTER_POOLS['Joker'], v) end
        if v.set and v.demo and v.pos then table.insert(self.P_CENTER_POOLS['Demo'], v) end
        if not v.wip then 
            if v.set and v.set ~= 'Joker' and not v.skip_pool and not v.omit then table.insert(self.P_CENTER_POOLS[v.set], v) end
            if v.set == 'Tarot' or v.set == 'Planet' then table.insert(self.P_CENTER_POOLS['Tarot_Planet'], v) end
            if v.consumeable then table.insert(self.P_CENTER_POOLS['Consumeables'], v) end
            if v.rarity and v.set == 'Joker' and not v.demo then table.insert(self.P_JOKER_RARITY_POOLS[v.rarity], v) end
        end
    end

    table.sort(self.P_CENTER_POOLS["Joker"], function (a, b) return a.order < b.order end)
    table.sort(self.P_CENTER_POOLS["Tarot"], function (a, b) return a.order < b.order end)
    table.sort(self.P_CENTER_POOLS["Planet"], function (a, b) return a.order < b.order end)
    table.sort(self.P_CENTER_POOLS["Tarot_Planet"], function (a, b) return a.order < b.order end)
    table.sort(self.P_CENTER_POOLS["Spectral"], function (a, b) return a.order < b.order end)
    table.sort(self.P_CENTER_POOLS["Voucher"], function (a, b) return a.order < b.order end)
    table.sort(self.P_CENTER_POOLS["Booster"], function (a, b) return a.order < b.order end)
    table.sort(self.P_CENTER_POOLS["Consumeables"], function (a, b) return a.order < b.order end)
    table.sort(self.P_CENTER_POOLS["Back"], function (a, b) return (a.order - (a.unlocked and 100 or 0)) < (b.order - (b.unlocked and 100 or 0)) end)
    table.sort(self.P_CENTER_POOLS["Enhanced"], function (a, b) return a.order < b.order end)
    table.sort(self.P_CENTER_POOLS["Stake"], function (a, b) return a.order < b.order end)
    table.sort(self.P_CENTER_POOLS["Tag"], function (a, b) return a.order < b.order end)
    table.sort(self.P_CENTER_POOLS["Seal"], function (a, b) return a.order < b.order end)
    table.sort(self.P_CENTER_POOLS["Demo"], function (a, b) return a.order + (a.set == 'Joker' and 1000 or 0) < b.order + (b.set == 'Joker' and 1000 or 0) end)
    for i = 1, 4 do 
        table.sort(self.P_JOKER_RARITY_POOLS[i], function (a, b) return a.order < b.order end)
    end
end

function Game:load_profile(_profile)
    if not G.PROFILES[_profile] then _profile = 1 end
    G.SETTINGS.profile = _profile
    
    --Load the settings file
    local info = get_compressed(_profile..'/profile.jkr')
    if info ~= nil then
        for k, v in pairs(STR_UNPACK(info)) do
            G.PROFILES[G.SETTINGS.profile][k] = v
        end
    end

    local temp_profile = {
        MEMORY = {
            deck = 'Red Deck',
            stake = 1,
        },
        stake = 1,
        
        high_scores = {
            hand = {label = 'Best Hand', amt = 0},
            furthest_round = {label = 'Highest Round', amt = 0},
            furthest_ante = {label = 'Highest Ante', amt = 0},
            most_money = {label = 'Most Money', amt = 0},
            boss_streak = {label = 'Most Bosses in a Row', amt = 0},
            collection = {label = 'Collection', amt = 0, tot = 1},
            win_streak = {label = 'Best Win Streak', amt = 0},
            current_streak = {label = '', amt = 0},
            poker_hand = {label = 'Most Played Hand', amt = 0}
        },
    
        career_stats = {
            c_round_interest_cap_streak = 0,
            c_dollars_earned = 0,
            c_shop_dollars_spent = 0,
            c_tarots_bought = 0,
            c_planets_bought = 0,
            c_playing_cards_bought = 0,
            c_vouchers_bought = 0,
            c_tarot_reading_used = 0,
            c_planetarium_used = 0,
            c_shop_rerolls = 0,
            c_cards_played = 0,
            c_cards_discarded = 0,
            c_losses = 0,
            c_wins = 0,
            c_rounds = 0,
            c_hands_played = 0,
            c_face_cards_played = 0,
            c_jokers_sold = 0,
            c_cards_sold = 0,
            c_single_hand_round_streak = 0,
        },
        progress = {

        },
        joker_usage = {},
        consumeable_usage = {},
        voucher_usage = {},
        hand_usage = {},
        deck_usage = {},
        deck_stakes = {},
        challenges_unlocked = nil,
        challenge_progress = {
            completed = {},
            unlocked = {}
        }
    }
    local recursive_init 
    recursive_init = function(t1, t2) 
        for k, v in pairs(t1) do
            if not t2[k] then 
                t2[k] = v
            elseif type(t2[k]) == 'table' and type(v) == 'table' then
                recursive_init(v, t2[k])
            end
        end
    end

    recursive_init(temp_profile, G.PROFILES[G.SETTINGS.profile])
end

function Game:set_language()
    if not self.LANGUAGES then 
        if not (love.filesystem.read('localization/'..G.SETTINGS.language..'.lua')) or G.F_ENGLISH_ONLY then
            ------------------------------------------
            --SET LANGUAGE FOR FIRST TIME STARTUP HERE

            ------------------------------------------

            G.SETTINGS.language = 'en-us'
        end
        -------------------------------------------------------
        --IF LANGUAGE NEEDS TO BE SET ON EVERY REBOOT, SET HERE

        -------------------------------------------------------

        self.LANGUAGES = {
            ['en-us'] = {font = 1, label = "English", key = 'en-us', button = "Language Feedback", warning = {'This language is still in Beta. To help us','improve it, please click on the feedback button.', 'Click again to confirm'}},
            ['de'] = {font = 1, label = "Deutsch", key = 'de', beta = nil, button = "Feedback zur Übersetzung", warning = {'Diese Übersetzung ist noch im Beta-Stadium. Willst du uns helfen,','sie zu verbessern? Dann klicke bitte auf die Feedback-Taste.', "Zum Bestätigen erneut klicken"}},
            ['es_419'] = {font = 1, label = "Español (México)", key = 'es_419', beta = nil, button = "Sugerencias de idioma", warning = {'Este idioma todavía está en Beta. Pulsa el botón','de sugerencias para ayudarnos a mejorarlo.', "Haz clic de nuevo para confirmar"}},
            ['es_ES'] = {font = 1, label = "Español (España)", key = 'es_ES', beta = nil, button = "Sugerencias de idioma", warning = {'Este idioma todavía está en Beta. Pulsa el botón','de sugerencias para ayudarnos a mejorarlo.', "Haz clic de nuevo para confirmar"}},
            ['fr'] = {font = 1, label = "Français", key = 'fr', beta = nil, button = "Partager votre avis", warning = {'La traduction française est encore en version bêta. ','Veuillez cliquer sur le bouton pour nous donner votre avis.', "Cliquez à nouveau pour confirmer"}},
            ['id'] = {font = 1, label = "Bahasa Indonesia", key = 'id', beta = true, button = "Umpan Balik Bahasa", warning = {'Bahasa ini masih dalam tahap Beta. Untuk membantu','kami meningkatkannya, silakan klik tombol umpan balik.', "Klik lagi untuk mengonfirmasi"}},
            ['it'] = {font = 1, label = "Italiano", key = 'it', beta = nil, button = "Feedback traduzione", warning = {'Questa traduzione è ancora in Beta. Per','aiutarci a migliorarla, clicca il tasto feedback', "Fai clic di nuovo per confermare"}},
            ['ja'] = {font = 5, label = "日本語", key = 'ja', beta = nil, button = "提案する", warning = {'この翻訳は現在ベータ版です。提案があった場合、','ボタンをクリックしてください。', "もう一度クリックして確認"}},
            ['ko'] = {font = 4, label = "한국어", key = 'ko', beta = nil, button = "번역 피드백", warning = {'이 언어는 아직 베타 단계에 있습니다. ','번역을 도와주시려면 피드백 버튼을 눌러주세요.', "다시 클릭해서 확인하세요"}},
            ['nl'] = {font = 1, label = "Nederlands", key = 'nl', beta = nil, button = "Taal suggesties", warning = {'Deze taal is nog in de Beta fase. Help ons het te ','verbeteren door op de suggestie knop te klikken.', "Klik opnieuw om te bevestigen"}},
            ['pl'] = {font = 1, label = "Polski", key = 'pl', beta = nil, button = "Wyślij uwagi do tłumaczenia", warning = {'Polska wersja językowa jest w fazie Beta. By pomóc nam poprawić',' jakość tłumaczenia, kliknij przycisk i podziel się swoją opinią i uwagami.', "Kliknij ponownie, aby potwierdzić"}},
            ['pt_BR'] = {font = 1, label = "Português", key = 'pt_BR', beta = nil, button = "Feedback de Tradução", warning = {'Esta tradução ainda está em Beta. Se quiser nos ajudar','a melhorá-la, clique no botão de feedback por favor', "Clique novamente para confirmar"}},
            ['ru'] = {font = 6, label = "Русский", key = 'ru', beta = true, button = "Отзыв о языке", warning = {'Этот язык все еще находится в Бета-версии. Чтобы помочь','нам его улучшить, пожалуйста, нажмите на кнопку обратной связи.', "Щелкните снова, чтобы подтвердить"}},
            ['zh_CN'] = {font = 2, label = "简体中文", key = 'zh_CN', beta = nil, button = "意见反馈", warning = {'这个语言目前尚为Beta版本。 请帮助我们改善翻译品质，','点击”意见反馈” 来提供你的意见。', "再次点击确认"}},
            ['zh_TW'] = {font = 3, label = "繁體中文", key = 'zh_TW', beta = nil, button = "意見回饋", warning = {'這個語言目前尚為Beta版本。請幫助我們改善翻譯品質，','點擊”意見回饋” 來提供你的意見。', "再按一下即可確認"}},
            ['all1'] = {font = 8, label = "English", key = 'all', omit = true},
            ['all2'] = {font = 9, label = "English", key = 'all', omit = true},
        }
        --if G.F_ENGLISH_ONLY then
        --    self.LANGUAGES = {
        --        ['en-us'] = self.LANGUAGES['en-us']
        --    }
        --end
        
        --load the font and set filter
        self.FONTS = {
            {file = "resources/fonts/m6x11plus.ttf", render_scale = self.TILESIZE*10, TEXT_HEIGHT_SCALE = 0.83, TEXT_OFFSET = {x=10,y=-20}, FONTSCALE = 0.1, squish = 1, DESCSCALE = 1},
            {file = "resources/fonts/NotoSansSC-Bold.ttf", render_scale = self.TILESIZE*7, TEXT_HEIGHT_SCALE = 0.7, TEXT_OFFSET = {x=0,y=-35}, FONTSCALE = 0.12, squish = 1, DESCSCALE = 1.1},
            {file = "resources/fonts/NotoSansTC-Bold.ttf", render_scale = self.TILESIZE*7, TEXT_HEIGHT_SCALE = 0.7, TEXT_OFFSET = {x=0,y=-35}, FONTSCALE = 0.12, squish = 1, DESCSCALE = 1.1},
            {file = "resources/fonts/NotoSansKR-Bold.ttf", render_scale = self.TILESIZE*7, TEXT_HEIGHT_SCALE = 0.8, TEXT_OFFSET = {x=0,y=-20}, FONTSCALE = 0.12, squish = 1, DESCSCALE = 1},
            {file = "resources/fonts/NotoSansJP-Bold.ttf", render_scale = self.TILESIZE*7, TEXT_HEIGHT_SCALE = 0.8, TEXT_OFFSET = {x=0,y=-20}, FONTSCALE = 0.12, squish = 1, DESCSCALE = 1},
            {file = "resources/fonts/NotoSans-Bold.ttf", render_scale = self.TILESIZE*7, TEXT_HEIGHT_SCALE = 0.65, TEXT_OFFSET = {x=0,y=-40}, FONTSCALE = 0.12, squish = 1, DESCSCALE = 1},
            {file = "resources/fonts/m6x11plus.ttf", render_scale = self.TILESIZE*10, TEXT_HEIGHT_SCALE = 0.9, TEXT_OFFSET = {x=10,y=15}, FONTSCALE = 0.1, squish = 1, DESCSCALE = 1},
            {file = "resources/fonts/GoNotoCurrent-Bold.ttf", render_scale = self.TILESIZE*10, TEXT_HEIGHT_SCALE = 0.8, TEXT_OFFSET = {x=10,y=-20}, FONTSCALE = 0.1, squish = 1, DESCSCALE = 1},
            {file = "resources/fonts/GoNotoCJKCore.ttf", render_scale = self.TILESIZE*10, TEXT_HEIGHT_SCALE = 0.8, TEXT_OFFSET = {x=10,y=-20}, FONTSCALE = 0.1, squish = 1, DESCSCALE = 1},
        }
        for _, v in ipairs(self.FONTS) do
            if love.filesystem.getInfo(v.file) then 
                v.FONT = love.graphics.newFont( v.file, v.render_scale)
            end
        end
        for _, v in pairs(self.LANGUAGES) do
            v.font = self.FONTS[v.font]
        end
    end

    self.LANG = self.LANGUAGES[self.SETTINGS.language] or self.LANGUAGES['en-us']

    local localization = love.filesystem.getInfo('localization/'..G.SETTINGS.language..'.lua')
    if localization ~= nil then
      self.localization = assert(loadstring(love.filesystem.read('localization/'..G.SETTINGS.language..'.lua')))()
      init_localization()
    end
end

function Game:set_render_settings()
    self.SETTINGS.GRAPHICS.texture_scaling = self.SETTINGS.GRAPHICS.texture_scaling or 2

    --Set fiter to linear interpolation and nearest, best for pixel art
    love.graphics.setDefaultFilter(
        self.SETTINGS.GRAPHICS.texture_scaling == 1 and 'nearest' or 'linear',
        self.SETTINGS.GRAPHICS.texture_scaling == 1 and 'nearest' or 'linear', 1)

    love.graphics.setLineStyle("rough")

    --spritesheets
    self.animation_atli = {
        {name = "blind_chips", path = "resources/textures/"..self.SETTINGS.GRAPHICS.texture_scaling.."x/BlindChips.png",px=34,py=34, frames = 21},
        {name = "shop_sign", path = "resources/textures/"..self.SETTINGS.GRAPHICS.texture_scaling.."x/ShopSignAnimation.png",px=113,py=57, frames = 4}
    }
    self.asset_atli = {
        {name = "cards_1", path = "resources/textures/"..self.SETTINGS.GRAPHICS.texture_scaling.."x/8BitDeck.png",px=71,py=95},
        {name = "cards_2", path = "resources/textures/"..self.SETTINGS.GRAPHICS.texture_scaling.."x/8BitDeck_opt2.png",px=71,py=95},
        {name = "centers", path = "resources/textures/"..self.SETTINGS.GRAPHICS.texture_scaling.."x/Enhancers.png",px=71,py=95},
        {name = "Joker", path = "resources/textures/"..self.SETTINGS.GRAPHICS.texture_scaling.."x/Jokers.png",px=71,py=95},
        {name = "Tarot", path = "resources/textures/"..self.SETTINGS.GRAPHICS.texture_scaling.."x/Tarots.png",px=71,py=95},
        {name = "Voucher", path = "resources/textures/"..self.SETTINGS.GRAPHICS.texture_scaling.."x/Vouchers.png",px=71,py=95},
        {name = "Booster", path = "resources/textures/"..self.SETTINGS.GRAPHICS.texture_scaling.."x/boosters.png",px=71,py=95},
        {name = "ui_1", path = "resources/textures/"..self.SETTINGS.GRAPHICS.texture_scaling.."x/ui_assets.png",px=18,py=18},
        {name = "ui_2", path = "resources/textures/"..self.SETTINGS.GRAPHICS.texture_scaling.."x/ui_assets_opt2.png",px=18,py=18},
        {name = "balatro", path = "resources/textures/"..self.SETTINGS.GRAPHICS.texture_scaling.."x/balatro.png",px=333,py=216},        
        {name = 'gamepad_ui', path = "resources/textures/"..self.SETTINGS.GRAPHICS.texture_scaling.."x/gamepad_ui.png",px=32,py=32},
        {name = 'icons', path = "resources/textures/"..self.SETTINGS.GRAPHICS.texture_scaling.."x/icons.png",px=66,py=66},
        {name = 'tags', path = "resources/textures/"..self.SETTINGS.GRAPHICS.texture_scaling.."x/tags.png",px=34,py=34},
        {name = 'stickers', path = "resources/textures/"..self.SETTINGS.GRAPHICS.texture_scaling.."x/stickers.png",px=71,py=95},
        {name = 'chips', path = "resources/textures/"..self.SETTINGS.GRAPHICS.texture_scaling.."x/chips.png",px=29,py=29},

        {name = 'collab_AU_1', path = "resources/textures/"..self.SETTINGS.GRAPHICS.texture_scaling.."x/collabs/collab_AU_1.png",px=71,py=95},
        {name = 'collab_AU_2', path = "resources/textures/"..self.SETTINGS.GRAPHICS.texture_scaling.."x/collabs/collab_AU_2.png",px=71,py=95},
        {name = 'collab_TW_1', path = "resources/textures/"..self.SETTINGS.GRAPHICS.texture_scaling.."x/collabs/collab_TW_1.png",px=71,py=95},
        {name = 'collab_TW_2', path = "resources/textures/"..self.SETTINGS.GRAPHICS.texture_scaling.."x/collabs/collab_TW_2.png",px=71,py=95},
        {name = 'collab_VS_1', path = "resources/textures/"..self.SETTINGS.GRAPHICS.texture_scaling.."x/collabs/collab_VS_1.png",px=71,py=95},
        {name = 'collab_VS_2', path = "resources/textures/"..self.SETTINGS.GRAPHICS.texture_scaling.."x/collabs/collab_VS_2.png",px=71,py=95},
        {name = 'collab_DTD_1', path = "resources/textures/"..self.SETTINGS.GRAPHICS.texture_scaling.."x/collabs/collab_DTD_1.png",px=71,py=95},
        {name = 'collab_DTD_2', path = "resources/textures/"..self.SETTINGS.GRAPHICS.texture_scaling.."x/collabs/collab_DTD_2.png",px=71,py=95},

        {name = 'collab_CYP_1', path = "resources/textures/"..self.SETTINGS.GRAPHICS.texture_scaling.."x/collabs/collab_CYP_1.png",px=71,py=95},
        {name = 'collab_CYP_2', path = "resources/textures/"..self.SETTINGS.GRAPHICS.texture_scaling.."x/collabs/collab_CYP_2.png",px=71,py=95},
        {name = 'collab_STS_1', path = "resources/textures/"..self.SETTINGS.GRAPHICS.texture_scaling.."x/collabs/collab_STS_1.png",px=71,py=95},
        {name = 'collab_STS_2', path = "resources/textures/"..self.SETTINGS.GRAPHICS.texture_scaling.."x/collabs/collab_STS_2.png",px=71,py=95},
        {name = 'collab_TBoI_1', path = "resources/textures/"..self.SETTINGS.GRAPHICS.texture_scaling.."x/collabs/collab_TBoI_1.png",px=71,py=95},
        {name = 'collab_TBoI_2', path = "resources/textures/"..self.SETTINGS.GRAPHICS.texture_scaling.."x/collabs/collab_TBoI_2.png",px=71,py=95},
        {name = 'collab_SV_1', path = "resources/textures/"..self.SETTINGS.GRAPHICS.texture_scaling.."x/collabs/collab_SV_1.png",px=71,py=95},
        {name = 'collab_SV_2', path = "resources/textures/"..self.SETTINGS.GRAPHICS.texture_scaling.."x/collabs/collab_SV_2.png",px=71,py=95},
        
        {name = 'collab_SK_1', path = "resources/textures/"..self.SETTINGS.GRAPHICS.texture_scaling.."x/collabs/collab_SK_1.png",px=71,py=95},
        {name = 'collab_SK_2', path = "resources/textures/"..self.SETTINGS.GRAPHICS.texture_scaling.."x/collabs/collab_SK_2.png",px=71,py=95},
        {name = 'collab_DS_1', path = "resources/textures/"..self.SETTINGS.GRAPHICS.texture_scaling.."x/collabs/collab_DS_1.png",px=71,py=95},
        {name = 'collab_DS_2', path = "resources/textures/"..self.SETTINGS.GRAPHICS.texture_scaling.."x/collabs/collab_DS_2.png",px=71,py=95},
        {name = 'collab_CL_1', path = "resources/textures/"..self.SETTINGS.GRAPHICS.texture_scaling.."x/collabs/collab_CL_1.png",px=71,py=95},
        {name = 'collab_CL_2', path = "resources/textures/"..self.SETTINGS.GRAPHICS.texture_scaling.."x/collabs/collab_CL_2.png",px=71,py=95},
        {name = 'collab_D2_1', path = "resources/textures/"..self.SETTINGS.GRAPHICS.texture_scaling.."x/collabs/collab_D2_1.png",px=71,py=95},
        {name = 'collab_D2_2', path = "resources/textures/"..self.SETTINGS.GRAPHICS.texture_scaling.."x/collabs/collab_D2_2.png",px=71,py=95},
        {name = 'collab_PC_1', path = "resources/textures/"..self.SETTINGS.GRAPHICS.texture_scaling.."x/collabs/collab_PC_1.png",px=71,py=95},
        {name = 'collab_PC_2', path = "resources/textures/"..self.SETTINGS.GRAPHICS.texture_scaling.."x/collabs/collab_PC_2.png",px=71,py=95},
        {name = 'collab_WF_1', path = "resources/textures/"..self.SETTINGS.GRAPHICS.texture_scaling.."x/collabs/collab_WF_1.png",px=71,py=95},
        {name = 'collab_WF_2', path = "resources/textures/"..self.SETTINGS.GRAPHICS.texture_scaling.."x/collabs/collab_WF_2.png",px=71,py=95},
        {name = 'collab_EG_1', path = "resources/textures/"..self.SETTINGS.GRAPHICS.texture_scaling.."x/collabs/collab_EG_1.png",px=71,py=95},
        {name = 'collab_EG_2', path = "resources/textures/"..self.SETTINGS.GRAPHICS.texture_scaling.."x/collabs/collab_EG_2.png",px=71,py=95},
        {name = 'collab_XR_1', path = "resources/textures/"..self.SETTINGS.GRAPHICS.texture_scaling.."x/collabs/collab_XR_1.png",px=71,py=95},
        {name = 'collab_XR_2', path = "resources/textures/"..self.SETTINGS.GRAPHICS.texture_scaling.."x/collabs/collab_XR_2.png",px=71,py=95},

        {name = 'collab_CR_1', path = "resources/textures/"..self.SETTINGS.GRAPHICS.texture_scaling.."x/collabs/collab_CR_1.png",px=71,py=95},
        {name = 'collab_CR_2', path = "resources/textures/"..self.SETTINGS.GRAPHICS.texture_scaling.."x/collabs/collab_CR_2.png",px=71,py=95},
        {name = 'collab_BUG_1', path = "resources/textures/"..self.SETTINGS.GRAPHICS.texture_scaling.."x/collabs/collab_BUG_1.png",px=71,py=95},
        {name = 'collab_BUG_2', path = "resources/textures/"..self.SETTINGS.GRAPHICS.texture_scaling.."x/collabs/collab_BUG_2.png",px=71,py=95},
        {name = 'collab_FO_1', path = "resources/textures/"..self.SETTINGS.GRAPHICS.texture_scaling.."x/collabs/collab_FO_1.png",px=71,py=95},
        {name = 'collab_FO_2', path = "resources/textures/"..self.SETTINGS.GRAPHICS.texture_scaling.."x/collabs/collab_FO_2.png",px=71,py=95},
        {name = 'collab_DBD_1', path = "resources/textures/"..self.SETTINGS.GRAPHICS.texture_scaling.."x/collabs/collab_DBD_1.png",px=71,py=95},
        {name = 'collab_DBD_2', path = "resources/textures/"..self.SETTINGS.GRAPHICS.texture_scaling.."x/collabs/collab_DBD_2.png",px=71,py=95},
        {name = 'collab_C7_1', path = "resources/textures/"..self.SETTINGS.GRAPHICS.texture_scaling.."x/collabs/collab_C7_1.png",px=71,py=95},
        {name = 'collab_C7_2', path = "resources/textures/"..self.SETTINGS.GRAPHICS.texture_scaling.."x/collabs/collab_C7_2.png",px=71,py=95},
        {name = 'collab_R_1', path = "resources/textures/"..self.SETTINGS.GRAPHICS.texture_scaling.."x/collabs/collab_R_1.png",px=71,py=95},
        {name = 'collab_R_2', path = "resources/textures/"..self.SETTINGS.GRAPHICS.texture_scaling.."x/collabs/collab_R_2.png",px=71,py=95},
        {name = 'collab_AC_1', path = "resources/textures/"..self.SETTINGS.GRAPHICS.texture_scaling.."x/collabs/collab_AC_1.png",px=71,py=95},
        {name = 'collab_AC_2', path = "resources/textures/"..self.SETTINGS.GRAPHICS.texture_scaling.."x/collabs/collab_AC_2.png",px=71,py=95},
        {name = 'collab_STP_1', path = "resources/textures/"..self.SETTINGS.GRAPHICS.texture_scaling.."x/collabs/collab_STP_1.png",px=71,py=95},
        {name = 'collab_STP_2', path = "resources/textures/"..self.SETTINGS.GRAPHICS.texture_scaling.."x/collabs/collab_STP_2.png",px=71,py=95},
    }
    self.asset_images = {
        {name = "playstack_logo", path = "resources/textures/1x/playstack-logo.png", px=1417,py=1417},
        {name = "localthunk_logo", path = "resources/textures/1x/localthunk-logo.png", px=1390,py=560}
    }

    --Load in all atli defined above
    for i=1, #self.animation_atli do
        self.ANIMATION_ATLAS[self.animation_atli[i].name] = {}
        self.ANIMATION_ATLAS[self.animation_atli[i].name].name = self.animation_atli[i].name
        self.ANIMATION_ATLAS[self.animation_atli[i].name].image = love.graphics.newImage(self.animation_atli[i].path, {mipmaps = true, dpiscale = self.SETTINGS.GRAPHICS.texture_scaling})
        self.ANIMATION_ATLAS[self.animation_atli[i].name].px = self.animation_atli[i].px
        self.ANIMATION_ATLAS[self.animation_atli[i].name].py = self.animation_atli[i].py
        self.ANIMATION_ATLAS[self.animation_atli[i].name].frames = self.animation_atli[i].frames
    end

    for i=1, #self.asset_atli do
        self.ASSET_ATLAS[self.asset_atli[i].name] = {}
        self.ASSET_ATLAS[self.asset_atli[i].name].name = self.asset_atli[i].name
        self.ASSET_ATLAS[self.asset_atli[i].name].image = love.graphics.newImage(self.asset_atli[i].path, {mipmaps = true, dpiscale = self.SETTINGS.GRAPHICS.texture_scaling})
        self.ASSET_ATLAS[self.asset_atli[i].name].type = self.asset_atli[i].type
        self.ASSET_ATLAS[self.asset_atli[i].name].px = self.asset_atli[i].px
        self.ASSET_ATLAS[self.asset_atli[i].name].py = self.asset_atli[i].py
    end
    for i=1, #self.asset_images do
        self.ASSET_ATLAS[self.asset_images[i].name] = {}
        self.ASSET_ATLAS[self.asset_images[i].name].name = self.asset_images[i].name
        self.ASSET_ATLAS[self.asset_images[i].name].image = love.graphics.newImage(self.asset_images[i].path, {mipmaps = true, dpiscale = 1})
        self.ASSET_ATLAS[self.asset_images[i].name].type = self.asset_images[i].type
        self.ASSET_ATLAS[self.asset_images[i].name].px = self.asset_images[i].px
        self.ASSET_ATLAS[self.asset_images[i].name].py = self.asset_images[i].py
    end

    for _, v in pairs(G.I.SPRITE) do
        v:reset()
    end

    self.ASSET_ATLAS.Planet = self.ASSET_ATLAS.Tarot
    self.ASSET_ATLAS.Spectral = self.ASSET_ATLAS.Tarot
end

function Game:init_window(reset)
    --Initialize the window
    self.ROOM_PADDING_H= 0.7
    self.ROOM_PADDING_W = 1
    self.WINDOWTRANS = {
        x = 0, y = 0,
        w = self.TILE_W+2*self.ROOM_PADDING_W, 
        h = self.TILE_H+2*self.ROOM_PADDING_H
    }
    self.window_prev = {
        orig_scale = self.TILESCALE,
        w=self.WINDOWTRANS.w*self.TILESIZE*self.TILESCALE,
        h=self.WINDOWTRANS.h*self.TILESIZE*self.TILESCALE,
        orig_ratio = self.WINDOWTRANS.w*self.TILESIZE*self.TILESCALE/(self.WINDOWTRANS.h*self.TILESIZE*self.TILESCALE)}
    G.SETTINGS.QUEUED_CHANGE = G.SETTINGS.QUEUED_CHANGE or {}
    G.SETTINGS.QUEUED_CHANGE.screenmode = G.SETTINGS.WINDOW.screenmode
    
    G.FUNCS.apply_window_changes(true)
end

function Game:delete_run()
    if self.ROOM then
        remove_all(G.STAGE_OBJECTS[G.STAGE])
        self.load_shop_booster = nil
        self.load_shop_jokers = nil
        self.load_shop_vouchers = nil
        if self.buttons then self.buttons:remove(); self.buttons = nil end
        if self.deck_preview then self.deck_preview:remove(); self.deck_preview = nil end
        if self.shop then self.shop:remove(); self.shop = nil end
        if self.blind_select then self.blind_select:remove(); self.blind_select = nil end
        if self.booster_pack then self.booster_pack:remove(); self.booster_pack = nil end
        if self.MAIN_MENU_UI then self.MAIN_MENU_UI:remove(); self.MAIN_MENU_UI = nil end
        if self.SPLASH_FRONT then self.SPLASH_FRONT:remove(); self.SPLASH_FRONT = nil end
        if self.SPLASH_BACK then self.SPLASH_BACK:remove(); self.SPLASH_BACK = nil end
        if self.SPLASH_LOGO then self.SPLASH_LOGO:remove(); self.SPLASH_LOGO = nil end
        if self.GAME_OVER_UI then self.GAME_OVER_UI:remove(); self.GAME_OVER_UI = nil end
        if self.collection_alert then self.collection_alert:remove(); self.collection_alert = nil end
        if self.HUD then self.HUD:remove(); self.HUD = nil end
        if self.HUD_blind then self.HUD_blind:remove(); self.HUD_blind = nil end
        if self.HUD_tags then
            for k, v in pairs(self.HUD_tags) do
                v:remove()
            end
            self.HUD_tags = nil
        end
        if self.OVERLAY_MENU then self.OVERLAY_MENU:remove(); self.OVERLAY_MENU = nil end
        if self.OVERLAY_TUTORIAL then
            G.OVERLAY_TUTORIAL.Jimbo:remove()
            if G.OVERLAY_TUTORIAL.content then G.OVERLAY_TUTORIAL.content:remove() end
            G.OVERLAY_TUTORIAL:remove()
            G.OVERLAY_TUTORIAL = nil
        end
        for k, v in pairs(G) do
            if (type(v) == "table") and v.is and v:is(CardArea) then 
              G[k] = nil
            end
          end
          G.I.CARD = {}
    end
    G.VIEWING_DECK = nil
    G.E_MANAGER:clear_queue()
    G.CONTROLLER:mod_cursor_context_layer(-1000)
    G.CONTROLLER.focus_cursor_stack = {}
    G.CONTROLLER.focus_cursor_stack_level = 1
    if G.GAME then G.GAME.won = false end

    G.STATE = -1
end



function Game:save_progress()
    G.ARGS.save_progress = G.ARGS.save_progress or {}
    G.ARGS.save_progress.UDA = EMPTY(G.ARGS.save_progress.UDA)
    G.ARGS.save_progress.SETTINGS = G.SETTINGS
    G.ARGS.save_progress.PROFILE = G.PROFILES[G.SETTINGS.profile]

    for k, v in pairs(self.P_CENTERS) do
        G.ARGS.save_progress.UDA[k] = (v.unlocked and 'u' or '')..(v.discovered and 'd' or '')..(v.alerted and 'a' or '')
    end
    for k, v in pairs(self.P_BLINDS) do
        G.ARGS.save_progress.UDA[k] = (v.unlocked and 'u' or '')..(v.discovered and 'd' or '')..(v.alerted and 'a' or '')
    end
    for k, v in pairs(self.P_TAGS) do
        G.ARGS.save_progress.UDA[k] = (v.unlocked and 'u' or '')..(v.discovered and 'd' or '')..(v.alerted and 'a' or '')
    end
    for k, v in pairs(self.P_SEALS) do
        G.ARGS.save_progress.UDA[k] = (v.unlocked and 'u' or '')..(v.discovered and 'd' or '')..(v.alerted and 'a' or '')
    end

    G.FILE_HANDLER = G.FILE_HANDLER or {}
    G.FILE_HANDLER.progress = true
    G.FILE_HANDLER.update_queued = true
end

function Game:save_notify(card)
    G.SAVE_MANAGER.channel:push({
        type = 'save_notify',
        save_notify = card.key,
        profile_num = G.SETTINGS.profile
      })
end

function Game:save_settings()
    G.ARGS.save_settings = G.SETTINGS
    G.FILE_HANDLER = G.FILE_HANDLER or {}
    G.FILE_HANDLER.settings = true
    G.FILE_HANDLER.update_queued = true
end

function Game:save_metrics()
    G.ARGS.save_metrics = G.METRICS
    G.FILE_HANDLER = G.FILE_HANDLER or {}
    G.FILE_HANDLER.settings = true
    G.FILE_HANDLER.update_queued = true
end

function Game:prep_stage(new_stage, new_state, new_game_obj)
    for k, v in pairs(self.CONTROLLER.locks) do
        self.CONTROLLER.locks[k] = nil
    end
    if new_game_obj then self.GAME = self:init_game_object() end
    self.STAGE = new_stage or self.STAGES.MAIN_MENU
    self.STATE = new_state or self.STATES.MENU
    self.STATE_COMPLETE = false
    self.SETTINGS.paused = false

    self.ROOM = Node{T={
        x = self.ROOM_PADDING_W,
        y = self.ROOM_PADDING_H,
        w = self.TILE_W,
        h = self.TILE_H}
    }
    self.ROOM.jiggle = 0
    self.ROOM.states.drag.can = false
    self.ROOM:set_container(self.ROOM)

    self.ROOM_ATTACH = Moveable{T={
        x = 0,
        y = 0,
        w = self.TILE_W,
        h = self.TILE_H}
    }
    self.ROOM_ATTACH.states.drag.can = false
    self.ROOM_ATTACH:set_container(self.ROOM)
    love.resize(love.graphics.getWidth( ),love.graphics.getHeight( ))
end

function Game:sandbox() 
    G.TIMERS.REAL = 0
    G.TIMERS.TOTAL = 0

    self:prep_stage(G.STAGES.SANDBOX, G.STATES.SANDBOX, true)
    self.GAME.selected_back = Back(G.P_CENTERS.b_red)

    ease_background_colour{new_colour = G.C.BLACK, contrast = 1}

    G.SANDBOX = {
        vort_time = 7,
        vort_speed = 0,
        col_op = {'RED','BLUE','GREEN','BLACK','L_BLACK','WHITE','EDITION','DARK_EDITION','ORANGE','PURPLE'},
        col1 = G.C.RED,col2 = G.C.BLUE,
        mid_flash = 0,
        joker_text = '',
        edition = 'base',
        tilt = 1,
        card_size = 1,
        base_size = {w = G.CARD_W, h = G.CARD_H},
        gamespeed = 0
    }

    if G.SPLASH_FRONT then G.SPLASH_FRONT:remove(); G.SPLASH_FRONT = nil end
    if G.SPLASH_BACK then G.SPLASH_BACK:remove(); G.SPLASH_BACK = nil end

    G.SPLASH_BACK = Sprite(-30, -13, G.ROOM.T.w+60, G.ROOM.T.h+22, G.ASSET_ATLAS["ui_"..(G.SETTINGS.colourblind_option and 2 or 1)], {x = 2, y = 0})
    G.SPLASH_BACK:set_alignment({
        major = G.ROOM_ATTACH,
        type = 'cm',
        offset = {x=0,y=0}
    })

    G.SPLASH_BACK:define_draw_steps({{
        shader = 'splash',
        send = {
            {name = 'time', ref_table = G.SANDBOX, ref_value = 'vort_time'},
            {name = 'vort_speed', val = 0.4},
            {name = 'colour_1', ref_table = G.SANDBOX, ref_value = 'col1'},
            {name = 'colour_2', ref_table = G.SANDBOX, ref_value = 'col2'},
            {name = 'mid_flash', ref_table = G.SANDBOX, ref_value = 'mid_flash'},
            {name = 'vort_offset', val = 0},
    }}})

    function create_UIBox_sandbox_controls()
        G.FUNCS.col1change = function(args)
          G.SANDBOX.col1 = G.C[args.to_val]
        end
        G.FUNCS.col2change = function(args)
          G.SANDBOX.col2 = G.C[args.to_val]
        end
        G.FUNCS.edition_change = function(args)
            G.SANDBOX.edition = args.to_val
            if G.SANDBOX.joker then G.SANDBOX.joker:set_edition({[args.to_val] = true}, true, true) end
          end
          G.FUNCS.pulseme = function(e)
            if math.random() > 0.998 then e.config.object:pulse(1) end
          end
        G.FUNCS.spawn_joker = function(e) G.FUNCS.rem_joker(); G.SANDBOX.joker = add_joker(G.SANDBOX.joker_text, G.SANDBOX.edition) end
        G.FUNCS.rem_joker = function(e) if G.SANDBOX.joker then G.SANDBOX.joker:remove(); G.SANDBOX.joker = nil end end 
        G.FUNCS.do_time = function(args) if args.to_val == 'PLAY' then G.SANDBOX.gamespeed = 1 else G.SANDBOX.gamespeed = 0 end end
        G.FUNCS.cb = function(rt) G.CARD_W = rt.ref_table[rt.ref_value]*G.SANDBOX.base_size.w; G.CARD_H = rt.ref_table[rt.ref_value]*G.SANDBOX.base_size.h end
        G.E_MANAGER:add_event(Event({
            func = (function()
                G.SANDBOX.file_reload_timer = (G.SANDBOX.file_reload_timer or 0)
                if G.SANDBOX.file_reload_timer < G.TIMERS.REAL then 
                    G.SANDBOX.file_reload_timer = G.SANDBOX.file_reload_timer+0.25
                end
                if G.SANDBOX.joker then G.SANDBOX.joker.ambient_tilt = G.SANDBOX.tilt end
                G.SANDBOX.vort_time = G.SANDBOX.vort_time + G.real_dt*G.SANDBOX.gamespeed
                G.CONTROLLER.lock_input = false
            end)
          }))
      
        local t = {
          n=G.UIT.ROOT, config = {align = "cm",colour = G.C.CLEAR}, nodes={   
            {n=G.UIT.R, config={align = "cm", padding = 0.05, r = 0.1, emboss = 0.1, colour = G.C.L_BLACK}, nodes={
              create_slider({label = 'Time', w = 2, h = 0.3, text_scale = 0.2, label_scale = 0.3, ref_table = G.SANDBOX, ref_value = 'vort_time', min = 0, max = 30}),
              create_option_cycle({options = {'PLAY','PAUSE'}, opt_callback = 'do_time', current_option = 1, colour = G.C.RED, w = 2, scale = 0.7}),
              create_slider({label = 'tilt', w = 2, h = 0.3, text_scale = 0.2, label_scale = 0.3, ref_table = G.SANDBOX, ref_value = 'tilt', min = 0, max = 3, decimal_places = 2}),
              create_slider({label = 'Card size', w = 2, h = 0.3, text_scale = 0.2, label_scale = 0.3, ref_table = G.SANDBOX, ref_value = 'card_size', min = 0.1, max = 3, callback = 'cb', decimal_places = 2}),
              create_option_cycle({options = G.SANDBOX.col_op, opt_callback = 'col1change', current_option = 1, colour = G.C.RED, w = 2, scale = 0.7}),
              create_option_cycle({options = G.SANDBOX.col_op, opt_callback = 'col2change', current_option = 2, colour = G.C.RED, w = 2, scale = 0.7}),
              {n=G.UIT.R, config={align = "cm", padding = 0.05}, nodes = {
                UIBox_button{ label = {"+"}, button = "spawn_joker", minw = 0.7, col = true},
                create_text_input({prompt_text = 'Joker key', extended_corpus = true, ref_table = G.SANDBOX, ref_value = 'joker_text', text_scale = 0.3, w = 1.5, h = 0.6}),
                UIBox_button{ label = {"-"}, button = "rem_joker", minw = 0.7, col = true},
              }},
              create_option_cycle({options = {'base', 'foil', 'holo', 'polychrome','negative'}, opt_callback = 'edition_change', current_option = 1, colour = G.C.RED, w = 2, scale = 0.7}),
            }}
          }}
        return t
      end


    G.SANDBOX.UI = UIBox{
        definition = create_UIBox_sandbox_controls(), 
        config = {align="cli", offset = {x=0,y=0}, major = G.ROOM_ATTACH, bond = 'Weak'}
    }
    
    G.SANDBOX.UI:recalculate(true)
end

function Game:splash_screen()
    --If the skip splash screen option is set, immediately go to the main menu here
    if G.SETTINGS.skip_splash == 'Yes' then 
        G:main_menu()
        return 
    end

    self:prep_stage(G.STAGES.MAIN_MENU, G.STATES.SPLASH, true)
    G.E_MANAGER:add_event(Event({
        func = (function()
            discover_card()
            return true
        end)
      }))


      G.E_MANAGER:add_event(Event({
        trigger = 'immediate',
        func = (function()
            G.TIMERS.TOTAL = 0
            G.TIMERS.REAL = 0
            --Prep the splash screen shaders for both the background(colour swirl) and the foreground(white flash), starting at black
            G.SPLASH_BACK = Sprite(-30, -13, G.ROOM.T.w+60, G.ROOM.T.h+22, G.ASSET_ATLAS["ui_1"], {x = 2, y = 0})
            G.SPLASH_BACK:define_draw_steps({{
                shader = 'splash',
                send = {
                    {name = 'time', ref_table = G.TIMERS, ref_value = 'REAL'},
                    {name = 'vort_speed', val = 1},
                    {name = 'colour_1', ref_table = G.C, ref_value = 'BLUE'},
                    {name = 'colour_2', ref_table = G.C, ref_value = 'WHITE'},
                    {name = 'mid_flash', val = 0},
                    {name = 'vort_offset', val = (2*90.15315131*os.time())%100000},
                }}})
            G.SPLASH_BACK:set_alignment({
                major = G.ROOM_ATTACH,
                type = 'cm',
                offset = {x=0,y=0}
            })
            G.SPLASH_FRONT = Sprite(0,-20, G.ROOM.T.w*2, G.ROOM.T.h*4, G.ASSET_ATLAS["ui_1"], {x = 2, y = 0})
            G.SPLASH_FRONT:define_draw_steps({{
                shader = 'flash',
                send = {
                    {name = 'time', ref_table = G.TIMERS, ref_value = 'REAL'},
                    {name = 'mid_flash', val = 1}
                }}})
            G.SPLASH_FRONT:set_alignment({
                major = G.ROOM_ATTACH,
                type = 'cm',
                offset = {x=0,y=0}
            })

            --spawn in splash card
            local SC = nil
            G.E_MANAGER:add_event(Event({trigger = 'after',delay = 0.2,func = (function()
                local SC_scale = 1.2
                SC = Card(G.ROOM.T.w/2 - SC_scale*G.CARD_W/2, 10. + G.ROOM.T.h/2 - SC_scale*G.CARD_H/2, SC_scale*G.CARD_W, SC_scale*G.CARD_H, G.P_CARDS.empty, G.P_CENTERS['j_joker'])
                SC.T.y = G.ROOM.T.h/2 - SC_scale*G.CARD_H/2
                SC.ambient_tilt = 1
                SC.states.drag.can = false
                SC.states.hover.can = false
                SC.no_ui = true
                G.VIBRATION = G.VIBRATION + 2
                play_sound('whoosh1', 0.7, 0.2)
                play_sound('introPad1', 0.704, 0.6)
            return true;end)}))

            --dissolve fool card and start to fade in the vortex
            G.E_MANAGER:add_event(Event({trigger = 'after',delay = 1.8,func = (function() --|||||||||||
                SC:start_dissolve({G.C.WHITE, G.C.WHITE},true, 12, true)
                play_sound('magic_crumple', 1, 0.5)
                play_sound('splash_buildup', 1, 0.7)
            return true;end)}))

            --create all the cards and suck them in
            function make_splash_card(args)
                args = args or {}
                local angle = math.random()*2*3.14
                local card_size = (args.scale or 1.5)*(math.random() + 1)
                local card_pos = args.card_pos or {
                    x = (18 + card_size)*math.sin(angle),
                    y = (18 + card_size)*math.cos(angle)
                }
                local card = Card(  card_pos.x + G.ROOM.T.w/2 - G.CARD_W*card_size/2,
                                    card_pos.y + G.ROOM.T.h/2 - G.CARD_H*card_size/2,
                                    card_size*G.CARD_W, card_size*G.CARD_H, pseudorandom_element(G.P_CARDS), G.P_CENTERS.c_base)
                if math.random() > 0.8 then card.sprite_facing = 'back'; card.facing = 'back' end
                card.no_shadow = true
                card.states.hover.can = false
                card.states.drag.can = false
                card.vortex = true and not args.no_vortex
                card.T.r = angle
                return card, card_pos
            end

            G.vortex_time = G.TIMERS.REAL
            local temp_del = nil

            for i = 1, 200 do
                temp_del = temp_del or 3
                G.E_MANAGER:add_event(Event({
                    trigger = 'after',
                    blockable = false,
                    delay = temp_del,
                    func = (function()
                    local card, card_pos = make_splash_card({scale = 2 - i/300})
                    local speed = math.max(2. - i*0.005, 0.001)
                    ease_value(card.T, 'scale', -card.T.scale, nil, nil, nil, 1.*speed, 'elastic')
                    ease_value(card.T, 'x', -card_pos.x, nil, nil, nil, 0.9*speed)
                    ease_value(card.T, 'y', -card_pos.y, nil, nil, nil, 0.9*speed)
                    local temp_pitch = i*0.007 + 0.6
                    local temp_i = i
                    G.E_MANAGER:add_event(Event({
                        blockable = false,
                        func = (function()
                            if card.T.scale <= 0 then
                                if temp_i < 30 then 
                                    play_sound('whoosh1', temp_pitch + math.random()*0.05, 0.25*(1 - temp_i/50))
                                end

                                if temp_i == 15 then
                                    play_sound('whoosh_long',0.9, 0.7)
                                end
                                G.VIBRATION = G.VIBRATION + 0.1
                                card:remove()
                                return true
                            end
                        end)}))
                        return true
                    end)}))
                    temp_del = temp_del + math.max(1/(i), math.max(0.2*(170-i)/500, 0.016))
            end

            --when faded to white, spit out the 'Fool's' cards and slowly have them settle in to place
            G.E_MANAGER:add_event(Event({trigger = 'after',delay = 2.,func = (function()
                G.SPLASH_BACK:remove()
                G.SPLASH_BACK = G.SPLASH_FRONT
                G.SPLASH_FRONT = nil
                G:main_menu('splash')
            return true;end)}))
        return true
    end)
    }))
end

function Game:main_menu(change_context) --True if main menu is accessed from the splash screen, false if it is skipped or accessed from the game
    if change_context ~= 'splash' then 
        --Skip the timer to 14 seconds for all shaders that need it
        G.TIMERS.REAL = 12
        G.TIMERS.TOTAL = 12
    else
        --keep all sounds that came from splash screen
        RESET_STATES(G.STATES.MENU)
    end

    --Prepare the main menu, reset the default deck
    self:prep_stage(G.STAGES.MAIN_MENU, G.STATES.MENU, true)
    self.GAME.selected_back = Back(G.P_CENTERS.b_red)

    if (not G.SETTINGS.tutorial_complete) and G.SETTINGS.tutorial_progress.completed_parts['big_blind'] then G.SETTINGS.tutorial_complete = true end

    G.FUNCS.change_shadows{to_key = G.SETTINGS.GRAPHICS.shadows == 'On' and 1 or 2}

    ease_background_colour{new_colour = G.C.BLACK, contrast = 1}

    if G.SPLASH_FRONT then G.SPLASH_FRONT:remove(); G.SPLASH_FRONT = nil end
    if G.SPLASH_BACK then G.SPLASH_BACK:remove(); G.SPLASH_BACK = nil end
    G.SPLASH_BACK = Sprite(-30, -13, G.ROOM.T.w+60, G.ROOM.T.h+22, G.ASSET_ATLAS["ui_1"], {x = 2, y = 0})
    G.SPLASH_BACK:set_alignment({
        major = G.ROOM_ATTACH,
        type = 'cm',
        offset = {x=0,y=0}
    })
    local splash_args = {mid_flash = change_context == 'splash' and 1.6 or 0.}
    ease_value(splash_args, 'mid_flash', -(change_context == 'splash' and 1.6 or 0), nil, nil, nil, 4)

    G.SPLASH_BACK:define_draw_steps({{
        shader = 'splash',
        send = {
            {name = 'time', ref_table = G.TIMERS, ref_value = 'REAL_SHADER'},
            {name = 'vort_speed', val = 0.4},
            {name = 'colour_1', ref_table = G.C, ref_value = 'RED'},
            {name = 'colour_2', ref_table = G.C, ref_value = 'BLUE'},
            {name = 'mid_flash', ref_table = splash_args, ref_value = 'mid_flash'},
            {name = 'vort_offset', val = 0},
        }}})

    --Display the unlocked decks and cards from the previous run
    G.E_MANAGER:add_event(Event({
        trigger = 'immediate',
        func = (function()
            unlock_notify()
            return true
        end)
      }))

    
    local SC_scale = 1.1*(G.debug_splash_size_toggle and 0.8 or 1)
    local CAI = {
        TITLE_TOP_W = G.CARD_W,
        TITLE_TOP_H = G.CARD_H,
    }
    self.title_top = CardArea(
        0, 0,
        CAI.TITLE_TOP_W,CAI.TITLE_TOP_H,
        {card_limit = 1, type = 'title'})

    
    G.SPLASH_LOGO = Sprite(0, 0, 
        13*SC_scale, 
        13*SC_scale*(G.ASSET_ATLAS["balatro"].py/G.ASSET_ATLAS["balatro"].px),
        G.ASSET_ATLAS["balatro"], {x=0,y=0})

    G.SPLASH_LOGO:set_alignment({
        major = G.title_top,
        type = 'cm',
        bond = 'Strong',
        offset = {x=0,y=0}
    })
    G.SPLASH_LOGO:define_draw_steps({{
            shader = 'dissolve',
        }})

    G.SPLASH_LOGO.dissolve_colours = {G.C.WHITE, G.C.WHITE}
    G.SPLASH_LOGO.dissolve = 1   


    local replace_card = Card(self.title_top.T.x, self.title_top.T.y, 1.2*G.CARD_W*SC_scale, 1.2*G.CARD_H*SC_scale, G.P_CARDS.S_A, G.P_CENTERS.c_base)
    self.title_top:emplace(replace_card)

    replace_card.states.visible = false
    replace_card.no_ui = true
    replace_card.ambient_tilt = 0.0

    G.E_MANAGER:add_event(Event({
        trigger = 'after',
        delay = change_context == 'game' and 1.5 or 0,
        blockable = false,
        blocking = false,
        func = (function()
            if change_context == 'splash' then 
                replace_card.states.visible = true
                replace_card:start_materialize({G.C.WHITE,G.C.WHITE}, true, 2.5)
                play_sound('whoosh1', math.random()*0.1 + 0.3,0.3)
                play_sound('crumple'..math.random(1,5), math.random()*0.2 + 0.6,0.65)
            else
                replace_card.states.visible = true
                replace_card:start_materialize({G.C.WHITE,G.C.WHITE}, nil, 1.2)
            end
            G.VIBRATION = G.VIBRATION + 1
            return true
    end)}))

    G.E_MANAGER:add_event(Event({
        trigger = 'after',
        delay = change_context == 'splash' and 1.8 or change_context == 'game' and 2 or 0.5,
        blockable = false,
        blocking = false,
        func = (function()
            play_sound('magic_crumple'..(change_context == 'splash' and 2 or 3), (change_context == 'splash' and 1 or 1.3), 0.9)
            play_sound('whoosh1', 0.4, 0.8)
            ease_value(G.SPLASH_LOGO, 'dissolve', -1, nil, nil, nil, change_context == 'splash' and 2.3 or 0.9)
            G.VIBRATION = G.VIBRATION + 1.5
            return true
    end)}))

    delay(0.1 + (change_context == 'splash' and 2 or change_context == 'game' and 1.5 or 0))

    if replace_card and (G.P_CENTERS.j_blueprint.unlocked) then
        local viable_unlockables = {}
        for k, v in ipairs(self.P_LOCKED) do
            if (v.set == 'Voucher' or v.set == 'Joker') and not v.demo then 
                viable_unlockables[#viable_unlockables+1] = v
            end
        end
        if #viable_unlockables > 0 then 
            local card
            G.E_MANAGER:add_event(Event({
                trigger = 'after',
                delay = 4.04,
                func = (function()
                    card = Card(self.title_top.T.x, self.title_top.T.y, 1.2*G.CARD_W*SC_scale, 1.2*G.CARD_H*SC_scale, nil, pseudorandom_element(viable_unlockables) or self.P_CENTERS.j_joker)
                    card.no_ui = #viable_unlockables == 0
                    card.states.visible = false
                    replace_card.parent = nil
                    replace_card:start_dissolve({G.C.BLACK, G.C.ORANGE, G.C.RED, G.C.GOLD})
                    return true
            end)}))
            G.E_MANAGER:add_event(Event({
                trigger = 'after',
                delay = 1.04,
                func = (function()
                    card:start_materialize()
                    self.title_top:emplace(card)
                    return true
            end)}))
        end
    end

    G.E_MANAGER:add_event(Event({func = function() G.CONTROLLER.lock_input = false; return true end}))
    set_screen_positions()

    self.title_top:sort('order')
    self.title_top:set_ranks()
    self.title_top:align_cards()
    self.title_top:hard_set_cards()

    G.E_MANAGER:add_event(Event({
        trigger = 'after',
        delay = change_context == 'splash' and 4.05 or change_context == 'game' and 3 or 1.5,
        blockable = false,
        blocking = false,
        func = (function()
                set_main_menu_UI()
                return true
            end)
        }))

    --Do all career stat unlock checking here as well
    for k, v in pairs(G.PROFILES[G.SETTINGS.profile].career_stats) do
        check_for_unlock({type = 'career_stat', statname = k})
    end
    check_for_unlock({type = 'blind_discoveries'})

    G.E_MANAGER:add_event(Event({
        blockable = false,
        func = function()
            set_discover_tallies()
            set_profile_progress()
            G.REFRESH_ALERTS = true
        return true
        end
      }))

    --VERSION
    UIBox{
        definition = 
        {n=G.UIT.ROOT, config={align = "cm", colour = G.C.UI.TRANSPARENT_DARK}, nodes={
            {n=G.UIT.T, config={text = G.VERSION, scale = 0.3, colour = G.C.UI.TEXT_LIGHT}}
        }}, 
        config = {align="tri", offset = {x=0,y=0}, major = G.ROOM_ATTACH, bond = 'Weak'}
    }
end

function Game:demo_cta() --True if main menu is accessed from the splash screen, false if it is skipped or accessed from the game
    --G.TIMERS.REAL = 12
    --G.TIMERS.TOTAL = 12
    --Prepare the main menu, reset the default deck
    self:prep_stage(G.STAGES.MAIN_MENU, G.STATES.DEMO_CTA, true)

    self.GAME.selected_back = Back(G.P_CENTERS.b_red)

    G.FUNCS.change_shadows{to_key = G.SETTINGS.GRAPHICS.shadows == 'On' and 1 or 2}

    ease_background_colour{new_colour = G.C.BLACK, contrast = 1}

    if G.SPLASH_FRONT then G.SPLASH_FRONT:remove(); G.SPLASH_FRONT = nil end
    if G.SPLASH_BACK then G.SPLASH_BACK:remove(); G.SPLASH_BACK = nil end
    G.SPLASH_BACK = Sprite(-30, -13, G.ROOM.T.w+60, G.ROOM.T.h+22, G.ASSET_ATLAS["ui_1"], {x = 2, y = 0})
    G.SPLASH_BACK:set_alignment({
        major = G.ROOM_ATTACH,
        type = 'cm',
        offset = {x=0,y=0}
    })
    local splash_args = {mid_flash = 1.6}
    ease_value(splash_args, 'mid_flash', -1.6, nil, nil, nil, 4)

    G.SPLASH_BACK:define_draw_steps({{
        shader = 'splash',
        send = {
            {name = 'time', ref_table = G.TIMERS, ref_value = 'REAL_SHADER'},
            {name = 'vort_speed', val = 0.4},
            {name = 'colour_1', ref_table = G.C, ref_value = 'RED'},
            {name = 'colour_2', ref_table = G.C, ref_value = 'BLUE'},
            {name = 'mid_flash', ref_table = splash_args, ref_value = 'mid_flash'},
            {name = 'vort_offset', val = 0},
        }}})

    local SC_scale = 0.9*(G.debug_splash_size_toggle and 0.8 or 1)

    local CAI = {
        TITLE_TOP_W = G.CARD_W,
        TITLE_TOP_H = G.CARD_H,
    }
    self.title_top = CardArea(
        0, 0,
        CAI.TITLE_TOP_W,CAI.TITLE_TOP_H,
        {card_limit = 1, type = 'title'})

    
    G.SPLASH_LOGO = Sprite(0, 0, 
        13*SC_scale, 
        13*SC_scale*(G.ASSET_ATLAS["balatro"].py/G.ASSET_ATLAS["balatro"].px),
        G.ASSET_ATLAS["balatro"], {x=0,y=0})

    G.SPLASH_LOGO:set_alignment({
        major = G.title_top,
        type = 'cm',
        bond = 'Strong',
        offset = {x=0,y=0}
    })
    G.SPLASH_LOGO:define_draw_steps({{
            shader = 'dissolve',
        }})

    G.SPLASH_LOGO.dissolve_colours = {G.C.WHITE, G.C.WHITE}
    G.SPLASH_LOGO.dissolve = 1   

    local replace_card = Card(self.title_top.T.x, self.title_top.T.y, 1.2*G.CARD_W*SC_scale, 1.2*G.CARD_H*SC_scale, G.P_CARDS.S_A, G.P_CENTERS.c_base)
    self.title_top:emplace(replace_card)

    replace_card.states.visible = false
    replace_card.no_ui = true
    replace_card.ambient_tilt = 0.0

    G.E_MANAGER:add_event(Event({
        trigger = 'after',
        delay = 1.1,
        blockable = false,
        blocking = false,
        func = (function()
            replace_card.states.visible = true
            replace_card:start_materialize({G.C.WHITE,G.C.WHITE}, true, 2.5)
            play_sound('whoosh1', math.random()*0.1 + 0.3,0.3)
            play_sound('crumple'..math.random(1,5), math.random()*0.2 + 0.6,0.65)
            return true
    end)}))

    G.E_MANAGER:add_event(Event({
        trigger = 'after',
        delay = 1.8,
        blockable = false,
        blocking = false,
        func = (function()
            play_sound('magic_crumple'..(2), 1, 0.9)
            play_sound('whoosh1', 0.4, 0.8)
            ease_value(G.SPLASH_LOGO, 'dissolve', -1, nil, nil, nil, 2.3)
            return true
    end)}))

    delay(0.1 + 2)

    G.E_MANAGER:add_event(Event({func = function() G.CONTROLLER.lock_input = false; return true end}))
    set_screen_positions()

    self.title_top:sort('order')
    self.title_top:set_ranks()
    self.title_top:align_cards()
    self.title_top:hard_set_cards()

    local playstack = Sprite(0,0,1.7,1.7,G.ASSET_ATLAS["playstack_logo"], {x=0, y=0})
    playstack.states.drag.can = false
    local localthunk = Sprite(0,0,1*1390/560,1,G.ASSET_ATLAS["localthunk_logo"], {x=0, y=0})
    localthunk.states.drag.can = false

    self.MAIN_MENU_UI = UIBox{
        definition = {n=G.UIT.ROOT, config = {align = "cm",colour = G.C.CLEAR}, nodes={   
            {n=G.UIT.R, config={align = "cm", padding = 0.3}, nodes={
                {n=G.UIT.O, config={object = DynaText({string = {'Sign up for the next demo!'}, colours = {G.C.WHITE},shadow = true, rotate = true, float = true, bump = true, scale = 0.9, spacing = 1, pop_in = 4.5})}}
            }},
            {n=G.UIT.R, config={align = "cm", padding = 0.3}, nodes={
                {n=G.UIT.C, config={align = "cl", minw = 5, minh = 1}, nodes={
                    UIBox_button{button = 'go_to_menu', colour = G.C.ORANGE, minw = 2, minh = 1, label = {'BACK'}, scale = 0.4, col = true},
                }},
                UIBox_button{id = 'demo_cta_playbalatro', button = "go_to_playbalatro", colour = G.C.BLUE, minw = 7.65, minh = 1.95, label = {'PLAYBALATRO.COM'}, scale = 0.9, col = true},
                {n=G.UIT.C, config={align = "cr", minw = 5, minh = 1}, nodes={
                    {n=G.UIT.O, config={object = localthunk}},
                    {n=G.UIT.O, config={object = playstack}},
                }}
            }}
        }}, 
        config = {align="bmi", offset = {x=0,y=10}, major = G.ROOM_ATTACH, bond = 'Weak'}
    }
    self.MAIN_MENU_UI.states.visible = false
    
    G.E_MANAGER:add_event(Event({
        trigger = 'after',
        delay = 4.05,
        blockable = false,
        blocking = false,
        func = (function()
                self.MAIN_MENU_UI.states.visible = true
                self.MAIN_MENU_UI.alignment.offset.y = 0
                self.MAIN_MENU_UI:align_to_major()
                G.CONTROLLER:snap_to{node = self.MAIN_MENU_UI:get_UIE_by_ID('demo_cta_playbalatro')}
                return true
            end)
        }))
end

function Game:init_game_object()
    local bosses_used = {}
    for k, v in pairs(G.P_BLINDS) do 
        if v.boss then bosses_used[k] = 0 end
    end
    return {
        won = false,
        round_scores = {
            furthest_ante = {label = 'Ante', amt = 0},
            furthest_round = {label = 'Round', amt = 0},
            hand = {label = 'Best Hand', amt = 0},
            poker_hand = {label = 'Most Played Hand', amt = 0},
            new_collection = {label = 'New Discoveries', amt = 0},
            cards_played = {label = 'Cards Played', amt = 0},
            cards_discarded = {label = 'Cards Discarded', amt = 0},
            times_rerolled = {label = 'Times Rerolled', amt = 0},
            cards_purchased = {label = 'Cards Purchased', amt = 0},
        },
        joker_usage = {},
        consumeable_usage = {},
        hand_usage = {},
        last_tarot_planet = nil,
        win_ante = 8,
        stake = 1,
        modifiers = {},
        starting_params = get_starting_params(),
        banned_keys = {},
        round = 0,
        probabilities = {
            normal = 1,
        },
        bosses_used = bosses_used,
        pseudorandom = {},
        starting_deck_size = 52,
        ecto_minus = 1,
        pack_size = 2,
        skips = 0,
        STOP_USE = 0,
        edition_rate = 1,
        joker_rate = 20,
        tarot_rate = 4,
        planet_rate = 4, 
        spectral_rate = 0,
        playing_card_rate = 0,
        consumeable_buffer = 0,
        joker_buffer = 0,
        discount_percent = 0,
        interest_cap = 25,
        interest_amount = 1,
        inflation = 0,
        hands_played = 0,
        unused_discards = 0,
        perishable_rounds = 5,
        rental_rate = 3,
        blind =  nil,
        chips = 0,
        chips_text = '0',
        voucher_text = '',
        dollars = 0,
        max_jokers = 0,
        bankrupt_at = 0,
        current_boss_streak = 0,
        base_reroll_cost = 5,
        blind_on_deck = nil,
        sort = 'desc',
        previous_round = {
            dollars = 4
        },
        tags = {},
        tag_tally = 0,
        pool_flags = {},
        used_jokers = {},
        used_vouchers = {},
        current_round = {
            current_hand = {
                chips = 0,
                chip_text = '0',
                mult = 0,
                mult_text = '0',
                chip_total = 0,
                chip_total_text = '',
                handname = "",
                hand_level = ''
            },
            used_packs = {},
            cards_flipped = 0,
            round_text = 'Round ',
            idol_card = {suit = 'Spades', rank = 'Ace'},
            mail_card = {rank = 'Ace'},
            ancient_card = {suit = 'Spades'},
            castle_card = {suit = 'Spades'},
            hands_left = 0,
            hands_played = 0,
            discards_left = 0,
            discards_used = 0,
            dollars = 0,
            reroll_cost = 5,
            reroll_cost_increase = 0,
            jokers_purchased = 0,
            free_rerolls = 0,
            round_dollars = 0,
            dollars_to_be_earned = '!!!',
            most_played_poker_hand = 'High Card',
        },
        round_resets = {
            hands = 1, 
            discards = 1,
            reroll_cost = 1,
            temp_reroll_cost = nil,
            temp_handsize = nil,
            ante = 1,
            blind_ante = 1,
            blind_states = {Small = 'Select', Big = 'Upcoming', Boss = 'Upcoming'},
            loc_blind_states = {Small = '', Big = '', Boss = ''},
            blind_choices = {Small = 'bl_small', Big = 'bl_big'},
            boss_rerolled = false,
        },
        round_bonus = {
            next_hands = 0,
            discards = 0,
        },
        shop = {
            joker_max = 2,
        },
        cards_played = {
            ['Ace'] = {suits = {}, total = 0},
            ['2'] = {suits = {}, total = 0},
            ['3'] = {suits = {}, total = 0},
            ['4'] = {suits = {}, total = 0},
            ['5'] = {suits = {}, total = 0},
            ['6'] = {suits = {}, total = 0},
            ['7'] = {suits = {}, total = 0},
            ['8'] = {suits = {}, total = 0},
            ['9'] = {suits = {}, total = 0},
            ['10'] = {suits = {}, total = 0},
            ['Jack'] = {suits = {}, total = 0},
            ['Queen'] = {suits = {}, total = 0},
            ['King'] = {suits = {}, total = 0},
        },
        hands = {
            ["Flush Five"] =        {visible = false,   order = 1, mult = 16,  chips = 160, s_mult = 16,  s_chips = 160, level = 1, l_mult = 3, l_chips = 50, played = 0, played_this_round = 0, example = {{'S_A', true},{'S_A', true},{'S_A', true},{'S_A', true},{'S_A', true}}},
            ["Flush House"] =       {visible = false,   order = 2, mult = 14,  chips = 140, s_mult = 14,  s_chips = 140, level = 1, l_mult = 4, l_chips = 40, played = 0, played_this_round = 0, example = {{'D_7', true},{'D_7', true},{'D_7', true},{'D_4', true},{'D_4', true}}},
            ["Five of a Kind"] =    {visible = false,   order = 3, mult = 12,  chips = 120, s_mult = 12,  s_chips = 120, level = 1, l_mult = 3, l_chips = 35, played = 0, played_this_round = 0, example = {{'S_A', true},{'H_A', true},{'H_A', true},{'C_A', true},{'D_A', true}}},
            ["Straight Flush"] =    {visible = true,    order = 4, mult = 8,   chips = 100, s_mult = 8,   s_chips = 100, level = 1, l_mult = 4, l_chips = 40, played = 0, played_this_round = 0, example = {{'S_Q', true},{'S_J', true},{'S_T', true},{'S_9', true},{'S_8', true}}},
            ["Four of a Kind"] =    {visible = true,    order = 5, mult = 7,   chips = 60,  s_mult = 7,   s_chips = 60,  level = 1, l_mult = 3, l_chips = 30, played = 0, played_this_round = 0, example = {{'S_J', true},{'H_J', true},{'C_J', true},{'D_J', true},{'C_3', false}}},
            ["Full House"] =        {visible = true,    order = 6, mult = 4,   chips = 40,  s_mult = 4,   s_chips = 40,  level = 1, l_mult = 2, l_chips = 25, played = 0, played_this_round = 0, example = {{'H_K', true},{'C_K', true},{'D_K', true},{'S_2', true},{'D_2', true}}},
            ["Flush"] =             {visible = true,    order = 7, mult = 4,   chips = 35,  s_mult = 4,   s_chips = 35,  level = 1, l_mult = 2, l_chips = 15, played = 0, played_this_round = 0, example = {{'H_A', true},{'H_K', true},{'H_T', true},{'H_5', true},{'H_4', true}}},
            ["Straight"] =          {visible = true,    order = 8, mult = 4,   chips = 30,  s_mult = 4,   s_chips = 30,  level = 1, l_mult = 3, l_chips = 30, played = 0, played_this_round = 0, example = {{'D_J', true},{'C_T', true},{'C_9', true},{'S_8', true},{'H_7', true}}},
            ["Three of a Kind"] =   {visible = true,    order = 9, mult = 3,   chips = 30,  s_mult = 3,   s_chips = 30,  level = 1, l_mult = 2, l_chips = 20, played = 0, played_this_round = 0, example = {{'S_T', true},{'C_T', true},{'D_T', true},{'H_6', false},{'D_5', false}}},
            ["Two Pair"] =          {visible = true,    order = 10,mult = 2,   chips = 20,  s_mult = 2,   s_chips = 20,  level = 1, l_mult = 1, l_chips = 20, played = 0, played_this_round = 0, example = {{'H_A', true},{'D_A', true},{'C_Q', false},{'H_4', true},{'C_4', true}}},
            ["Pair"] =              {visible = true,    order = 11,mult = 2,   chips = 10,  s_mult = 2,   s_chips = 10,  level = 1, l_mult = 1, l_chips = 15, played = 0, played_this_round = 0, example = {{'S_K', false},{'S_9', true},{'D_9', true},{'H_6', false},{'D_3', false}}},
            ["High Card"] =         {visible = true,    order = 12,mult = 1,   chips = 5,   s_mult = 1,   s_chips = 5,   level = 1, l_mult = 1, l_chips = 10, played = 0, played_this_round = 0, example = {{'S_A', true},{'D_Q', false},{'D_9', false},{'C_4', false},{'D_3', false}}},
        }
    }
end

function Game:start_run(args)
    args = args or {}

    local saveTable = args.savetext or nil
    G.SAVED_GAME = nil

    self:prep_stage(G.STAGES.RUN, saveTable and saveTable.STATE or G.STATES.BLIND_SELECT)
    
    G.STAGE = G.STAGES.RUN
    if saveTable then 
        check_for_unlock({type = 'continue_game'})
    end

    G.STATE_COMPLETE = false
    G.RESET_BLIND_STATES = true

    if not saveTable then ease_background_colour_blind(G.STATE, 'Small Blind')
    else ease_background_colour_blind(G.STATE, saveTable.BLIND.name:gsub("%s+", "") ~= '' and saveTable.BLIND.name or 'Small Blind') end

    local selected_back = saveTable and saveTable.BACK.name or (args.challenge and args.challenge.deck and args.challenge.deck.type) or (self.GAME.viewed_back and self.GAME.viewed_back.name) or self.GAME.selected_back and self.GAME.selected_back.name or 'Red Deck'
    selected_back = get_deck_from_name(selected_back)
    self.GAME = saveTable and saveTable.GAME or self:init_game_object()
    self.GAME.modifiers = self.GAME.modifiers or {}
    self.GAME.stake = args.stake or self.GAME.stake or 1
    self.GAME.STOP_USE = 0
    self.GAME.selected_back = Back(selected_back)
    self.GAME.selected_back_key = selected_back

    G.C.UI_CHIPS[1], G.C.UI_CHIPS[2], G.C.UI_CHIPS[3], G.C.UI_CHIPS[4] = G.C.BLUE[1], G.C.BLUE[2], G.C.BLUE[3], G.C.BLUE[4]
    G.C.UI_MULT[1], G.C.UI_MULT[2], G.C.UI_MULT[3], G.C.UI_MULT[4] = G.C.RED[1], G.C.RED[2], G.C.RED[3], G.C.RED[4]

    if not saveTable then 
        if self.GAME.stake >= 2 then 
            self.GAME.modifiers.no_blind_reward = self.GAME.modifiers.no_blind_reward or {}
            self.GAME.modifiers.no_blind_reward.Small = true
        end
        if self.GAME.stake >= 3 then self.GAME.modifiers.scaling = 2 end
        if self.GAME.stake >= 4 then self.GAME.modifiers.enable_eternals_in_shop = true end
        if self.GAME.stake >= 5 then self.GAME.starting_params.discards = self.GAME.starting_params.discards - 1 end
        if self.GAME.stake >= 6 then self.GAME.modifiers.scaling = 3 end
        if self.GAME.stake >= 7 then self.GAME.modifiers.enable_perishables_in_shop = true end
        if self.GAME.stake >= 8 then self.GAME.modifiers.enable_rentals_in_shop = true end

        self.GAME.selected_back:apply_to_run()

        if args.challenge then
            self.GAME.challenge = args.challenge.id
            self.GAME.challenge_tab = args.challenge
            local _ch = args.challenge
            if _ch.jokers then
                for k, v in ipairs(_ch.jokers) do
                    G.E_MANAGER:add_event(Event({
                        func = function()
                            local _joker = add_joker(v.id, v.edition, k ~= 1)
                            if v.eternal then _joker:set_eternal(true) end
                            if v.pinned then _joker.pinned = true end
                        return true
                        end
                    }))
                end
            end
            if _ch.consumeables then
                for k, v in ipairs(_ch.consumeables) do
                    G.E_MANAGER:add_event(Event({
                        func = function()
                            add_joker(v.id, nil, k ~= 1)
                        return true
                        end
                    }))
                end
            end
            if _ch.vouchers then
                for k, v in ipairs(_ch.vouchers) do
                    G.GAME.used_vouchers[v.id] = true
                    G.E_MANAGER:add_event(Event({
                        func = function()
                            G.GAME.starting_voucher_count = (G.GAME.starting_voucher_count or 0) + 1
                            Card.apply_to_run(nil, G.P_CENTERS[v.id])
                        return true
                        end
                    }))
                end
            end
            if _ch.rules then
                if _ch.rules.modifiers then
                    for k, v in ipairs(_ch.rules.modifiers) do
                        self.GAME.starting_params[v.id] = v.value
                    end
                end
                if _ch.rules.custom then
                    for k, v in ipairs(_ch.rules.custom) do
                        if v.id == 'no_reward' then 
                            self.GAME.modifiers.no_blind_reward = self.GAME.modifiers.no_blind_reward or {}
                            self.GAME.modifiers.no_blind_reward.Small = true
                            self.GAME.modifiers.no_blind_reward.Big = true
                            self.GAME.modifiers.no_blind_reward.Boss = true
                        elseif v.id == 'no_reward_specific' then
                            self.GAME.modifiers.no_blind_reward = self.GAME.modifiers.no_blind_reward or {}
                            self.GAME.modifiers.no_blind_reward[v.value] = true
                        elseif v.value then
                            self.GAME.modifiers[v.id] = v.value
                        elseif v.id == 'no_shop_jokers' then 
                            self.GAME.joker_rate = 0
                        else
                            self.GAME.modifiers[v.id] = true 
                        end
                    end
                end
            end
            if _ch.restrictions then
                if _ch.restrictions.banned_cards then
                    for k, v in ipairs(_ch.restrictions.banned_cards) do
                        G.GAME.banned_keys[v.id] = true
                        if v.ids then
                            for kk, vv in ipairs(v.ids) do
                                G.GAME.banned_keys[vv] = true
                            end
                        end
                    end
                end
                if _ch.restrictions.banned_tags then
                    for k, v in ipairs(_ch.restrictions.banned_tags) do
                        G.GAME.banned_keys[v.id] = true
                    end
                end
                if _ch.restrictions.banned_other then
                    for k, v in ipairs(_ch.restrictions.banned_other) do
                        G.GAME.banned_keys[v.id] = true
                    end
                end
            end
        end

        self.GAME.round_resets.hands = self.GAME.starting_params.hands
        self.GAME.round_resets.discards = self.GAME.starting_params.discards
        self.GAME.round_resets.reroll_cost = self.GAME.starting_params.reroll_cost
        self.GAME.dollars = self.GAME.starting_params.dollars
        self.GAME.base_reroll_cost = self.GAME.starting_params.reroll_cost
        self.GAME.round_resets.reroll_cost = self.GAME.base_reroll_cost
        self.GAME.current_round.reroll_cost = self.GAME.base_reroll_cost
    end

    G.GAME.chips_text = ''

    if not saveTable then
        if args.seed then self.GAME.seeded = true end
        self.GAME.pseudorandom.seed = args.seed or (not (G.SETTINGS.tutorial_complete or G.SETTINGS.tutorial_progress.completed_parts['big_blind']) and "TUTORIAL") or generate_starting_seed()
    end

    for k, v in pairs(self.GAME.pseudorandom) do if v == 0 then self.GAME.pseudorandom[k] = pseudohash(k..self.GAME.pseudorandom.seed) end end
    self.GAME.pseudorandom.hashed_seed = pseudohash(self.GAME.pseudorandom.seed)

    G:save_settings()

    if not self.GAME.round_resets.blind_tags then
        self.GAME.round_resets.blind_tags = {}
    end

    if not saveTable then
        self.GAME.round_resets.blind_choices.Boss = get_new_boss()
        self.GAME.current_round.voucher = G.SETTINGS.tutorial_progress and G.SETTINGS.tutorial_progress.forced_voucher or get_next_voucher_key()
        self.GAME.round_resets.blind_tags.Small = G.SETTINGS.tutorial_progress and G.SETTINGS.tutorial_progress.forced_tags and G.SETTINGS.tutorial_progress.forced_tags[1] or get_next_tag_key()
        self.GAME.round_resets.blind_tags.Big = G.SETTINGS.tutorial_progress and G.SETTINGS.tutorial_progress.forced_tags and G.SETTINGS.tutorial_progress.forced_tags[2] or get_next_tag_key()
    else
        if self.GAME.round_resets.blind and self.GAME.round_resets.blind.key then 
            self.GAME.round_resets.blind = G.P_BLINDS[self.GAME.round_resets.blind.key]
        end
    end
    G.CONTROLLER.locks.load = true
    G.E_MANAGER:add_event(Event({
        no_delete = true,
        trigger = 'after',
        blocking = false,blockable = false,
        delay = 3.5,
        timer = 'TOTAL',
        func = function()
            G.CONTROLLER.locks.load = nil
          return true
        end
      }))

    if saveTable and saveTable.ACTION then
        G.E_MANAGER:add_event(Event({delay = 0.5, trigger = 'after', blocking = false,blockable = false,func = (function() 
            G.E_MANAGER:add_event(Event({func = (function() 
                G.E_MANAGER:add_event(Event({func = (function() 
                    for k, v in pairs(G.I.CARD) do
                        if v.sort_id == saveTable.ACTION.card then
                            G.FUNCS.use_card({config = {ref_table = v}}, nil, true)
                        end
                    end
                            return true
                        end)
                    }))
                        return true
                    end)
                }))
                return true
            end)
        }))
    end

    local CAI = {
        discard_W = G.CARD_W,
        discard_H = G.CARD_H,
        deck_W = G.CARD_W*1.1,
        deck_H = 0.95*G.CARD_H,
        hand_W = 6*G.CARD_W,
        hand_H = 0.95*G.CARD_H,
        play_W = 5.3*G.CARD_W,
        play_H = 0.95*G.CARD_H,
        joker_W = 4.9*G.CARD_W,
        joker_H = 0.95*G.CARD_H,
        consumeable_W = 2.3*G.CARD_W,
        consumeable_H = 0.95*G.CARD_H
    }


    self.consumeables = CardArea(
        0, 0,
        CAI.consumeable_W,
        CAI.consumeable_H, 
        {card_limit = self.GAME.starting_params.consumable_slots, type = 'joker', highlight_limit = 1})

    self.jokers = CardArea(
        0, 0,
        CAI.joker_W,
        CAI.joker_H, 
        {card_limit = self.GAME.starting_params.joker_slots, type = 'joker', highlight_limit = 1})

    self.discard = CardArea(
        0, 0,
        CAI.discard_W,CAI.discard_H,
        {card_limit = 500, type = 'discard'})
    self.deck = CardArea(
        0, 0,
        CAI.deck_W,CAI.deck_H, 
        {card_limit = 52, type = 'deck'})
    self.hand = CardArea(
        0, 0,
        CAI.hand_W,CAI.hand_H, 
        {card_limit = self.GAME.starting_params.hand_size, type = 'hand'})
    self.play = CardArea(
        0, 0,
        CAI.play_W,CAI.play_H, 
        {card_limit = 5, type = 'play'})
    
    G.playing_cards = {}

    set_screen_positions()

    G.SPLASH_BACK = Sprite(-30, -6, G.ROOM.T.w+60, G.ROOM.T.h+12, G.ASSET_ATLAS["ui_1"], {x = 2, y = 0})
    G.SPLASH_BACK:set_alignment({
        major = G.play,
        type = 'cm',
        bond = 'Strong',
        offset = {x=0,y=0}
    })

    G.ARGS.spin = {
        amount = 0,
        real = 0,
        eased = 0
    }

    G.SPLASH_BACK:define_draw_steps({{
        shader = 'background',
        send = {
            {name = 'time', ref_table = G.TIMERS, ref_value = 'REAL_SHADER'},
            {name = 'spin_time', ref_table = G.TIMERS, ref_value = 'BACKGROUND'},
            {name = 'colour_1', ref_table = G.C.BACKGROUND, ref_value = 'C'},
            {name = 'colour_2', ref_table = G.C.BACKGROUND, ref_value = 'L'},
            {name = 'colour_3', ref_table = G.C.BACKGROUND, ref_value = 'D'},
            {name = 'contrast', ref_table = G.C.BACKGROUND, ref_value = 'contrast'},
            {name = 'spin_amount', ref_table = G.ARGS.spin, ref_value = 'amount'}
        }}})
    
    G.E_MANAGER:add_event(Event({
        trigger = 'immediate',
        blocking = false,
        blockable = false,
        func = (function() 
            local _dt = G.ARGS.spin.amount > G.ARGS.spin.eased and G.real_dt*2. or 0.3*G.real_dt
            local delta = G.ARGS.spin.real - G.ARGS.spin.eased
            if math.abs(delta) > _dt then delta = delta*_dt/math.abs(delta) end
            G.ARGS.spin.eased = G.ARGS.spin.eased + delta
            G.ARGS.spin.amount = _dt*(G.ARGS.spin.eased) + (1 - _dt)*G.ARGS.spin.amount
            G.TIMERS.BACKGROUND = G.TIMERS.BACKGROUND - 60*(G.ARGS.spin.eased - G.ARGS.spin.amount)*_dt
        end)
    }))

    if saveTable then 
        local cardAreas = saveTable.cardAreas
        for k, v in pairs(cardAreas) do
            if G[k] then G[k]:load(v)
            else
            G['load_'..k] = v
            print("ERROR LOADING GAME: Card area '"..k.."' not instantiated before load") end
        end

        for k, v in pairs(G.I.CARD) do
            if v.playing_card then
                table.insert(G.playing_cards, v)
            end
        end
        for k, v in pairs(G.I.CARDAREA) do
            v:align_cards()
            v:hard_set_cards()
        end
        table.sort(G.playing_cards, function (a, b) return a.playing_card > b.playing_card end )
    else
        local card_protos = nil
        local _de = nil
        if args.challenge and args.challenge.deck then
            _de = args.challenge.deck
        end

        if _de and _de.cards then
            card_protos = _de.cards
        end

        if not card_protos then 
            card_protos = {}
            for k, v in pairs(self.P_CARDS) do
                local _ = nil
                if self.GAME.starting_params.erratic_suits_and_ranks then _, k = pseudorandom_element(G.P_CARDS, pseudoseed('erratic')) end
                local _r, _s = string.sub(k, 3, 3), string.sub(k, 1, 1)
                local keep, _e, _d, _g = true, nil, nil, nil
                if _de then
                    if _de.yes_ranks and not _de.yes_ranks[_r] then keep = false end
                    if _de.no_ranks and _de.no_ranks[_r] then keep = false end
                    if _de.yes_suits and not _de.yes_suits[_s] then keep = false end
                    if _de.no_suits and _de.no_suits[_s] then keep = false end
                    if _de.enhancement then _e = _de.enhancement end
                    if _de.edition then _d = _de.edition end
                    if _de.gold_seal then _g = _de.gold_seal end
                end

                if self.GAME.starting_params.no_faces and (_r == 'K' or _r == 'Q' or _r == 'J') then keep = false end
                
                if keep then card_protos[#card_protos+1] = {s=_s,r=_r,e=_e,d=_d,g=_g} end
            end
        end 

        if self.GAME.starting_params.extra_cards then 
            for k, v in pairs(self.GAME.starting_params.extra_cards) do
                card_protos[#card_protos+1] = v
            end
        end

        table.sort(card_protos, function (a, b) return 
            ((a.s or '')..(a.r or '')..(a.e or '')..(a.d or '')..(a.g or '')) < 
            ((b.s or '')..(b.r or '')..(b.e or '')..(b.d or '')..(b.g or '')) end)

        for k, v in ipairs(card_protos) do
            card_from_control(v)
        end

        self.GAME.starting_deck_size = #G.playing_cards
    end

    delay(0.5)

    if not saveTable then
        G.GAME.current_round.discards_left = G.GAME.round_resets.discards
        G.GAME.current_round.hands_left = G.GAME.round_resets.hands
        self.deck:shuffle()
        self.deck:hard_set_T()
        reset_idol_card()
        reset_mail_rank()
        self.GAME.current_round.ancient_card.suit = nil
        reset_ancient_card()
        reset_castle_card()
    end

    G.GAME.blind = Blind(0,0,2, 1)
    self.deck:align_cards()
    self.deck:hard_set_cards()
    
    self.HUD = UIBox{
        definition = create_UIBox_HUD(),
        config = {align=('cli'), offset = {x=-0.7,y=0},major = G.ROOM_ATTACH}
    }
    self.HUD_blind = UIBox{
        definition = create_UIBox_HUD_blind(),
        config = {major = G.HUD:get_UIE_by_ID('row_blind'), align = 'cm', offset = {x=0,y=-10}, bond = 'Weak'}
    }
    self.HUD_tags = {}

    G.hand_text_area = {
        chips = self.HUD:get_UIE_by_ID('hand_chips'),
        mult = self.HUD:get_UIE_by_ID('hand_mult'),
        ante = self.HUD:get_UIE_by_ID('ante_UI_count'),
        round = self.HUD:get_UIE_by_ID('round_UI_count'),
        chip_total = self.HUD:get_UIE_by_ID('hand_chip_total'),
        handname = self.HUD:get_UIE_by_ID('hand_name'),
        hand_level = self.HUD:get_UIE_by_ID('hand_level'),
        game_chips = self.HUD:get_UIE_by_ID('chip_UI_count'),
        blind_chips = self.HUD_blind:get_UIE_by_ID('HUD_blind_count'),
        blind_spacer = self.HUD:get_UIE_by_ID('blind_spacer')
    }

    check_and_set_high_score('most_money', G.GAME.dollars)

    if saveTable then 
        G.GAME.blind:load(saveTable.BLIND)
        G.GAME.tags = {}
        local tags = saveTable.tags or {}
        for k, v in ipairs(tags) do
            local _tag = Tag('tag_uncommon')
            _tag:load(v)
            add_tag(_tag)
        end
    else
        G.GAME.blind:set_blind(nil, nil, true)
        reset_blinds()
    end

    G.FUNCS.blind_chip_UI_scale(G.hand_text_area.blind_chips)
     
    self.HUD:recalculate()

    G.E_MANAGER:add_event(Event({
        trigger = 'immediate',
        func = (function()
            unlock_notify()
            return true
        end)
      }))
    
end

function Game:update(dt)
    nuGC(nil, nil, true)

    G.MAJORS = 0
    G.MINORS = 0

    G.FRAMES.MOVE = G.FRAMES.MOVE + 1
                timer_checkpoint('start->discovery', 'update')
    if not G.SETTINGS.tutorial_complete then G.FUNCS.tutorial_controller() end
                timer_checkpoint('tallies', 'update')
    modulate_sound(dt)
                timer_checkpoint('sounds', 'update')
    update_canvas_juice(dt)
                timer_checkpoint('canvas and juice', 'update')
    --Smooth out the dts to avoid any big jumps
    self.TIMERS.REAL = self.TIMERS.REAL + dt
    self.TIMERS.REAL_SHADER = G.SETTINGS.reduced_motion and 300 or self.TIMERS.REAL
    self.TIMERS.UPTIME = self.TIMERS.UPTIME + dt
    self.SETTINGS.DEMO.total_uptime = (self.SETTINGS.DEMO.total_uptime or 0) + dt
    self.TIMERS.BACKGROUND = self.TIMERS.BACKGROUND + dt*(G.ARGS.spin and G.ARGS.spin.amount or 0)
    self.real_dt = dt

    if self.real_dt > 0.05 then print('LONG DT @ '..math.floor(G.TIMERS.REAL)..': '..self.real_dt) end
    if not G.fbf or G.new_frame then
        G.new_frame = false

    set_alerts()
                timer_checkpoint('alerts', 'update')

    local http_resp = G.HTTP_MANAGER.in_channel:pop()
    if http_resp then
        G.ARGS.HIGH_SCORE_RESPONSE = http_resp
    end


    if G.SETTINGS.paused then dt = 0 end

        if G.STATE ~= G.ACC_state then G.ACC = 0 end
        G.ACC_state = G.STATE

        if (G.STATE == G.STATES.HAND_PLAYED) or (G.STATE == G.STATES.NEW_ROUND) then 
            G.ACC = math.min((G.ACC or 0) + dt*0.2*self.SETTINGS.GAMESPEED, 16)
        else
            G.ACC = 0
        end

        self.SPEEDFACTOR = (G.STAGE == G.STAGES.RUN and not G.SETTINGS.paused and not G.screenwipe) and self.SETTINGS.GAMESPEED or 1
        self.SPEEDFACTOR = self.SPEEDFACTOR + math.max(0, math.abs(G.ACC) - 2)

        self.TIMERS.TOTAL = self.TIMERS.TOTAL + dt*(self.SPEEDFACTOR)

        self.C.DARK_EDITION[1] = 0.6+0.2*math.sin(self.TIMERS.REAL*1.3)
        self.C.DARK_EDITION[3] = 0.6+0.2*(1- math.sin(self.TIMERS.REAL*1.3))
        self.C.DARK_EDITION[2] = math.min(self.C.DARK_EDITION[3], self.C.DARK_EDITION[1])

        self.C.EDITION[1] = 0.7+0.2*(1+math.sin(self.TIMERS.REAL*1.5 + 0))
        self.C.EDITION[3] = 0.7+0.2*(1+math.sin(self.TIMERS.REAL*1.5 + 3))
        self.C.EDITION[2] = 0.7+0.2*(1+math.sin(self.TIMERS.REAL*1.5 + 6))

        
        self.E_MANAGER:update(self.real_dt)
                    timer_checkpoint('e_manager', 'update')

        if G.GAME.blind and G.boss_throw_hand and self.STATE == self.STATES.SELECTING_HAND then
            if not self.boss_warning_text then 
                self.boss_warning_text = UIBox{
                    definition = 
                      {n=G.UIT.ROOT, config = {align = 'cm', colour = G.C.CLEAR, padding = 0.2}, nodes={
                        {n=G.UIT.R, config = {align = 'cm', maxw = 1}, nodes={
                            {n=G.UIT.O, config={object = DynaText({scale = 0.7, string = localize('ph_unscored_hand'), maxw = 9, colours = {G.C.WHITE},float = true, shadow = true, silent = true, pop_in = 0, pop_in_rate = 6})}},
                        }},
                        {n=G.UIT.R, config = {align = 'cm', maxw = 1}, nodes={
                            {n=G.UIT.O, config={object = DynaText({scale = 0.6, string = G.GAME.blind:get_loc_debuff_text(), maxw = 9, colours = {G.C.WHITE},float = true, shadow = true, silent = true, pop_in = 0, pop_in_rate = 6})}},
                        }}
                    }}, 
                    config = {
                        align = 'cm',
                        offset ={x=0,y=-3.1}, 
                        major = G.play,
                      }
                  }
                  self.boss_warning_text.attention_text = true
                  self.boss_warning_text.states.collide.can = false
                  G.GAME.blind.children.animatedSprite:juice_up(0.05, 0.02)
                  play_sound('chips1', math.random()*0.1 + 0.55, 0.12)
            end
        else
            G.boss_throw_hand = nil
            if self.boss_warning_text then 
                self.boss_warning_text:remove()
                self.boss_warning_text = nil
            end
        end


        if self.STATE == self.STATES.SELECTING_HAND then
            if (not G.hand.cards[1]) and G.deck.cards[1] then 
                G.STATE = G.STATES.DRAW_TO_HAND
                G.STATE_COMPLETE = false
            else
                self:update_selecting_hand(dt)
            end
        end

        if self.STATE == self.STATES.SHOP then 
            self:update_shop(dt)
        end

        if self.STATE == self.STATES.PLAY_TAROT then 
            self:update_play_tarot(dt)
        end

        if self.STATE == self.STATES.HAND_PLAYED then 
            self:update_hand_played(dt)
        end

        if self.STATE == self.STATES.DRAW_TO_HAND then 
            self:update_draw_to_hand(dt)
        end

        if self.STATE == self.STATES.NEW_ROUND then
            self:update_new_round(dt)
        end

        if self.STATE == self.STATES.BLIND_SELECT then
            self:update_blind_select(dt)
        end

        if self.STATE == self.STATES.ROUND_EVAL then
            self:update_round_eval(dt)
        end

        if self.STATE == self.STATES.TAROT_PACK then
            self:update_arcana_pack(dt)
        end

        if self.STATE == self.STATES.SPECTRAL_PACK then
            self:update_spectral_pack(dt)
        end

        if self.STATE == self.STATES.STANDARD_PACK then
            self:update_standard_pack(dt)
        end

        if self.STATE == self.STATES.BUFFOON_PACK then
            self:update_buffoon_pack(dt)
        end

        if self.STATE == self.STATES.PLANET_PACK then
            self:update_celestial_pack(dt)
        end

        if self.STATE == self.STATES.GAME_OVER then
            self:update_game_over(dt)
        end

        if self.STATE == self.STATES.MENU then
            self:update_menu(dt)
        end
                    timer_checkpoint('states', 'update')
        --animate all animated objects
        remove_nils(self.ANIMATIONS)

        for k, v in pairs(self.ANIMATIONS) do
            v:animate(self.real_dt*self.SPEEDFACTOR)
        end
                    timer_checkpoint('animate', 'update')

        --move and update all other moveables
        G.exp_times.xy = math.exp(-50*self.real_dt)
        G.exp_times.scale = math.exp(-60*self.real_dt)
        G.exp_times.r = math.exp(-190*self.real_dt)
        
        local move_dt = math.min(1/20, self.real_dt)

        G.exp_times.max_vel = 70*move_dt
        
        for k, v in pairs(self.MOVEABLES) do
            if v.FRAME.MOVE < G.FRAMES.MOVE then v:move(move_dt) end
        end
                    timer_checkpoint('move', 'update')
        
        for k, v in pairs(self.MOVEABLES) do
            v:update(dt*self.SPEEDFACTOR)
            v.states.collide.is = false
        end
                    timer_checkpoint('update', 'update')
    end
    
    self.CONTROLLER:update(self.real_dt) 

    --update loc strings if needed
    if G.prev_small_state ~= G.GAME.round_resets.blind_states.Small or
    G.prev_large_state ~= G.GAME.round_resets.blind_states.Big or
    G.prev_boss_state ~= G.GAME.round_resets.blind_states.Boss or G.RESET_BLIND_STATES then 
        G.RESET_BLIND_STATES = nil
        G.prev_small_state = G.GAME.round_resets.blind_states.Small
        G.prev_large_state = G.GAME.round_resets.blind_states.Big
        G.prev_boss_state = G.GAME.round_resets.blind_states.Boss
        G.GAME.round_resets.loc_blind_states.Small = localize(G.GAME.round_resets.blind_states.Small,'blind_states')
        G.GAME.round_resets.loc_blind_states.Big = localize(G.GAME.round_resets.blind_states.Big,'blind_states')
        G.GAME.round_resets.loc_blind_states.Boss = localize(G.GAME.round_resets.blind_states.Boss,'blind_states')
    end

    --Send all steam updates if needed
    if G.STEAM and G.STEAM.send_control.update_queued and (
        G.STEAM.send_control.force or 
        G.STEAM.send_control.last_sent_stage ~= G.STAGE or
        G.STEAM.send_control.last_sent_time < G.TIMERS.UPTIME - 120) then 
        if G.STEAM.userStats.storeStats() then
            G.STEAM.send_control.force = false
            G.STEAM.send_control.last_sent_stage = G.STAGE
            G.STEAM.send_control.last_sent_time = G.TIMERS.UPTIME
            G.STEAM.send_control.update_queued = false
        else
            G.DEBUG_VALUE = 'UNABLE TO STORE STEAM STATS'
        end
    end    


    if G.DEBUG then 
        local text_count,uie_count, card_count, uib_count, all = 0,0, 0, 0,0
        for k, v in pairs(G.STAGE_OBJECTS[G.STAGE]) do
            all = all + 1
            if v:is(DynaText) then text_count = text_count + 1 end
            if v:is(Card) then card_count = card_count + 1 end
            if v:is(UIElement) then uie_count = uie_count + 1 end
            if v:is(UIBox) then uib_count = uib_count + 1 end
        end

            G.DEBUG_VALUE = 'text: '..text_count..'\n'..
                            'uie: '..uie_count..'\n'..
                            'card: '..card_count..'\n'..
                            'uib: '..uib_count..'\n'..'all: '..all
    end
    
    --Save every 10 seconds, unless forced or paused/unpaused
    if G.FILE_HANDLER and G.FILE_HANDLER and G.FILE_HANDLER.update_queued and (
        G.FILE_HANDLER.force or 
        G.FILE_HANDLER.last_sent_stage ~= G.STAGE or
        ((G.FILE_HANDLER.last_sent_pause ~= G.SETTINGS.paused) and G.FILE_HANDLER.run) or
        (not G.FILE_HANDLER.last_sent_time or (G.FILE_HANDLER.last_sent_time < (G.TIMERS.UPTIME - G.F_SAVE_TIMER)))) then 
            
            if G.FILE_HANDLER.metrics then
                G.SAVE_MANAGER.channel:push({
                    type = 'save_metrics',
                    save_metrics = G.ARGS.save_metrics
                  })
            end

            if G.FILE_HANDLER.progress then
                G.SAVE_MANAGER.channel:push({
                    type = 'save_progress',
                    save_progress = G.ARGS.save_progress
                  })
            elseif G.FILE_HANDLER.settings then
                G.SAVE_MANAGER.channel:push({
                    type = 'save_settings',
                    save_settings = G.ARGS.save_settings,
                    profile_num = G.SETTINGS.profile,
                    save_profile = G.PROFILES[G.SETTINGS.profile]
                  })
            end

            if G.FILE_HANDLER.run then
                G.SAVE_MANAGER.channel:push({
                    type = 'save_run',
                    save_table = G.ARGS.save_run,
                    profile_num = G.SETTINGS.profile})
                G.SAVED_GAME = nil
            end

            G.FILE_HANDLER.force = false
            G.FILE_HANDLER.last_sent_stage = G.STAGE
            G.FILE_HANDLER.last_sent_time = G.TIMERS.UPTIME
            G.FILE_HANDLER.last_sent_pause = G.SETTINGS.paused
            G.FILE_HANDLER.settings = nil
            G.FILE_HANDLER.progress = nil
            G.FILE_HANDLER.metrics = nil
            G.FILE_HANDLER.run = nil
    end  
end

function Game:draw()
    G.FRAMES.DRAW = G.FRAMES.DRAW + 1
    --draw the room
    reset_drawhash()
    if G.OVERLAY_TUTORIAL and not G.OVERLAY_MENU then G.under_overlay = true end
    timer_checkpoint('start->canvas', 'draw')
    love.graphics.setCanvas{self.CANVAS}
    love.graphics.push()
    love.graphics.scale(G.CANV_SCALE)
    
    love.graphics.setShader()
    love.graphics.clear(0,0,0,1)

    if G.SPLASH_BACK then
        if G.debug_background_toggle then
            love.graphics.clear({0,1,0,1})
        else
            love.graphics.push()
            G.SPLASH_BACK:translate_container()
            G.SPLASH_BACK:draw()
            love.graphics.pop()
        end
    end

    if not G.debug_UI_toggle then 

    for k, v in pairs(self.I.NODE) do
        if not v.parent then 
            love.graphics.push()
            v:translate_container()
            v:draw()
            love.graphics.pop()
        end
    end

    for k, v in pairs(self.I.MOVEABLE) do
        if not v.parent then 
            love.graphics.push()
            v:translate_container()
            v:draw()
            love.graphics.pop()
        end
    end

    if G.SPLASH_LOGO then
        love.graphics.push()
        G.SPLASH_LOGO:translate_container()
        G.SPLASH_LOGO:draw()
        love.graphics.pop()
    end

    if G.debug_splash_size_toggle then 
        for k, v in pairs(self.I.CARDAREA) do
            if not v.parent then 
                love.graphics.push()
                v:translate_container()
                v:draw()
                love.graphics.pop()
            end
        end
    else
    if (not self.OVERLAY_MENU) or (not self.F_HIDE_BG) then 
        timer_checkpoint('primatives', 'draw')
        for k, v in pairs(self.I.UIBOX) do
            if not v.attention_text and not v.parent and v ~= self.OVERLAY_MENU and v ~= self.screenwipe and v ~= self.OVERLAY_TUTORIAL and v ~= self.debug_tools and v ~= self.online_leaderboard and v ~= self.achievement_notification then 
                love.graphics.push()
                v:translate_container()
                v:draw()
                love.graphics.pop()
            end
        end
            timer_checkpoint('uiboxes', 'draw')
        for k, v in pairs(self.I.CARDAREA) do
            if not v.parent then 
                love.graphics.push()
                v:translate_container()
                v:draw()
                love.graphics.pop()
            end
        end

        for k, v in pairs(self.I.CARD) do
            if (not v.parent and v ~= self.CONTROLLER.dragging.target and v ~= self.CONTROLLER.focused.target) then
                love.graphics.push()
                v:translate_container()
                v:draw()
                love.graphics.pop()
            end
        end

        for k, v in pairs(self.I.UIBOX) do
            if v.attention_text and v ~= self.debug_tools and v ~= self.online_leaderboard and v ~= self.achievement_notification  then 
                love.graphics.push()
                v:translate_container()
                v:draw()
                love.graphics.pop()
            end
        end

        if G.SPLASH_FRONT then
            love.graphics.push()
            G.SPLASH_FRONT:translate_container()
            G.SPLASH_FRONT:draw()
            love.graphics.pop()
        end

        G.under_overlay = false
        if self.OVERLAY_TUTORIAL then
            love.graphics.push()
            self.OVERLAY_TUTORIAL:translate_container()
            self.OVERLAY_TUTORIAL:draw()
            love.graphics.pop()
            
            if self.OVERLAY_TUTORIAL.highlights then 
                for k, v in ipairs(self.OVERLAY_TUTORIAL.highlights) do
                    love.graphics.push()
                    v:translate_container()
                    v:draw()
                    if v.draw_children then
                        v:draw_self()
                        v:draw_children()
                    end
                    love.graphics.pop()
                end
            end
        end
    end         
    if (self.OVERLAY_MENU) or (not self.F_HIDE_BG) then
        if self.OVERLAY_MENU and self.OVERLAY_MENU ~= self.CONTROLLER.dragging.target then
            love.graphics.push()
            self.OVERLAY_MENU:translate_container()
            self.OVERLAY_MENU:draw()
            love.graphics.pop()
        end
    end

    if self.debug_tools then 
        if self.debug_tools ~= self.CONTROLLER.dragging.target then
            love.graphics.push()
            self.debug_tools:translate_container()
            self.debug_tools:draw()
            love.graphics.pop()
        end
    end

    G.ALERT_ON_SCREEN = nil
    for k, v in pairs(self.I.ALERT) do
        love.graphics.push()
        v:translate_container()
        v:draw()
        G.ALERT_ON_SCREEN = true
        love.graphics.pop()
    end

    if self.CONTROLLER.dragging.target and self.CONTROLLER.dragging.target ~= self.CONTROLLER.focused.target then
        love.graphics.push()
            G.CONTROLLER.dragging.target:translate_container()
            G.CONTROLLER.dragging.target:draw()
        love.graphics.pop()
    end

    if self.CONTROLLER.focused.target and getmetatable(self.CONTROLLER.focused.target) == Card and
       (self.CONTROLLER.focused.target.area ~= G.hand or self.CONTROLLER.focused.target == self.CONTROLLER.dragging.target) then 
        love.graphics.push()
            G.CONTROLLER.focused.target:translate_container()
            G.CONTROLLER.focused.target:draw()
        love.graphics.pop()
    end

    for k, v in pairs(self.I.POPUP) do
        love.graphics.push()
        v:translate_container()
        v:draw()
        love.graphics.pop()
    end

    if self.achievement_notification then 
        love.graphics.push()
            self.achievement_notification:translate_container()
            self.achievement_notification:draw()
        love.graphics.pop()
    end


    if self.screenwipe then
        love.graphics.push()
            self.screenwipe:translate_container()
            self.screenwipe:draw()
        love.graphics.pop()
    end

    love.graphics.push()
        self.CURSOR:translate_container()
        love.graphics.translate(-self.CURSOR.T.w*G.TILESCALE*G.TILESIZE*0.5, -self.CURSOR.T.h*G.TILESCALE*G.TILESIZE*0.5)
        self.CURSOR:draw()
    love.graphics.pop()
    timer_checkpoint('rest', 'draw')
    end
end
love.graphics.pop()
    
    love.graphics.setCanvas(G.AA_CANVAS)
    love.graphics.push()
        love.graphics.setColor(G.C.WHITE)
    if (not G.recording_mode or G.video_control )and true then
        G.ARGS.eased_cursor_pos = G.ARGS.eased_cursor_pos or {x=G.CURSOR.T.x,y=G.CURSOR.T.y, sx = G.CONTROLLER.cursor_position.x, sy = G.CONTROLLER.cursor_position.y}
        G.screenwipe_amt = G.screenwipe_amt and (0.95*G.screenwipe_amt + 0.05*((self.screenwipe and 0.4 or self.screenglitch and 0.4) or 0)) or 1
        G.SETTINGS.GRAPHICS.crt = G.SETTINGS.GRAPHICS.crt*0.3
        G.SHADERS['CRT']:send('distortion_fac', {1.0 + 0.07*G.SETTINGS.GRAPHICS.crt/100, 1.0 + 0.1*G.SETTINGS.GRAPHICS.crt/100})
        G.SHADERS['CRT']:send('scale_fac', {1.0 - 0.008*G.SETTINGS.GRAPHICS.crt/100, 1.0 - 0.008*G.SETTINGS.GRAPHICS.crt/100})
        G.SHADERS['CRT']:send('feather_fac', 0.01)
        G.SHADERS['CRT']:send('bloom_fac', G.SETTINGS.GRAPHICS.bloom - 1)
        G.SHADERS['CRT']:send('time',400 + G.TIMERS.REAL)
        G.SHADERS['CRT']:send('noise_fac',0.001*G.SETTINGS.GRAPHICS.crt/100)
        G.SHADERS['CRT']:send('crt_intensity', 0.16*G.SETTINGS.GRAPHICS.crt/100)
        G.SHADERS['CRT']:send('glitch_intensity', 0)--0.1*G.SETTINGS.GRAPHICS.crt/100 + (G.screenwipe_amt) + 1)
        G.SHADERS['CRT']:send('scanlines', G.CANVAS:getPixelHeight()*0.75/G.CANV_SCALE)
        G.SHADERS['CRT']:send('mouse_screen_pos', G.video_control and {love.graphics.getWidth( )/2, love.graphics.getHeight( )/2} or {G.ARGS.eased_cursor_pos.sx, G.ARGS.eased_cursor_pos.sy})
        G.SHADERS['CRT']:send('screen_scale', G.TILESCALE*G.TILESIZE)
        G.SHADERS['CRT']:send('hovering', 1)
        love.graphics.setShader( G.SHADERS['CRT'])
        G.SETTINGS.GRAPHICS.crt = G.SETTINGS.GRAPHICS.crt/0.3
    end

        love.graphics.draw(self.CANVAS, 0, 0)
    love.graphics.pop()

    love.graphics.setCanvas()
    love.graphics.setShader()

    if G.AA_CANVAS then 
        love.graphics.push()
            love.graphics.scale(1/G.CANV_SCALE)
            love.graphics.draw(G.AA_CANVAS, 0, 0)
        love.graphics.pop()
    end

    timer_checkpoint('canvas', 'draw')

    if not _RELEASE_MODE and G.DEBUG and not G.video_control and G.F_VERBOSE then 
        love.graphics.push()
        love.graphics.setColor(0, 1, 1,1)
        local fps = love.timer.getFPS( )
        love.graphics.print("Current FPS: "..fps, 10, 10)

        if G.check and G.SETTINGS.perf_mode then
            local section_h = 30
            local resolution = 60*section_h
            local poll_w = 1
            local v_off = 100
            for a, b in ipairs({G.check.update, G.check.draw}) do
                for k, v in ipairs(b.checkpoint_list) do
                    love.graphics.setColor(0,0,0,0.2)
                    love.graphics.rectangle('fill', 12, 20 + v_off,poll_w+poll_w*#v.trend,-section_h + 5)
                    for kk, vv in ipairs(v.trend) do
                        if a == 2 then 
                            love.graphics.setColor(0.3,0.7,0.7,1)
                        else
                            love.graphics.setColor(self:state_col(v.states[kk] or 123))
                        end
                        love.graphics.rectangle('fill', 10+poll_w*kk,  20 + v_off, 5*poll_w, -(vv)*resolution)
                    end
                    love.graphics.setColor(a == 2 and 0.5 or 1, a == 2 and 1 or 0.5, 1,1)
                    love.graphics.print(v.label..': '..(string.format("%.2f",1000*(v.average or 0)))..'\n', 10, -section_h + 30 + v_off)
                    v_off = v_off + section_h
                end
            end
        end

        love.graphics.pop()
    end
    timer_checkpoint('debug', 'draw')
end

function Game:state_col(_state)
    return (_state*15251252.2/5.132)%1,  (_state*1422.5641311/5.42)%1,  (_state*1522.1523122/5.132)%1, 1
end

function Game:update_selecting_hand(dt)
    if not self.deck_preview and not G.OVERLAY_MENU and (
        (self.deck and self.deck.cards[1] and self.deck.cards[1].states.collide.is and ((not self.deck.cards[1].states.drag.is) or self.CONTROLLER.HID.touch) and (not self.CONTROLLER.HID.controller)) or 
        G.CONTROLLER.held_buttons.triggerleft) then
        if self.buttons then
            self.buttons.states.visible = false
        end
        self.deck_preview = UIBox{
            definition = self.UIDEF.deck_preview(),
            config = {align='tm', offset = {x=0,y=-0.8},major = self.hand, bond = 'Weak'}
        }
        self.E_MANAGER:add_event(Event({
            blocking = false,
            blockable = false,
            func = function()
                if self.deck_preview and not (((self.deck and self.deck.cards[1] and self.deck.cards[1].states.collide.is and not self.CONTROLLER.HID.controller)) or G.CONTROLLER.held_buttons.triggerleft) then 
                    self.deck_preview:remove()
                    self.deck_preview = nil
                    local _card = G.CONTROLLER.focused.target
                    local start = G.TIMERS.REAL
                    self.E_MANAGER:add_event(Event({
                        func = function()
                            if _card and _card.area and _card.area == G.hand then
                                local _x, _y = _card:put_focused_cursor()
                                G.CONTROLLER:update_cursor({x=_x/(G.TILESCALE*G.TILESIZE),y=_y/(G.TILESCALE*G.TILESIZE)})
                            end
                            if start + 0.4 < G.TIMERS.REAL then
                                return true
                            end
                        end
                    }))
                    return true
                end
            end
        }))
    end
    if not self.buttons and not self.deck_preview then
        self.buttons = UIBox{
            definition = create_UIBox_buttons(),
            config = {align="bm", offset = {x=0,y=0.3},major = G.hand, bond = 'Weak'}
        }
    end
    if self.buttons and not self.buttons.states.visible and not self.deck_preview then
        self.buttons.states.visible = true
    end

    if #G.hand.cards < 1 and #G.deck.cards < 1 and #G.play.cards < 1 then
        end_round()
    end

    if self.shop then self.shop:remove(); self.shop = nil end
    if not G.STATE_COMPLETE then
        G.STATE_COMPLETE = true
        if #G.hand.cards < 1 and #G.deck.cards < 1 then
            end_round()
        else
            save_run()
            G.CONTROLLER:recall_cardarea_focus('hand')
        end
    end
end

function Game:update_shop(dt)
    if not G.STATE_COMPLETE then
        stop_use()
        ease_background_colour_blind(G.STATES.SHOP)
        local shop_exists = not not G.shop
        G.shop = G.shop or UIBox{
            definition = G.UIDEF.shop(),
            config = {align='tmi', offset = {x=0,y=G.ROOM.T.y+11},major = G.hand, bond = 'Weak'}
        }
            G.E_MANAGER:add_event(Event({
                func = function()
                    G.shop.alignment.offset.y = -5.3
                    G.shop.alignment.offset.x = 0
                    G.E_MANAGER:add_event(Event({
                        trigger = 'after',
                        delay = 0.2,
                        blockable = false,
                        func = function()
                            if math.abs(G.shop.T.y - G.shop.VT.y) < 3 then
                                G.ROOM.jiggle = G.ROOM.jiggle + 3
                                play_sound('cardFan2')
                                for i = 1, #G.GAME.tags do
                                    G.GAME.tags[i]:apply_to_run({type = 'shop_start'})
                                end
                                local nosave_shop = nil
                                if not shop_exists then
                                
                                    if G.load_shop_jokers then 
                                        nosave_shop = true
                                        G.shop_jokers:load(G.load_shop_jokers)
                                        for k, v in ipairs(G.shop_jokers.cards) do
                                            create_shop_card_ui(v)
                                            if v.ability.consumeable then v:start_materialize() end
                                            for _kk, vvv in ipairs(G.GAME.tags) do
                                                if vvv:apply_to_run({type = 'store_joker_modify', card = v}) then break end
                                            end
                                        end
                                        G.load_shop_jokers = nil
                                    else
                                        for i = 1, G.GAME.shop.joker_max - #G.shop_jokers.cards do
                                            G.shop_jokers:emplace(create_card_for_shop(G.shop_jokers))
                                        end
                                    end
                                    
                                    if G.load_shop_vouchers then 
                                        nosave_shop = true
                                        G.shop_vouchers:load(G.load_shop_vouchers)
                                        for k, v in ipairs(G.shop_vouchers.cards) do
                                            create_shop_card_ui(v)
                                            v:start_materialize()
                                        end
                                        G.load_shop_vouchers = nil
                                    else
                                        if G.GAME.current_round.voucher and G.P_CENTERS[G.GAME.current_round.voucher] then
                                            local card = Card(G.shop_vouchers.T.x + G.shop_vouchers.T.w/2,
                                            G.shop_vouchers.T.y, G.CARD_W, G.CARD_H, G.P_CARDS.empty, G.P_CENTERS[G.GAME.current_round.voucher],{bypass_discovery_center = true, bypass_discovery_ui = true})
                                            card.shop_voucher = true
                                            create_shop_card_ui(card, 'Voucher', G.shop_vouchers)
                                            card:start_materialize()
                                            G.shop_vouchers:emplace(card)
                                        end
                                    end
                                    

                                    if G.load_shop_booster then 
                                        nosave_shop = true
                                        G.shop_booster:load(G.load_shop_booster)
                                        for k, v in ipairs(G.shop_booster.cards) do
                                            create_shop_card_ui(v)
                                            v:start_materialize()
                                        end
                                        G.load_shop_booster = nil
                                    else
                                        for i = 1, 2 do
                                            G.GAME.current_round.used_packs = G.GAME.current_round.used_packs or {}
                                            if not G.GAME.current_round.used_packs[i] then
                                                G.GAME.current_round.used_packs[i] = get_pack('shop_pack').key
                                            end

                                            if G.GAME.current_round.used_packs[i] ~= 'USED' then 
                                                local card = Card(G.shop_booster.T.x + G.shop_booster.T.w/2,
                                                G.shop_booster.T.y, G.CARD_W*1.27, G.CARD_H*1.27, G.P_CARDS.empty, G.P_CENTERS[G.GAME.current_round.used_packs[i]], {bypass_discovery_center = true, bypass_discovery_ui = true})
                                                create_shop_card_ui(card, 'Booster', G.shop_booster)
                                                card.ability.booster_pos = i
                                                card:start_materialize()
                                                G.shop_booster:emplace(card)
                                            end
                                        end

                                        for i = 1, #G.GAME.tags do
                                            G.GAME.tags[i]:apply_to_run({type = 'voucher_add'})
                                        end
                                        for i = 1, #G.GAME.tags do
                                            G.GAME.tags[i]:apply_to_run({type = 'shop_final_pass'})
                                        end
                                    end
                                end

                                G.CONTROLLER:snap_to({node = G.shop:get_UIE_by_ID('next_round_button')})
                                if not nosave_shop then G.E_MANAGER:add_event(Event({ func = function() save_run(); return true end})) end
                                return true
                            end
                        end}))
                    return true
                end
            }))
          G.STATE_COMPLETE = true
    end  
    if self.buttons then self.buttons:remove(); self.buttons = nil end          
end

function Game:update_play_tarot(dt)
    if self.buttons then self.buttons:remove(); self.buttons = nil end
end

function Game:update_hand_played(dt)
    if self.buttons then self.buttons:remove(); self.buttons = nil end
    if self.shop then self.shop:remove(); self.shop = nil end

    if not G.STATE_COMPLETE then
        G.STATE_COMPLETE = true
        G.E_MANAGER:add_event(Event({
            trigger = 'immediate',
            func = function()
        if G.GAME.chips - G.GAME.blind.chips >= 0 or G.GAME.current_round.hands_left < 1 then
            G.STATE = G.STATES.NEW_ROUND
        else
            G.STATE = G.STATES.DRAW_TO_HAND
        end
        G.STATE_COMPLETE = false
        return true
        end
        }))
    end
end

function Game:update_draw_to_hand(dt)
    if self.buttons then self.buttons:remove(); self.buttons = nil end
    if self.shop then self.shop:remove(); self.shop = nil end

    if not G.STATE_COMPLETE then
        G.STATE_COMPLETE = true
        for i = 1, #G.GAME.tags do
            G.GAME.tags[i]:apply_to_run({type = 'round_start_bonus'})
        end
        ease_background_colour_blind(G.STATES.DRAW_TO_HAND)
        
        G.E_MANAGER:add_event(Event({
            trigger = 'immediate',
            func = function()
                if G.FUNCS.draw_from_deck_to_hand(nil) then
                    return true
                end

                if G.GAME.current_round.hands_played == 0 and
                    G.GAME.current_round.discards_used == 0 and G.GAME.facing_blind then
                    for i = 1, #G.jokers.cards do
                        G.jokers.cards[i]:calculate_joker({first_hand_drawn = true})
                    end
                end

                G.E_MANAGER:add_event(Event({
                    trigger = 'immediate',
                    func = function()
                    G.STATE = G.STATES.SELECTING_HAND
                    G.STATE_COMPLETE = false
                    G.GAME.blind:drawn_to_hand()
                    return true
                    end
                }))
                return true
            end
        }))
    end
end

function Game:update_new_round(dt)
    if self.buttons then self.buttons:remove(); self.buttons = nil end
    if self.shop then self.shop:remove(); self.shop = nil end

    if not G.STATE_COMPLETE then
        G.STATE_COMPLETE = true
        end_round()
    end
end

function Game:update_blind_select(dt)
    if self.buttons then self.buttons:remove(); self.buttons = nil end
    if self.shop then self.shop:remove(); self.shop = nil end

    if not G.STATE_COMPLETE then
        stop_use()
        ease_background_colour_blind(G.STATES.BLIND_SELECT)
        G.E_MANAGER:add_event(Event({ func = function() save_run(); return true end}))
        G.STATE_COMPLETE = true
        G.CONTROLLER.interrupt.focus = true
        G.E_MANAGER:add_event(Event({ func = function() 
        G.E_MANAGER:add_event(Event({
            trigger = 'immediate',
            func = function()
                --G.GAME.round_resets.blind_states = G.GAME.round_resets.blind_states or {Small = 'Select', Big = 'Upcoming', Boss = 'Upcoming'}
                --if G.GAME.round_resets.blind_states.Boss == 'Defeated' then
                --    G.GAME.round_resets.blind_states.Small = 'Upcoming'
                --    G.GAME.round_resets.blind_states.Big = 'Upcoming'
                --    G.GAME.round_resets.blind_states.Boss = 'Upcoming'
                --    G.GAME.blind_on_deck = 'Small'
                --    G.GAME.round_resets.blind_choices.Boss = get_new_boss()
                --    G.GAME.round_resets.boss_rerolled = false
                --end
                play_sound('cancel')
                G.blind_select = UIBox{
                    definition = create_UIBox_blind_select(),
                    config = {align="bmi", offset = {x=0,y=G.ROOM.T.y + 29},major = G.hand, bond = 'Weak'}
                }
                G.blind_select.alignment.offset.y = 0.8-(G.hand.T.y - G.jokers.T.y) + G.blind_select.T.h
                G.ROOM.jiggle = G.ROOM.jiggle + 3
                G.blind_select.alignment.offset.x = 0
                G.CONTROLLER.lock_input = false
                for i = 1, #G.GAME.tags do
                    G.GAME.tags[i]:apply_to_run({type = 'immediate'})
                end
                for i = 1, #G.GAME.tags do
                    if G.GAME.tags[i]:apply_to_run({type = 'new_blind_choice'}) then break end
                end
                return true
            end
        }))  ; return true end}))
    end
end

function Game:update_round_eval(dt)
    if self.buttons then self.buttons:remove(); self.buttons = nil end
    if self.shop then self.shop:remove(); self.shop = nil end

    if not G.STATE_COMPLETE then
        stop_use()
        G.STATE_COMPLETE = true
        G.E_MANAGER:add_event(Event({
            trigger = 'immediate',
            func = function()
                G.GAME.facing_blind = nil
                save_run()
                ease_background_colour_blind(G.STATES.ROUND_EVAL)
                G.round_eval = UIBox{
                    definition = create_UIBox_round_evaluation(),
                    config = {align="bm", offset = {x=0,y=G.ROOM.T.y + 19},major = G.hand, bond = 'Weak'}
                }
                G.round_eval.alignment.offset.x = 0
                G.E_MANAGER:add_event(Event({
                    trigger = 'immediate',
                    func = function()
                        if G.round_eval.alignment.offset.y ~= -7.8 then
                            G.round_eval.alignment.offset.y = -7.8
                        else
                            if math.abs(G.round_eval.T.y - G.round_eval.VT.y) < 3 then
                                    G.ROOM.jiggle = G.ROOM.jiggle + 3
                                    play_sound('cardFan2')
                                    delay(0.1)
                                    G.FUNCS.evaluate_round()
                                    return true
                            end
                        end
                    end}))
                return true
            end
        }))  
    end
end

function Game:update_arcana_pack(dt)
    if self.buttons then self.buttons:remove(); self.buttons = nil end
    if self.shop then G.shop.alignment.offset.y = G.ROOM.T.y+11 end

    if not G.STATE_COMPLETE then
        G.STATE_COMPLETE = true
        G.CONTROLLER.interrupt.focus = true
        G.E_MANAGER:add_event(Event({
            trigger = 'immediate',
            func = function()
                G.booster_pack_sparkles = Particles(1, 1, 0,0, {
                    timer = 0.015,
                    scale = 0.2,
                    initialize = true,
                    lifespan = 1,
                    speed = 1.1,
                    padding = -1,
                    attach = G.ROOM_ATTACH,
                    colours = {G.C.WHITE, lighten(G.C.PURPLE, 0.4), lighten(G.C.PURPLE, 0.2), lighten(G.C.GOLD, 0.2)},
                    fill = true
                })
                G.booster_pack_sparkles.fade_alpha = 1
                G.booster_pack_sparkles:fade(1, 0)
                G.booster_pack = UIBox{
                    definition = create_UIBox_arcana_pack(),
                    config = {align="tmi", offset = {x=0,y=G.ROOM.T.y + 9},major = G.hand, bond = 'Weak'}
                }
                G.booster_pack.alignment.offset.y = -2.2
                        G.ROOM.jiggle = G.ROOM.jiggle + 3
                ease_background_colour_blind(G.STATES.TAROT_PACK)
                G.E_MANAGER:add_event(Event({
                    trigger = 'immediate',
                    func = function()
                        G.FUNCS.draw_from_deck_to_hand()

                        G.E_MANAGER:add_event(Event({
                            trigger = 'after',
                            delay = 0.5,
                            func = function()
                                G.CONTROLLER:recall_cardarea_focus('pack_cards')
                                return true
                            end}))
                        return true
                    end
                }))  
                return true
            end
        }))  
    end
end

function Game:update_spectral_pack(dt)
    if self.buttons then self.buttons:remove(); self.buttons = nil end
    if self.shop then G.shop.alignment.offset.y = G.ROOM.T.y+11 end

    if not G.STATE_COMPLETE then
        G.STATE_COMPLETE = true
        G.CONTROLLER.interrupt.focus = true
        G.E_MANAGER:add_event(Event({
            trigger = 'immediate',
            func = function()
                G.booster_pack_sparkles = Particles(1, 1, 0,0, {
                    timer = 0.015,
                    scale = 0.1,
                    initialize = true,
                    lifespan = 3,
                    speed = 0.2,
                    padding = -1,
                    attach = G.ROOM_ATTACH,
                    colours = {G.C.WHITE, lighten(G.C.GOLD, 0.2)},
                    fill = true
                })
                G.booster_pack_sparkles.fade_alpha = 1
                G.booster_pack_sparkles:fade(1, 0)
                G.booster_pack = UIBox{
                    definition = create_UIBox_spectral_pack(),
                    config = {align="tmi", offset = {x=0,y=G.ROOM.T.y + 9},major = G.hand, bond = 'Weak'}
                }
                G.booster_pack.alignment.offset.y = -2.2
                        G.ROOM.jiggle = G.ROOM.jiggle + 3
                ease_background_colour_blind(G.STATES.SPECTRAL_PACK)
                G.E_MANAGER:add_event(Event({
                    trigger = 'immediate',
                    func = function()
                        G.FUNCS.draw_from_deck_to_hand()

                        G.E_MANAGER:add_event(Event({
                            trigger = 'after',
                            delay = 0.5,
                            func = function()
                                G.CONTROLLER:recall_cardarea_focus('pack_cards')
                                return true
                            end}))
                        return true
                    end
                }))  
                return true
            end
        }))  
    end
end

function Game:update_standard_pack(dt)
    if self.buttons then self.buttons:remove(); self.buttons = nil end
    if self.shop then G.shop.alignment.offset.y = G.ROOM.T.y+11 end

    if not G.STATE_COMPLETE then
        G.STATE_COMPLETE = true
        G.CONTROLLER.interrupt.focus = true
        G.E_MANAGER:add_event(Event({
            trigger = 'immediate',
            func = function()
                G.booster_pack_sparkles = Particles(1, 1, 0,0, {
                    timer = 0.015,
                    scale = 0.3,
                    initialize = true,
                    lifespan = 3,
                    speed = 0.2,
                    padding = -1,
                    attach = G.ROOM_ATTACH,
                    colours = {G.C.BLACK, G.C.RED},
                    fill = true
                })
                G.booster_pack_sparkles.fade_alpha = 1
                G.booster_pack_sparkles:fade(1, 0)
                G.booster_pack = UIBox{
                    definition = create_UIBox_standard_pack(),
                    config = {align="tmi", offset = {x=0,y=G.ROOM.T.y + 9},major = G.hand, bond = 'Weak'}
                }
                G.booster_pack.alignment.offset.y = -2.2
                        G.ROOM.jiggle = G.ROOM.jiggle + 3
                ease_background_colour_blind(G.STATES.STANDARD_PACK)
                G.E_MANAGER:add_event(Event({
                    trigger = 'immediate',
                    func = function()
                        G.E_MANAGER:add_event(Event({
                            trigger = 'after',
                            delay = 0.5,
                            func = function()
                                G.CONTROLLER:recall_cardarea_focus('pack_cards')
                                return true
                            end}))
                        return true
                    end
                }))  
                return true
            end
        }))  
    end
end

function Game:update_buffoon_pack(dt)
    if self.buttons then self.buttons:remove(); self.buttons = nil end
    if self.shop then G.shop.alignment.offset.y = G.ROOM.T.y+11 end

    if not G.STATE_COMPLETE then
        G.STATE_COMPLETE = true
        G.CONTROLLER.interrupt.focus = true
        G.E_MANAGER:add_event(Event({
            trigger = 'immediate',
            func = function()
                G.booster_pack = UIBox{
                    definition = create_UIBox_buffoon_pack(),
                    config = {align="tmi", offset = {x=0,y=G.ROOM.T.y + 9},major = G.hand, bond = 'Weak'}
                }
                G.booster_pack.alignment.offset.y = -2.2
                        G.ROOM.jiggle = G.ROOM.jiggle + 3
                ease_background_colour_blind(G.STATES.BUFFOON_PACK)
                G.E_MANAGER:add_event(Event({
                    trigger = 'immediate',
                    func = function()
                        G.E_MANAGER:add_event(Event({
                            trigger = 'after',
                            delay = 0.5,
                            func = function()
                                G.CONTROLLER:recall_cardarea_focus('pack_cards')
                                return true
                            end}))
                        return true
                    end
                }))  
                return true
            end
        }))  
    end
end

function Game:update_celestial_pack(dt)
    if self.buttons then self.buttons:remove(); self.buttons = nil end
    if self.shop then G.shop.alignment.offset.y = G.ROOM.T.y+11 end

    if not G.STATE_COMPLETE then
        G.STATE_COMPLETE = true
        G.CONTROLLER.interrupt.focus = true
        G.E_MANAGER:add_event(Event({
            trigger = 'immediate',
            func = function()
                ease_background_colour_blind(G.STATES.PLANET_PACK)
                G.booster_pack_stars = Particles(1, 1, 0,0, {
                    timer = 0.07,
                    scale = 0.1,
                    initialize = true,
                    lifespan = 15,
                    speed = 0.1,
                    padding = -4,
                    attach = G.ROOM_ATTACH,
                    colours = {G.C.WHITE, HEX('a7d6e0'), HEX('fddca0')},
                    fill = true
                })
                G.booster_pack_meteors = Particles(1, 1, 0,0, {
                    timer = 2,
                    scale = 0.05,
                    lifespan = 1.5,
                    speed = 4,
                    attach = G.ROOM_ATTACH,
                    colours = {G.C.WHITE},
                    fill = true
                })
                G.booster_pack = UIBox{
                    definition = create_UIBox_celestial_pack(), 
                    config = {
                        align="tmi",
                        offset = {x=0,y=G.ROOM.T.y + 9},
                        major = G.hand,
                        bond = 'Weak'
                    }
                }
                G.booster_pack.alignment.offset.y = -2.2
                G.ROOM.jiggle = G.ROOM.jiggle + 3 
                G.E_MANAGER:add_event(Event({
                    func = function()
                        G.CONTROLLER:recall_cardarea_focus('pack_cards')
                        return true
                    end}))
                return true
            end
        }))  
    end
end

function Game:update_game_over(dt)
    if not G.STATE_COMPLETE then
        remove_save()

        if G.GAME.round_resets.ante <= G.GAME.win_ante then
            if not G.GAME.seeded and not G.GAME.challenge then
                inc_career_stat('c_losses', 1)
                set_deck_loss()
                set_joker_loss()
            end
        end

        play_sound('negative', 0.5, 0.7)
        play_sound('whoosh2', 0.9, 0.7)

        G.SETTINGS.paused = true
        G.FUNCS.overlay_menu{
            definition = create_UIBox_game_over(),
            config = {no_esc = true}
        }
        G.ROOM.jiggle = G.ROOM.jiggle + 3
        
        if G.GAME.round_resets.ante <= G.GAME.win_ante then --Only add Jimbo to say a quip if the game over happens when the run is lost
            local Jimbo = nil
            G.E_MANAGER:add_event(Event({
                trigger = 'after',
                delay = 2.5,
                blocking = false,
                func = (function()
                    if G.OVERLAY_MENU and G.OVERLAY_MENU:get_UIE_by_ID('jimbo_spot') then 
                        Jimbo = Card_Character({x = 0, y = 5})
                        local spot = G.OVERLAY_MENU:get_UIE_by_ID('jimbo_spot')
                        spot.config.object:remove()
                        spot.config.object = Jimbo
                        Jimbo.ui_object_updated = true
                        Jimbo:add_speech_bubble('lq_'..math.random(1,10), nil, {quip = true})
                        Jimbo:say_stuff(5)
                        end
                    return true
                end)
            }))
        end

        G.STATE_COMPLETE = true
    end
end

function Game:update_menu(dt)
end
