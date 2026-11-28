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
-- without needing logFile access.
addEventHandler("onDebugMessage", root, function(level, message, file, line)
  if type(message) ~= "string" then return end
  local kind = nil
  if level == "error" then
    kind = "error"
  elseif level == "warning" then
    kind = "warn"
  end
  if not kind then return end

  local text = message
  if file and file ~= "" then
    text = text .. " (" .. tostring(file) .. ":" .. tostring(line) .. ")"
  end
  push(kind, "server", string.sub(text, 1, 300))
end)
