--[[
  RpAdmin — Dev By Royalputo
  Outbound connector agent.

  Auth model: every request sends the server key in the X-Server-Key header.
  Supabase RLS matches sha256(key) against servers.key_hash, so no agent auth
  user, service-role key or Edge Function is required.

  IMPORTANT: MTA forbids calling fetchRemote from inside a fetchRemote callback.
  Every follow-up request is scheduled with setTimer (see later()).
]]

local CFG = RP_ADMIN or {}
local BASE = tostring(CFG.url or ""):gsub("/+$", "")
local STARTED = getRealTime().timestamp
local joinTimes = {}

local STATE = {
  enabled = false,
  online = false,
  lastSync = 0,
  lastError = nil,
  pollTimer = nil,
  active = false,
  lastProgressAt = 0,
  diag = {
    version = "agent v4",
    serverUuid = CFG.serverUuid,
    pollStatus = 0,
    pollCount = 0,
    lastPollAt = nil,
    lastAction = nil,
    lastResult = nil,
    lastUpdate = 0,
    lastSnapshot = 0,
    lastError = nil,
    watchdog = 0,
    pollBytes = 0,
    pollPreview = "",
    bodycamStatus = nil,
  },
}
_G.RP_ADMIN_STATE = STATE

local function log(message)
  outputServerLog("[RpAdmin] " .. tostring(message))
end

local function dbg(message)
  if CFG.debug then
    outputDebugString("[RpAdmin] " .. tostring(message), 3)
  end
end

local function later(fn, delay)
  setTimer(fn, delay or 0, 1)
end

local function isoFrom(timestamp)
  return os.date("!%Y-%m-%dT%H:%M:%SZ", timestamp or getRealTime().timestamp)
end

local function isoNow()
  return isoFrom(getRealTime().timestamp)
end

local function filled(value)
  return type(value) == "string" and value ~= "" and not string.find(value, "<", 1, true)
end

local function configured()
  return BASE ~= ""
    and filled(CFG.serverKey)
    and filled(CFG.serverUuid)
end

-- MTA fromJSON returns array elements as MULTIPLE values, not a table.
-- Wrapping the call in {} captures them as a proper Lua list.
local function decodeCommands(data)
  if type(data) ~= "string" or data == "" then return nil end
  local ok, list = pcall(function()
    return { fromJSON(data) }
  end)
  if ok and type(list) == "table" then return list end
  return nil
end

-- ---------------------------------------------------------------
-- HTTP
-- ---------------------------------------------------------------

local function call(opts)
  if BASE == "" then return end

  local method = opts.method or "GET"
  local options = {
    method = method,
    queueName = "rp_admin",
    connectionAttempts = 2,
    connectTimeout = 10000,
    headers = {
      ["Content-Type"] = "application/json",
      ["X-Server-Key"] = tostring(CFG.serverKey),
      ["Prefer"] = "return=minimal",
    },
  }

  if opts.body ~= nil then
    local ok, encoded = pcall(toJSON, opts.body)
    if not ok then
      log("failed to encode request body")
      return
    end
    options.postData = encoded
  end

  -- Current fetchRemote syntax: (url, options, callback).
  local started = fetchRemote(BASE .. "/api/rest" .. opts.path, options, function(data, info)
    local status = 0
    if type(info) == "table" then
      status = tonumber(info.statusCode) or 0
      if status == 0 and info.success then status = 200 end
    elseif type(info) == "number" then
      if info == 0 then
        status = 200
      elseif info >= 400 and info <= 599 then
        status = info
      end
    end
    if status == 0 then
      log("HTTP request failed: " .. tostring(info))
    end
    opts.onDone(status, data or "", type(info) == "number" and info or 0)
  end)

  if not started then
    log("fetchRemote could not start for " .. tostring(opts.path))
    later(function() opts.onDone(0, "", -1) end)
  end
end

-- ---------------------------------------------------------------
-- Polling
-- ---------------------------------------------------------------

