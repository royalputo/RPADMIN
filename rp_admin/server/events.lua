--[[
  RpAdmin — Dev By Royalputo
  Buffers chat / join / quit / resource events for the connector.
]]

local function push(kind, actor, text)
  if type(rpAdminPushActivity) == "function" then
    rpAdminPushActivity(kind, actor, text)
  end
  if type(rpAdminQueueSnapshot) == "function" then
    rpAdminQueueSnapshot(1500)
  end
end

addEventHandler("onPlayerChat", root, function(message)
  if RP_ADMIN and RP_ADMIN.logChat == false then return end
  local player = source
  if not isElement(player) then return end
  push("say", getPlayerName(player), getPlayerName(player) .. ": " .. tostring(message))
end)

addEventHandler("onPlayerJoin", root, function()
  push("join", getPlayerName(source), getPlayerName(source) .. " joined the server")
end)

addEventHandler("onPlayerQuit", root, function()
  local name = getPlayerName(source) or "player"
  push("quit", name, name .. " left the server")
end)

addEventHandler("onResourceStart", root, function(started)
  if started == getThisResource() then return end
  push("resource", "server", "Resource '" .. getResourceName(started) .. "' started")
end)

addEventHandler("onResourceStop", root, function(stopped)
  if stopped == getThisResource() then return end
  push("resource", "server", "Resource '" .. getResourceName(stopped) .. "' stopped")
end)

-- Script errors and warnings are forwarded without needing logFile access.
-- Server event signature (MTA wiki):
--   onDebugMessage(string message, int level, string file, int line, int r, int g, int b)
-- level: 0 custom, 1 error, 2 warning, 3 info. The old handler read
-- (level, message, ...) and compared level to "error"/"warning" strings, so
-- nothing was ever captured.
local function issueResourceFromFile(file)
  -- Script errors carry a path like "@resname/server/x.lua" or
  -- "[category]/resname/server/x.lua" — pull the resource name out of it.
  if type(file) ~= "string" or file == "" then return "" end
  local res = string.match(file, "^@([%w_]+)")
  if res then return res end
  res = string.match(file, "^%[[^%]]*%][/\\]([%w_]+)")
  if res then return res end
  return ""
end

addEventHandler("onDebugMessage", root, function(message, level, file, line)
  if type(message) ~= "string" then return end
  local kind = nil
  local lvl = tonumber(level)
  if lvl == 1 or level == "error" then
    kind = "error"
  elseif lvl == 2 or level == "warning" then
    kind = "warn"
  end
  if not kind then return end

  local text = message
  if type(file) == "string" and file ~= "" then
    text = text .. " (" .. file .. ":" .. tostring(line or 0) .. ")"
  end

  -- Attribute the message to the script it came from, so the panel can
  -- highlight that resource.
  local resName = issueResourceFromFile(file)
  if resName ~= "" and resName ~= getResourceName(getThisResource()) and type(rpAdminRecordScriptIssue) == "function" then
    rpAdminRecordScriptIssue(resName, kind, text)
  end

  local actor = resName ~= "" and resName or "server"
  push(kind, actor, string.sub(text, 1, 300))
end)
