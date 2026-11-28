--[[
  RpAdmin — Dev By Royalputo
  Allowlisted action executor. Every command from the panel passes through here.
  Returns: ok(boolean), result(table|nil), error(string|nil)
]]

local MAX_REASON = 300

local function str(value)
  if value == nil then return "" end
  return tostring(value)
end

local function trim(value)
  return (str(value):gsub("^%s+", ""):gsub("%s+$", ""))
end

local function findPlayer(name)
  name = trim(name)
  if name == "" then return false end
  local exact = getPlayerFromName(name)
  if exact then return exact end
  local needle = string.lower(name)
  local matches = {}
  for _, player in ipairs(getElementsByType("player")) do
    if string.find(string.lower(getPlayerName(player)), needle, 1, true) then
      matches[#matches + 1] = player
    end
  end
  if #matches == 1 then return matches[1] end
  return false
end

local function playerRequired(name)
  local player = findPlayer(name)
  if not player then return nil, "Player not found (or name is ambiguous)" end
  return player
end

local function announce(text)
  outputChatBox("[Server] " .. text, root, 255, 190, 60)
end

local handlers = {}

handlers["say"] = function(args)
  local message = trim(args.message)
  if message == "" then return false, nil, "Message is empty" end
  if #message > 200 then return false, nil, "Message too long" end
  announce(message)
  return true, { message = message }
end

handlers["kick"] = function(args)
  local player, err = playerRequired(args.player)
  if not player then return false, nil, err end
  local reason = trim(args.reason)
  if reason == "" then reason = "Kicked by admin" end
  if #reason > MAX_REASON then reason = string.sub(reason, 1, MAX_REASON) end
  local name = getPlayerName(player)
  if not kickPlayer(player, player, reason) then
    return false, nil, "kickPlayer failed (check ACL function.kickPlayer)"
  end
  return true, { player = name, reason = reason }
end

handlers["ban"] = function(args)
  local player, err = playerRequired(args.player)
  if not player then return false, nil, err end
  local reason = trim(args.reason)
  if reason == "" then reason = "Banned by admin" end
  if #reason > MAX_REASON then reason = string.sub(reason, 1, MAX_REASON) end
  local seconds = tonumber(args.seconds) or 0
  if seconds < 0 then seconds = 0 end
  if seconds > 31536000 then seconds = 31536000 end
  local name = getPlayerName(player)
  local ip = getPlayerIP(player)
  local serial = getPlayerSerial(player)

  -- Signature: banPlayer(player, IP, Username, Serial, responsiblePlayer, reason, seconds)
  local ok = banPlayer(player, true, false, true, player, reason, seconds)
  if not ok then return false, nil, "banPlayer failed (check ACL function.banPlayer)" end
  return true, { player = name, ip = ip, serial = serial, reason = reason, seconds = seconds }
end

handlers["unban"] = function(args)
  local ip = trim(args.ip)
  local serial = trim(args.serial)
  if ip == "" and serial == "" then return false, nil, "An IP or serial is required" end
  for _, ban in ipairs(getBans()) do
    local banIp = getBanIP(ban) or ""
    local banSerial = getBanSerial(ban) or ""
    if (ip ~= "" and banIp == ip) or (serial ~= "" and banSerial == serial) then
      if not removeBan(ban) then
        return false, nil, "removeBan failed (check ACL function.removeBan)"
      end
      return true, { ip = banIp, serial = banSerial }
    end
  end
  return false, nil, "Ban not found"
end

handlers["mute"] = function(args)
  local player, err = playerRequired(args.player)
  if not player then return false, nil, err end
  setPlayerMuted(player, true)
  return true, { player = getPlayerName(player) }
end

handlers["unmute"] = function(args)
  local player, err = playerRequired(args.player)
  if not player then return false, nil, err end
  setPlayerMuted(player, false)
  return true, { player = getPlayerName(player) }
end

handlers["freeze"] = function(args)
  local player, err = playerRequired(args.player)
  if not player then return false, nil, err end
  setElementFrozen(player, true)
  return true, { player = getPlayerName(player) }
end

handlers["unfreeze"] = function(args)
  local player, err = playerRequired(args.player)
  if not player then return false, nil, err end
  setElementFrozen(player, false)
  return true, { player = getPlayerName(player) }
end

handlers["warn"] = function(args)
  local player, err = playerRequired(args.player)
  if not player then return false, nil, err end
  local reason = trim(args.reason)
  if reason == "" then return false, nil, "Reason is required" end
  outputChatBox("[Server] You have received a warning: " .. reason, player, 255, 190, 60)
  return true, { player = getPlayerName(player), reason = reason }
end

handlers["note"] = function(args)
  -- Notes are stored by the panel (service role); nothing to execute in-game.
  return true, { player = trim(args.player) }
end

handlers["resource"] = function(args)
  local name = trim(args.resource)
  local op = string.lower(trim(args.op))
  local resource = getResourceFromName(name)
  if not resource then return false, nil, "Resource not found" end
  if op == "start" then
    if getResourceState(resource) == "running" then return true, { resource = name, state = "running" } end
    if not startResource(resource) then return false, nil, "startResource failed (check ACL)" end
  elseif op == "stop" then
    local state = getResourceState(resource)
    if state == "stopped" then return true, { resource = name, state = state } end
    if not stopResource(resource) then
      return false, nil, "stopResource failed (state " .. tostring(state) .. ", check ACL function.stopResource)"
    end
  elseif op == "restart" then
    if getResourceState(resource) ~= "running" then
      if not startResource(resource) then return false, nil, "startResource failed (check ACL)" end
    elseif not restartResource(resource) then
      return false, nil, "restartResource failed (check ACL)"
    end
  else
    return false, nil, "Unknown resource operation"
  end
  -- Push a fresh snapshot right away so the panel reflects the new state
  -- immediately instead of waiting for the next 20s snapshot interval.
  if type(rpAdminQueueSnapshot) == "function" then rpAdminQueueSnapshot(1200) end
  return true, { resource = name, op = op }
end

handlers["server"] = function(args)
  local changed = {}
  local name = trim(args.name)
  if name ~= "" then
    if #name > 60 then return false, nil, "Server name too long" end
    if not setServerName(name) then return false, nil, "setServerName failed (check ACL)" end
    changed.name = name
  end
  local maxPlayers = tonumber(args.maxPlayers)
  if maxPlayers then
    if maxPlayers < 1 or maxPlayers > 1000 then return false, nil, "Invalid max players" end
    if not setMaxPlayers(math.floor(maxPlayers)) then return false, nil, "setMaxPlayers failed (check ACL)" end
    changed.maxPlayers = math.floor(maxPlayers)
  end
  return true, changed
end

local ALLOWED_RIGHT_PREFIX = { ["function"] = true, general = true, command = true, resource = true }
local ALLOWED_OBJECT_PREFIX = { user = true, resource = true, map = true, group = true }

local function validPrefixedName(value, allowed)
  local prefix, rest = string.match(value, "^([%a_]+)%.(.+)$")
  if not prefix or not allowed[prefix] then return false end
  return string.match(rest, "^[%w_%.%-]+$") ~= nil
end

local function validRight(name)
  return validPrefixedName(name, ALLOWED_RIGHT_PREFIX)
end

local function validObject(name)
  return validPrefixedName(name, ALLOWED_OBJECT_PREFIX)
end

-- ACL groups / ACL names use plain MTA naming: no prefix, no spaces.
local function validName(value)
  if type(value) ~= "string" or value == "" or #value > 64 then return false end
  return string.match(value, "^[A-Za-z0-9_][A-Za-z0-9_%.%-]*$") ~= nil
end

-- Groups that must never be removed from the panel: destroying them would
-- lock out the server console / core admins.
local PROTECTED_GROUPS = { Admin = true, Console = true }
local PROTECTED_ACLS = { Default = true }

local function aclTarget(groupName, aclName)
  groupName = (groupName and groupName ~= "" and groupName) or "RpAdmin"
  aclName = (aclName and aclName ~= "" and aclName) or "RpAdmin"

  local group
  local ok, found = pcall(aclGetGroup, groupName)
  if ok then group = found end

  local acl = nil
  local listed, list = pcall(aclList)
  if listed then
    for _, candidate in ipairs(list) do
      local named, name = pcall(aclGetName, candidate)
      if named and name == aclName then
        acl = candidate
        break
      end
    end
  end

  return group, acl, groupName, aclName
end

local function aclChanged()
  if type(rpAdminQueueSnapshot) == "function" then
    rpAdminQueueSnapshot(800)
  end
end

handlers["acl_toggle_right"] = function(args)
  local right = trim(args.right)
  local enabled = args.enabled == true
  if not validRight(right) then
    return false, nil, "Invalid right name (use function.name / command.name / general.name)"
  end

  local _, acl, groupName, aclNameWanted = aclTarget(trim(args.group), trim(args.acl))
  if not acl then return false, nil, "ACL '" .. aclNameWanted .. "' not found" end

  local ok = aclSetRight(acl, right, enabled)
  if not ok then return false, nil, "aclSetRight failed (check resource ACL rights)" end

  aclChanged()
  return true, { right = right, enabled = enabled, acl = aclNameWanted, group = groupName }
end

handlers["acl_add_object"] = function(args)
  local object = trim(args.object)
  if not validObject(object) then
    return false, nil, "Invalid object (use user.name, resource.name, map.name or group.name)"
  end

  local group, _, groupName = aclTarget(trim(args.group))
  if not group then return false, nil, "ACL group '" .. groupName .. "' not found" end
  if not aclGroupAddObject(group, object) then
    return false, nil, "aclGroupAddObject failed (check resource ACL rights)"
  end

  aclChanged()
  return true, { object = object, group = groupName }
end

handlers["acl_remove_object"] = function(args)
  local object = trim(args.object)
  if not validObject(object) then
    return false, nil, "Invalid object"
  end

  local group, _, groupName = aclTarget(trim(args.group))
  if not group then return false, nil, "ACL group '" .. groupName .. "' not found" end
  if not aclGroupRemoveObject(group, object) then
    return false, nil, "aclGroupRemoveObject failed (check resource ACL rights)"
  end

  aclChanged()
  return true, { object = object, group = groupName }
end

handlers["acl_create_group"] = function(args)
  local groupName = trim(args.group)
  if not validName(groupName) then
    return false, nil, "Invalid group name (letters, numbers, dot, dash, underscore)"
  end
  if aclGetGroup(groupName) then
    return false, nil, "Group '" .. groupName .. "' already exists"
  end

  local group = aclCreateGroup(groupName)
  if not group then return false, nil, "aclCreateGroup failed (check resource ACL rights)" end

  aclChanged()
  return true, { group = groupName }
end

handlers["acl_destroy_group"] = function(args)
  local groupName = trim(args.group)
  if not validName(groupName) then return false, nil, "Invalid group name" end
  if PROTECTED_GROUPS[groupName] then
    return false, nil, "Group '" .. groupName .. "' is protected and cannot be removed"
  end

  local group = aclGetGroup(groupName)
  if not group then return false, nil, "Group '" .. groupName .. "' not found" end
  if not aclDestroyGroup(group) then
    return false, nil, "aclDestroyGroup failed (check resource ACL rights)"
  end

  aclChanged()
  return true, { group = groupName }
end

handlers["acl_create_acl"] = function(args)
  local wanted = trim(args.acl)
  if not validName(wanted) then
    return false, nil, "Invalid ACL name (letters, numbers, dot, dash, underscore)"
  end

  local existing = nil
  local listed, list = pcall(aclList)
  if listed then
    for _, candidate in ipairs(list) do
      local named, name = pcall(aclGetName, candidate)
      if named and name == wanted then existing = candidate end
    end
  end
  if existing then return false, nil, "ACL '" .. wanted .. "' already exists" end

  local acl = aclCreate(wanted)
  if not acl then return false, nil, "aclCreate failed (check resource ACL rights)" end

  aclChanged()
  return true, { acl = wanted }
end

handlers["acl_delete_acl"] = function(args)
  local wanted = trim(args.acl)
  if not validName(wanted) then return false, nil, "Invalid ACL name" end
  if PROTECTED_ACLS[wanted] then
    return false, nil, "ACL '" .. wanted .. "' is protected and cannot be removed"
  end
  if wanted == "RpAdmin" then
    return false, nil, "The RpAdmin ACL cannot be removed (the connector depends on it)"
  end

  local acl = nil
  local listed, list = pcall(aclList)
  if listed then
    for _, candidate in ipairs(list) do
      local named, name = pcall(aclGetName, candidate)
      if named and name == wanted then acl = candidate end
    end
  end
  if not acl then return false, nil, "ACL '" .. wanted .. "' not found" end

  if not aclDestroy(acl) then
    return false, nil, "aclDestroy failed (check resource ACL rights)"
  end

  aclChanged()
  return true, { acl = wanted }
end

handlers["acl_group_add_acl"] = function(args)
  local wanted = trim(args.acl)
  if not validName(wanted) then return false, nil, "Invalid ACL name" end

  local group, acl, groupName = aclTarget(trim(args.group), wanted)
  if not group then return false, nil, "ACL group '" .. groupName .. "' not found" end
  if not acl then return false, nil, "ACL '" .. wanted .. "' not found" end

  if not aclGroupAddACL(group, acl) then
    return false, nil, "aclGroupAddACL failed (check resource ACL rights)"
  end

  aclChanged()
  return true, { group = groupName, acl = wanted }
end

handlers["acl_group_remove_acl"] = function(args)
  local wanted = trim(args.acl)
  if not validName(wanted) then return false, nil, "Invalid ACL name" end

  local group, acl, groupName = aclTarget(trim(args.group), wanted)
  if not group then return false, nil, "ACL group '" .. groupName .. "' not found" end
  if not acl then return false, nil, "ACL '" .. wanted .. "' not found" end

  if not aclGroupRemoveACL(group, acl) then
    return false, nil, "aclGroupRemoveACL failed (check resource ACL rights)"
  end

  aclChanged()
  return true, { group = groupName, acl = wanted }
end

local ALL_START_SKIP = { admin = true, webadmin = true }

handlers["resources_all_start"] = function()
  local selfName = getResourceName(getThisResource())
  local started, failed = 0, 0

  for _, res in ipairs(getResources()) do
    local name = getResourceName(res)
    if name ~= selfName and not ALL_START_SKIP[name] and getResourceState(res) ~= "running" then
      if startResource(res) then
        started = started + 1
      else
        failed = failed + 1
      end
    end
  end

  if type(rpAdminQueueSnapshot) == "function" then rpAdminQueueSnapshot(1200) end
  return true, { started = started, failed = failed }
end

handlers["resources_all_stop"] = function()
  local selfName = getResourceName(getThisResource())
  local stopped, failed = 0, 0

  for _, res in ipairs(getResources()) do
    local name = getResourceName(res)
    if name ~= selfName and not ALL_START_SKIP[name] and getResourceState(res) == "running" then
      if stopResource(res) then
        stopped = stopped + 1
      else
        failed = failed + 1
      end
    end
  end

  if type(rpAdminQueueSnapshot) == "function" then rpAdminQueueSnapshot(1200) end
  return true, { stopped = stopped, failed = failed }
end

handlers["resources_refresh"] = function()
  -- rescan=true is required so NEW resources (fresh folders in /resources)
  -- are picked up, not only modified ones.
  local callOk, result = pcall(refreshResources, true)
  if not callOk or result == false then
    return false, nil, "refreshResources failed (add the ACL right function.refreshResources to the RpAdmin ACL)"
  end
  if type(rpAdminQueueSnapshot) == "function" then rpAdminQueueSnapshot(300) end
  return true, {}
end

handlers["snapshot_now"] = function()
  if type(rpAdminQueueSnapshot) == "function" then rpAdminQueueSnapshot(0) end
  return true, {}
end

handlers["bodycam_start"] = function(args)
  local player, err = playerRequired(args.player)
  if not player then return false, nil, err end
  if type(rpAdminBodycamStart) ~= "function" then
    return false, nil, "Body cam is not available"
  end
  if not rpAdminBodycamStart(player) then
    return false, nil, "Could not start the body cam"
  end
  if type(rpAdminQueueSnapshot) == "function" then rpAdminQueueSnapshot(800) end
  return true, { player = getPlayerName(player), serial = getPlayerSerial(player) }
end

handlers["bodycam_stop"] = function()
  if type(rpAdminBodycamStop) == "function" then rpAdminBodycamStop() end
  return true, {}
end

handlers["shutdown"] = function(args)
  local reason = trim(args.reason)
  if reason == "" then reason = "Server shutdown from RpAdmin" end
  local remaining = 10
  local function tick()
    if remaining <= 0 then
      outputServerLog("[RpAdmin] Shutting down: " .. reason)
      shutdown(reason)
      return
    end
    outputChatBox("[Server] Server shutting down in " .. remaining .. " second(s): " .. reason, root, 255, 90, 90)
    remaining = remaining - 1
    setTimer(tick, 1000, 1)
  end
  tick()
  return true, { reason = reason, countdown = 10 }
end

function RPAdminExecute(action, args)
  action = str(action)
  args = type(args) == "table" and args or {}
  local handler = handlers[action]
  if not handler then return false, nil, "Unknown action: " .. action end
  local ok, success, result, err = pcall(handler, args)
  if not ok then
    outputServerLog("[RpAdmin] Action '" .. action .. "' crashed: " .. tostring(success))
    return false, nil, "Action crashed: " .. tostring(success)
  end
  return success, result, err
end