local poll

local function schedulePoll(delay)
  if not STATE.enabled then return end
  if STATE.pollTimer and isTimer(STATE.pollTimer) then
    killTimer(STATE.pollTimer)
  end
  STATE.pollTimer = setTimer(poll, delay or tonumber(CFG.pollInterval) or 3000, 1)
end

local function updateCommand(id, status, result, errorText, cb)
  call({
    method = "POST",
    path = "/rpc/agent_update_command",
    body = {
      p_server = CFG.serverUuid,
      p_id = id,
      p_status = status,
      p_result = result,
      p_error = errorText,
    },
    onDone = function(httpStatus)
      STATE.diag.lastUpdate = httpStatus
      if httpStatus < 200 or httpStatus >= 300 then
        STATE.diag.lastError = "command update HTTP " .. tostring(httpStatus)
        log("failed to update command " .. tostring(id) .. " (HTTP " .. tostring(httpStatus) .. ")")
      end
      if cb then cb() end
    end,
  })
end

local function utcEpoch(iso)
  if type(iso) ~= "string" then return nil end
  local y, m, d, h, mi, s = string.match(iso, "(%d+)%-(%d+)%-(%d+)T(%d+):(%d+):(%d+)")
  if not y then return nil end
  return os.time({
    year = tonumber(y), month = tonumber(m), day = tonumber(d),
    hour = tonumber(h), min = tonumber(mi), sec = tonumber(s), isdst = false,
  })
end

local function isExpired(cmd)
  local expires = utcEpoch(cmd.expires_at)
  if not expires then return false end
  return expires < os.time(os.date("!*t"))
end

local function processBatch(list, index)
  if index > #list then
    STATE.active = false
    STATE.lastProgressAt = getRealTime().timestamp
    schedulePoll(CFG.pollInterval)
    return
  end
  STATE.lastProgressAt = getRealTime().timestamp
  local cmd = list[index]
  later(function()
    if isExpired(cmd) then
      updateCommand(cmd.id, "expired", nil, "Expired before the server polled", function()
        later(function() processBatch(list, index + 1) end)
      end)
      return
    end

    STATE.diag.lastAction = tostring(cmd.action) .. " #" .. tostring(cmd.id)
    local ok, result, err = RPAdminExecute(cmd.action, cmd.args)
    STATE.diag.lastResult = ok and "done" or tostring(err or "failed")
    log(string.format("command %s (%s) -> %s", tostring(cmd.id), tostring(cmd.action), ok and "done" or tostring(err or "failed")))

    updateCommand(cmd.id, ok and "done" or "failed", result, err and tostring(err) or nil, function()
      later(function() processBatch(list, index + 1) end)
    end)
  end)
end

