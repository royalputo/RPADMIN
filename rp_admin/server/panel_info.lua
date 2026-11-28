--[[
  RpAdmin — Dev By Royalputo
  /panel — prints the panel URL and connector status for staff.
]]

local function isStaff(player)
  local account = getPlayerAccount(player)
  if not account or isGuestAccount(account) then return false end
  local user = "user." .. getAccountName(account)
  for _, name in ipairs({ "Moderator", "SuperModerator", "Admin" }) do
    local group = aclGetGroup(name)
    if group and isObjectInACLGroup(user, group) then return true end
  end
  return false
end

local function maskedKey()
  local key = RP_ADMIN and RP_ADMIN.serverKey
  if type(key) ~= "string" or #key < 10 or string.find(key, "<", 1, true) then
    return "not configured"
  end
  return string.sub(key, 1, 4) .. "..." .. string.sub(key, -4)
end

addCommandHandler("panel", function(player)
  if player and not isStaff(player) then
    outputChatBox("RpAdmin: staff only.", player, 255, 120, 120)
    return
  end

  local panelUrl = tostring((RP_ADMIN and RP_ADMIN.panelUrl) or "https://rpadmin.mtarg.xyz"):gsub("/+$", "")
  local serverId = tostring((RP_ADMIN and RP_ADMIN.serverId) or "0")
  local online = false
  if type(rpAdminGetStatus) == "function" then
    online = rpAdminGetStatus()
  end

  local text = string.format(
    "RpAdmin (Dev By Royalputo) — panel: %s/%s — connector: %s — key: %s",
    panelUrl, serverId, online and "online" or "offline", maskedKey()
  )

  if player then
    outputChatBox(text, player, 120, 180, 255)
  else
    outputServerLog(text)
  end
end)
