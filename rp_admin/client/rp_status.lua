--[[
  RpAdmin — Dev By Royalputo
  Small staff-only status label (bottom-right). The server only sends the
  status event to staff accounts, so no client-side ACL check is needed.
]]

local online = false
local lastSync = 0
local received = false

addEvent("rpAdmin:status", true)
addEventHandler("rpAdmin:status", root, function(isOnline, timestamp)
  online = isOnline and true or false
  lastSync = tonumber(timestamp) or 0
  received = true
end)

addEventHandler("onClientRender", root, function()
  if not received then return end
  if RP_ADMIN and RP_ADMIN.showStatusLabel == false then return end

  local sw, sh = guiGetScreenSize()
  local age = -1
  if lastSync and lastSync > 0 then
    age = math.max(0, getRealTime().timestamp - lastSync)
  end

  local text = "RpAdmin | " .. (online and "online" or "offline")
  if age >= 0 then
    text = text .. " | " .. age .. "s"
  end

  dxDrawText(text, 0, sh - 32, sw - 16, sh - 12, tocolor(150, 170, 220, 190), 1, "default-bold", "right", "center")
end)