-- MTA fromJSON can return arrays with either numeric or string keys.
local function asCommandList(value)
  if type(value) ~= "table" then return nil end
  local list = {}
  for _, item in pairs(value) do
    if type(item) == "table" and item.id ~= nil then
      list[#list + 1] = item
    end
  end
  table.sort(list, function(a, b) return tonumber(a.id) < tonumber(b.id) end)
  return list
end

local function fetchCommands()
  STATE.lastProgressAt = getRealTime().timestamp
  local path = "/commands?select=id,action,args,expires_at"
    .. "&server_id=eq." .. tostring(CFG.serverUuid)
    .. "&status=eq.pending&order=id.desc&limit=10"
  call({
    path = path,
    onDone = function(status, data)
      STATE.diag.pollStatus = status
      STATE.diag.lastPollAt = isoNow()
      STATE.diag.pollBytes = #(data or "")
      STATE.diag.pollPreview = string.sub(data or "", 1, 140)
      if status == 401 or status == 403 then
        STATE.online = false
        STATE.lastError = "key rejected (HTTP " .. tostring(status) .. ")"
        STATE.diag.lastError = STATE.lastError
        log("server key rejected (HTTP " .. tostring(status) .. ") — rotate the key or check shared/config.lua")
        later(function() schedulePoll(15000) end)
        return
      end
      if status == 404 then
        STATE.online = false
        STATE.lastError = "schema missing (HTTP 404)"
        STATE.diag.lastError = STATE.lastError
        log("Supabase schema not found — run supabase/migrations/0001_init.sql")
        later(function() schedulePoll(30000) end)
        return
      end
      if status < 200 or status >= 300 then
        STATE.online = false
        STATE.lastError = "poll HTTP " .. tostring(status)
        STATE.diag.lastError = STATE.lastError
        log("poll failed (HTTP " .. tostring(status) .. ")")
        later(function() schedulePoll(5000) end)
        return
      end

      local list = asCommandList(decodeCommands(data))
      STATE.diag.pollCount = list and #list or -1
      if not list then
        STATE.diag.lastError = "command response was not valid JSON"
        log("could not parse the commands response")
        later(function() schedulePoll(5000) end)
        return
      end
      if #list > 0 then
        log("received " .. tostring(#list) .. " command(s)")
      end

      STATE.online = true
      STATE.lastSync = getRealTime().timestamp
      STATE.lastProgressAt = getRealTime().timestamp
      STATE.lastError = nil
      later(function() processBatch(list, 1) end)
    end,
  })
end

poll = function()
  if not STATE.enabled then return end
  STATE.active = true
  STATE.lastProgressAt = getRealTime().timestamp
  fetchCommands()
end

-- ---------------------------------------------------------------
-- Per-resource script issues (errors/warnings since agent start)
-- ---------------------------------------------------------------

local scriptIssues = {}

function rpAdminRecordScriptIssue(resName, kind, text)
  if type(resName) ~= "string" or resName == "" then return end
  local entry = scriptIssues[resName]
  if not entry then
    entry = { errors = 0, warns = 0, last = "", lastKind = "warn", at = 0 }
    scriptIssues[resName] = entry
  end
  if kind == "error" then
    entry.errors = entry.errors + 1
  else
    entry.warns = entry.warns + 1
  end
  entry.last = string.sub(tostring(text or ""), 1, 200)
  entry.lastKind = kind == "error" and "error" or "warn"
  entry.at = getRealTime().timestamp

  -- keep the map bounded: drop the oldest entry beyond 40 resources
  local count = 0
  for _ in pairs(scriptIssues) do count = count + 1 end
  if count > 40 then
    local oldest, oldestAt = nil, math.huge
    for name, e in pairs(scriptIssues) do
      if e.at < oldestAt then oldest, oldestAt = name, e.at end
    end
    if oldest then scriptIssues[oldest] = nil end
  end
end

function rpAdminClearScriptIssues(resName)
  if type(resName) == "string" and resName ~= "" then
    scriptIssues[resName] = nil
  end
end

-- ---------------------------------------------------------------
-- Snapshot
-- ---------------------------------------------------------------

local function countryOf(player)
  local ok, result = pcall(function()
    local res = getResourceFromName("ip2c")
    if res and getResourceState(res) == "running" then
      return exports.ip2c:getPlayerCountry(player)
    end
    return false
  end)
  if ok and result and result ~= false then return tostring(result) end
  return "Unknown"
end

local function accountName(player)
  local account = getPlayerAccount(player)
  if account and not isGuestAccount(account) then
    return getAccountName(account)
  end
  return "guest"
end

local function isStaffPlayer(player)
  local account = getPlayerAccount(player)
  if not account or isGuestAccount(account) then return false end
  local user = "user." .. getAccountName(account)
  for _, name in ipairs({ "Moderator", "SuperModerator", "Admin" }) do
    local group = aclGetGroup(name)
    if group and isObjectInACLGroup(user, group) then return true end
  end
  return false
end

local function safe(fn, fallback)
  local ok, value = pcall(fn)
  if ok and value ~= nil then return value end
  return fallback
end

local function aclName(element)
  return tostring(safe(function() return aclGetName(element) end, ""))
end

local function findAcl(name)
  for _, candidate in ipairs(safe(function() return aclList() end, {})) do
    if aclName(candidate) == name then
      return candidate
    end
  end
  return nil
end

local function buildAclSnapshot()
  -- Full report: every ACL group + every ACL with its rights, so the panel can
  -- manage the whole acl.xml (not just the RpAdmin group).
  local groups = {}
  for _, group in ipairs(safe(function() return aclGroupList() end, {})) do
    local gname = tostring(safe(function() return aclGroupGetName(group) end, ""))
    if gname ~= "" then
      local objects = {}
      for _, object in ipairs(safe(function() return aclGroupListObjects(group) end, {})) do
        objects[#objects + 1] = tostring(object)
      end
      local gAcls = {}
      for _, entry in ipairs(safe(function() return aclGroupListACL(group) end, {})) do
        gAcls[#gAcls + 1] = aclName(entry)
      end
      table.sort(objects)
      table.sort(gAcls)
      groups[#groups + 1] = { name = gname, objects = objects, acls = gAcls }
    end
  end
  table.sort(groups, function(a, b) return string.lower(a.name) < string.lower(b.name) end)

  local aclRights = {}
  for _, acl in ipairs(safe(function() return aclList() end, {})) do
    local aname = aclName(acl)
    if aname ~= "" then
      local rights = {}
      for _, right in ipairs(safe(function() return aclListRights(acl) end, {})) do
        rights[#rights + 1] = {
          name = tostring(right),
          access = safe(function() return aclGetRight(acl, right) end, false) and true or false,
        }
      end
      table.sort(rights, function(a, b) return a.name < b.name end)
      aclRights[#aclRights + 1] = { name = aname, rights = rights }
    end
  end
  table.sort(aclRights, function(a, b) return string.lower(a.name) < string.lower(b.name) end)

  -- Back-compat: the RpAdmin group in the flat shape the panel used before
  -- the full ACL manager.
  local rpGroup = aclGetGroup("RpAdmin")
  local rpAcl = findAcl("RpAdmin")

  local objects = {}
  if rpGroup then
    for _, object in ipairs(safe(function() return aclGroupListObjects(rpGroup) end, {})) do
      objects[#objects + 1] = tostring(object)
    end
  end
  table.sort(objects)

  local rights = {}
  if rpAcl then
    for _, right in ipairs(safe(function() return aclListRights(rpAcl) end, {})) do
      rights[#rights + 1] = {
        name = tostring(right),
        access = safe(function() return aclGetRight(rpAcl, right) end, false) and true or false,
      }
    end
    table.sort(rights, function(a, b) return a.name < b.name end)
  end

  return {
    active = "RpAdmin",
    groups = groups,
    acls = aclRights,
    -- legacy fields
    group = rpGroup and "RpAdmin" or nil,
    acl = rpAcl and "RpAdmin" or nil,
    objects = objects,
    rights = rights,
  }
end

local function buildSnapshot()
  local players = {}
  for _, player in ipairs(getElementsByType("player")) do
    local team = getPlayerTeam(player)
    players[#players + 1] = {
      name = getPlayerName(player),
      ping = safe(function() return getPlayerPing(player) end, 0),
      ip = safe(function() return getPlayerIP(player) end, ""),
      serial = safe(function() return getPlayerSerial(player) end, ""),
      country = countryOf(player),
      health = math.floor(safe(function() return getElementHealth(player) end, 0)),
      armor = math.floor(safe(function() return getPedArmor(player) end, 0)),
      team = team and getTeamName(team) or "-",
      muted = safe(function() return isPlayerMuted(player) end, false) and true or false,
      frozen = safe(function() return isElementFrozen(player) end, false) and true or false,
      admin = isStaffPlayer(player),
      account = accountName(player),
      joinedAt = isoFrom(joinTimes[player] or STARTED),
    }
  end

  local resources = {}
  for _, res in ipairs(getResources()) do
    resources[#resources + 1] = {
      name = getResourceName(res),
      state = getResourceState(res),
      type = safe(function() return getResourceInfo(res, "type") end, ""),
      author = safe(function() return getResourceInfo(res, "author") end, ""),
      version = safe(function() return getResourceInfo(res, "version") end, ""),
    }
  end
  table.sort(resources, function(a, b) return string.lower(a.name) < string.lower(b.name) end)

  local bans = {}
  for index, ban in ipairs(getBans()) do
    local unbanTime = safe(function() return getUnbanTime(ban) end, 0)
    local banTime = safe(function() return getBanTime(ban) end, 0)
    local ip = safe(function() return getBanIP(ban) end, "")
    local serial = safe(function() return getBanSerial(ban) end, "")
    bans[#bans + 1] = {
      id = (ip ~= "" and "ip-" .. ip) or (serial ~= "" and "sn-" .. serial) or ("ban-" .. index),
      ip = ip,
      serial = serial,
      nick = safe(function() return getBanNick(ban) end, ""),
      reason = safe(function() return getBanReason(ban) end, ""),
      admin = safe(function() return getBanAdmin(ban) end, ""),
      bannedAt = isoFrom(banTime > 0 and banTime or getRealTime().timestamp),
      unbanTime = unbanTime and unbanTime * 1000 or 0,
    }
  end

  local gamemode = safe(function()
    local res = getRunningGamemode()
    if res then return getResourceName(res) end
    return "-"
  end, "-")

  local issuesOut = {}
  for name, entry in pairs(scriptIssues) do
    issuesOut[#issuesOut + 1] = {
      name = name,
      errors = entry.errors,
      warns = entry.warns,
      last = entry.last,
      lastKind = entry.lastKind,
      at = isoFrom(entry.at),
    }
  end
  table.sort(issuesOut, function(a, b) return a.name < b.name end)

  return {
    players = players,
    resources = resources,
    bans = bans,
    scriptIssues = issuesOut,
    uptime = math.max(0, getRealTime().timestamp - STARTED),
    httpPort = safe(function() return getServerHttpPort() end, 0),
    acl = buildAclSnapshot(),
    diag = STATE.diag,
  }, gamemode
end

local function broadcastStatus()
  for _, player in ipairs(getElementsByType("player")) do
    if isStaffPlayer(player) then
      triggerClientEvent("rpAdmin:status", player, STATE.online, STATE.lastSync)
    end
  end
end

local function pushSnapshot()
  if not STATE.enabled then return end
  local snapshot, gamemode = buildSnapshot()
  call({
    method = "POST",
    path = "/rpc/agent_update_state",
    body = {
      p_server = CFG.serverUuid,
      p_last_seen = isoNow(),
      p_snapshot = snapshot,
      p_version = getVersion(),
      p_gamemode = gamemode,
      p_maxplayers = getMaxPlayers(),
      p_port = getServerPort(),
      p_player_count = getPlayerCount(),
    },
    onDone = function(status)
      STATE.diag.lastSnapshot = status
      if status >= 200 and status < 300 then
        STATE.online = true
        STATE.lastSync = getRealTime().timestamp
      else
        STATE.online = false
        dbg("snapshot failed (HTTP " .. tostring(status) .. ")")
      end
      broadcastStatus()
    end,
  })
end

local snapshotPending = false
function rpAdminQueueSnapshot(delay)
  if not STATE.enabled or snapshotPending then return end
  snapshotPending = true
  setTimer(function()
    snapshotPending = false
    pushSnapshot()
  end, delay or 1500, 1)
end

-- ---------------------------------------------------------------
-- Activity
-- ---------------------------------------------------------------

local eventQueue = {}

function rpAdminPushActivity(kind, actor, text)
  if not STATE.enabled then return end
  eventQueue[#eventQueue + 1] = {
    kind = tostring(kind or "event"),
    actor = tostring(actor or ""),
    text = tostring(text or ""),
  }
  while #eventQueue > 120 do
    table.remove(eventQueue, 1)
  end
end

local function flushEvents()
  if not STATE.enabled or #eventQueue == 0 then return end

  local batch = {}
  while #eventQueue > 0 and #batch < 10 do
    batch[#batch + 1] = table.remove(eventQueue, 1)
  end

  -- Send one object per request: MTA toJSON can wrap arrays in a way
  -- PostgREST rejects with HTTP 400.
  local function sendNext(index)
    if index > #batch then return end
    local event = batch[index]
    call({
      method = "POST",
      path = "/activity",
      body = {
        server_id = CFG.serverUuid,
        kind = event.kind,
        actor = event.actor,
        text = event.text,
      },
      onDone = function(status)
        if status < 200 or status >= 300 then
          log("activity flush failed (HTTP " .. tostring(status) .. ")")
        end
        later(function() sendNext(index + 1) end)
      end,
    })
  end

  sendNext(1)
end

-- ---------------------------------------------------------------
-- Server log tail (optional): forwards ERROR/WARNING lines to the panel
-- ---------------------------------------------------------------

local logPosition = nil

local function isLogConfigured()
  return type(CFG.logFile) == "string"
    and CFG.logFile ~= ""
    and not string.find(CFG.logFile, "<", 1, true)
end

local function tailLog()
  if not STATE.enabled or not isLogConfigured() then return end
  local file = fileOpen(CFG.logFile)
  if not file then return end

  local size = fileGetSize(file)
  if not logPosition then
    -- First run: backfill the last 128 KB so already-failed resources show
    -- their recent errors too.
    logPosition = math.max(0, size - 131072)
  end
  if size < logPosition then
    logPosition = 0
  end
  if size == logPosition then
    fileClose(file)
    return
  end

  fileSetPos(file, logPosition)
  local chunk = fileRead(file, math.min(size - logPosition, 65536)) or ""
  logPosition = fileGetPos(file)
  fileClose(file)

  local pushed = 0
  for line in string.gmatch(chunk, "[^\r\n]+") do
    if pushed >= 20 then break end
    local low = string.lower(line)
    local level = nil
    if string.find(low, "error", 1, true) or string.find(low, "failed to load", 1, true)
      or string.find(low, "failed to start", 1, true) then
      level = "error"
    elseif string.find(low, "warning", 1, true) then
      level = "warn"
    end
    if level then
      rpAdminPushActivity(level, "server", string.sub(line, 1, 300))
      pushed = pushed + 1
    end
  end
end

-- ---------------------------------------------------------------
-- Poll watchdog: recovers if a callback throws and polling stops
-- ---------------------------------------------------------------

local function pollWatchdog()
  if not STATE.enabled then return end
  if getRealTime().timestamp - (STATE.lastProgressAt or 0) <= 30 then return end
  STATE.diag.watchdog = (STATE.diag.watchdog or 0) + 1
  STATE.diag.lastError = "poll watchdog restart"
  log("poll watchdog: restarting command polling")
  STATE.active = false
  STATE.lastProgressAt = getRealTime().timestamp
  schedulePoll(0)
end

-- ---------------------------------------------------------------
-- Body Cam (low-FPS screenshots)
-- ---------------------------------------------------------------

local BODYCAM = nil

function rpAdminBodycamStop()
  if BODYCAM and BODYCAM.timer and isTimer(BODYCAM.timer) then
    killTimer(BODYCAM.timer)
  end
  BODYCAM = nil
end

function rpAdminBodycamStart(player)
  rpAdminBodycamStop()

  local serial = safe(function() return getPlayerSerial(player) end, "")
  if serial == "" then return false end

  BODYCAM = {
    player = player,
    serial = serial,
    name = getPlayerName(player),
    busy = false,
    startedAt = getRealTime().timestamp,
    timer = nil,
  }

  BODYCAM.timer = setTimer(function()
    if not BODYCAM or not isElement(BODYCAM.player) then
      rpAdminBodycamStop()
      return
    end
    if getRealTime().timestamp - BODYCAM.startedAt > 180 then
      rpAdminBodycamStop()
      return
    end
    local ok = takePlayerScreenShot(BODYCAM.player, 320, 180, "rpadmin_bodycam", 30, 20000, 400)
    if not ok then
      log("bodycam screenshot request rejected (check function.takePlayerScreenShot)")
    end
  end, 1500, 0)

  return true
end

addEventHandler("onPlayerScreenShot", root, function(resource, status, imagedata, timestamp, tag)
  if resource ~= getThisResource() then return end
  if tag ~= "rpadmin_bodycam" then return end
  if not BODYCAM or BODYCAM.player ~= source then return end
  if status ~= "ok" or not imagedata then
    STATE.diag.bodycamStatus = tostring(status)
    if BODYCAM.lastStatus ~= status then
      BODYCAM.lastStatus = status
      log("bodycam unavailable: " .. tostring(status))
    end
    return
  end
  BODYCAM.lastStatus = nil
  STATE.diag.bodycamStatus = "ok"
  if BODYCAM.busy then return end
  BODYCAM.busy = true

  local framedata = nil
  local ok, encoded = pcall(encodeString, "base64", imagedata)
  if ok and type(encoded) == "string" then framedata = encoded end
  if not framedata then
    local ok2, encoded2 = pcall(base64Encode, imagedata)
    if ok2 and type(encoded2) == "string" then framedata = encoded2 end
  end

  if not framedata then
    BODYCAM.busy = false
    return
  end

  local cam = BODYCAM
  call({
    method = "POST",
    path = "/rpc/agent_push_frame",
    body = {
      p_server = CFG.serverUuid,
      p_serial = cam.serial,
      p_name = cam.name,
      p_frame = framedata,
    },
    onDone = function(httpStatus)
      if cam then cam.busy = false end
      if httpStatus < 200 or httpStatus >= 300 then
        log("bodycam frame upload failed (HTTP " .. tostring(httpStatus) .. ")")
      end
    end,
  })
end)

-- ---------------------------------------------------------------
-- Lifecycle
-- ---------------------------------------------------------------

function rpAdminGetStatus()
  return STATE.online, STATE.lastSync, STATE.lastError
end

addEventHandler("onPlayerJoin", root, function()
  joinTimes[source] = getRealTime().timestamp
  local player = source
  setTimer(function()
    if isElement(player) and isStaffPlayer(player) then
      triggerClientEvent("rpAdmin:status", player, STATE.online, STATE.lastSync)
    end
  end, 2500, 1)
end)

addEventHandler("onPlayerQuit", root, function()
  joinTimes[source] = nil
  if BODYCAM and BODYCAM.player == source then
    rpAdminBodycamStop()
  end
end)

addEventHandler("onResourceStart", resourceRoot, function(started)
  if started ~= getThisResource() then return end
  if not configured() then
    log("shared/config.lua is not configured — the web panel connector is disabled")
    return
  end
  STATE.enabled = true
  STATE.active = false
  STATE.lastProgressAt = getRealTime().timestamp
  log("connector started (agent v4) for server " .. tostring(CFG.serverId) .. " [" .. tostring(CFG.serverUuid) .. "] — polling " .. BASE .. " every " .. tostring(CFG.pollInterval or 3000) .. "ms")
  schedulePoll(500)
  setTimer(pollWatchdog, 10000, 0)
  setTimer(pushSnapshot, 1500, 1)
  setTimer(pushSnapshot, tonumber(CFG.snapshotInterval) or 20000, 0)
  setTimer(flushEvents, tonumber(CFG.eventFlushInterval) or 5000, 0)
  if isLogConfigured() then
    setTimer(tailLog, 1000, 1)
    setTimer(tailLog, tonumber(CFG.logTailInterval) or 5000, 0)
    log("server log tail enabled: " .. tostring(CFG.logFile))
  end
end)
