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

-- Script errors and warnings (including deprecation warnings) are forwarded
-- without needing logFile access. MTA passes:
-- (message, level, fileId, filename, line, scriptResource) — message FIRST.
-- The old code read (level, message, ...) so the kind check never matched and
-- errors were silently dropped.
addEventHandler("onDebugMessage", root, function(message, level, fileId, filename, line, scriptResource)
  if type(message) ~= "string" then return end
  local kind = nil
  if level == "error" then
    kind = "error"
  elseif level == "warning" then
    kind = "warn"
  end
  if not kind then return end

  local text = message
  if filename and filename ~= "" then
    text = text .. " (" .. tostring(filename) .. ":" .. tostring(line or 0) .. ")"
  end

  -- Remember which script produced it so the Resources tab can highlight it.
  local resName = ""
  if isElement(scriptResource) and scriptResource ~= getThisResource() then
    resName = tostring(getResourceName(scriptResource) or "")
  end
  if resName ~= "" and type(rpAdminRecordScriptIssue) == "function" then
    rpAdminRecordScriptIssue(resName, kind, text)
  end

  local actor = resName ~= "" and resName or "server"
  push(kind, actor, string.sub(text, 1, 300))
end)
