--[[**********************************
*
*	RoYaLCore Admin - In-game theme
*	txAdmin-style colour pass for the
*	existing admin GUI (non-destructive)
*
*	Only recolours elements once; layout and
*	logic of the original panel are untouched.
*
**************************************]]

local themed = setmetatable( {}, { __mode = "k" } )

local PALETTE = {
	text     = "FFE7EBF5",
	muted    = "FF8B93A7",
	accent   = "FF4F7CFF",
	hover    = "FF7AA2FF",
	pushed   = "FFFFFFFF",
	danger   = "FFFF9A9A",
}

local function themeLabel( element )
	local font = guiGetFont( element )
	if font == "default-bold-small" or font == "default-bold" then
		guiLabelSetColor( element, 122, 162, 255 )
	else
		guiLabelSetColor( element, 231, 235, 245 )
	end
end

local function themeButton( element )
	guiSetProperty( element, "NormalTextColour", PALETTE.text )
	guiSetProperty( element, "HoverTextColour", PALETTE.hover )
	guiSetProperty( element, "PushedTextColour", PALETTE.pushed )
	guiSetProperty( element, "DisabledTextColour", PALETTE.muted )
end

local function themeEdit( element )
	guiSetProperty( element, "NormalTextColour", PALETTE.text )
	guiSetProperty( element, "SelectedTextColour", PALETTE.pushed )
end

local function themeElement( element )
	if themed[element] then return end
	local elementType = getElementType( element )
	if elementType == "gui-label" then
		themeLabel( element )
	elseif elementType == "gui-button" then
		themeButton( element )
	elseif elementType == "gui-edit" then
		themeEdit( element )
	else
		return
	end
	themed[element] = true
end

local function walk( element )
	themeElement( element )
	for _, child in ipairs( getElementChildren( element ) ) do
		walk( child )
	end
end

local function isShown( element )
	return isElement( element ) and guiGetVisible( element )
end

local function themeTick()
	local roots = {}
	if isShown( aAdminForm ) then
		roots[#roots + 1] = aAdminForm
	end
	if _widgets then
		for _, widget in pairs( _widgets ) do
			if widget.element and isShown( widget.element ) then
				roots[#roots + 1] = widget.element
			end
		end
	end
	for _, root in ipairs( roots ) do
		walk( root )
	end
end

addEventHandler( "onClientResourceStart", resourceRoot, function()
	setTimer( themeTick, 900, 0 )
end )
