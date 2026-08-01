--Class
Event = Object:extend()

--Class Methods
function Event:init(config)
    self.trigger = config.trigger or 'immediate'
    if config.blocking ~= nil then 
        self.blocking = config.blocking
    else
        self.blocking = true
    end
    if config.blockable ~= nil then 
        self.blockable = config.blockable
    else
        self.blockable = true
    end
    self.complete = false
    self.start_timer = config.start_timer or false
    self.func = config.func or function() return true end
    self.delay = config.delay or 0
    self.no_delete = config.no_delete
    self.created_on_pause = config.pause_force or G.SETTINGS.paused
    self.timer = config.timer or (self.created_on_pause and 'REAL') or 'TOTAL'
    
    if self.trigger == 'ease' then
        self.ease = {
            type = config.ease or 'lerp',
            ref_table = config.ref_table,
            ref_value = config.ref_value,
            start_val = config.ref_table[config.ref_value],
            end_val = config.ease_to,
            start_time = nil,
            end_time = nil,
        }
    self.func = config.func or function(t) return t end
    end
    if self.trigger == 'condition' then
        self.condition = {
            ref_table = config.ref_table,
            ref_value = config.ref_value,
            stop_val = config.stop_val,
        }
    self.func = config.func or function() return self.condition.ref_table[self.condition.ref_value] == self.condition.stop_val end
    end
    self.time = G.TIMERS[self.timer]
end

function Event:handle(_results)
    _results.blocking, _results.completed = self.blocking, self.complete
    if self.created_on_pause == false and G.SETTINGS.paused then _results.pause_skip = true; return end
    if not self.start_timer then self.time = G.TIMERS[self.timer]; self.start_timer = true end
    if self.trigger == 'after' then 
        if self.time + self.delay <= G.TIMERS[self.timer] then
            _results.time_done = true
            _results.completed = self.func()
        end
    end
    if self.trigger == 'ease' then 
        if not self.ease.start_time then
            self.ease.start_time = G.TIMERS[self.timer]
            self.ease.end_time = G.TIMERS[self.timer] + self.delay
            self.ease.start_val = self.ease.ref_table[self.ease.ref_value]
        end
        if not self.complete then 
            
            if self.ease.end_time >= G.TIMERS[self.timer] then
                local percent_done = ((self.ease.end_time - G.TIMERS[self.timer])/(self.ease.end_time - self.ease.start_time))

                if self.ease.type == 'lerp' then
                    self.ease.ref_table[self.ease.ref_value] = self.func(percent_done*self.ease.start_val + (1-percent_done)*self.ease.end_val)
                end
                if self.ease.type == 'elastic' then
                    percent_done = -math.pow(2, 10 * percent_done - 10) * math.sin((percent_done * 10 - 10.75) * 2*math.pi/3);
                    self.ease.ref_table[self.ease.ref_value] = self.func(percent_done*self.ease.start_val + (1-percent_done)*self.ease.end_val)
                end
                if self.ease.type == 'quad' then
                    percent_done = percent_done * percent_done;
                    self.ease.ref_table[self.ease.ref_value] = self.func(percent_done*self.ease.start_val + (1-percent_done)*self.ease.end_val)
                end
            else
                self.ease.ref_table[self.ease.ref_value] = self.func(self.ease.end_val)
                self.complete = true
                _results.completed = true
                _results.time_done = true
            end
        end
    end
    if self.trigger == 'condition' then 
        if not self.complete then _results.completed = self.func() end
        _results.time_done = true
    end
    if self.trigger == 'before' then 
        if not self.complete then _results.completed = self.func() end
        if self.time + self.delay <= G.TIMERS[self.timer] then
            _results.time_done = true
        end
    end
    if self.trigger == 'immediate' then
        _results.completed = self.func()
        _results.time_done = true
    end
    if _results.completed then self.complete = true end
end

--Class
EventManager = Object:extend()

--Class Methods
function EventManager:init()
    self.queues = {
        unlock = {},
        base ={},
        tutorial = {},
        achievement = {},
        other = {}
    }
    self.queue_timer = G.TIMERS.REAL
    self.queue_dt = 1/60
    self.queue_last_processed = G.TIMERS.REAL
end

function EventManager:add_event(event, queue, front)
    queue = queue or 'base'
    if event:is(Event) then
        if front then 
            table.insert(self.queues[queue], 1, event)
        else
            self.queues[queue][#self.queues[queue]+1] = event
        end
    end
end

function EventManager:clear_queue(queue, exception)
    if not queue then
        --clear all queues
        for k, v in pairs(self.queues) do
            local i=1
            while i <= #v do
                if not v[i].no_delete then
                    table.remove(v, i)
                else
                    i = i + 1
                end
            end
        end
    elseif exception then --clear all but exception
        for k, v in pairs(self.queues) do
            if k ~= exception then
                local i=1
                while i <= #v do
                    if not v[i].no_delete then
                        table.remove(v, i)
                    else
                        i = i + 1
                    end
                end
            end
        end
    else
        local i=1
        while i <= #self.queues[queue] do
            if not self.queues[queue][i].no_delete then
                table.remove(self.queues[queue], i)
            else
                i = i + 1
            end
        end
    end
end

function EventManager:update(dt, forced)
    self.queue_timer = self.queue_timer+dt
    if self.queue_timer >= self.queue_last_processed + self.queue_dt or forced then 
        self.queue_last_processed = self.queue_last_processed + (forced and 0 or self.queue_dt)
        for k, v in pairs(self.queues) do
            local blocked = false
            local i=1
            while i <= #v do
                G.ARGS.event_manager_update = G.ARGS.event_manager_update or {}
                local results = G.ARGS.event_manager_update
                results.blocking, results.completed, results.time_done, results.pause_skip = false, false, false, false
                if (not blocked or not v[i].blockable) then v[i]:handle(results) end
                if results.pause_skip then 
                    i = i + 1
                else if not blocked and results.blocking then blocked = true end
                    if results.completed and results.time_done then
                        table.remove(v, i)
                    else
                        i = i + 1
                    end
                end
            end
        end
    end
end
