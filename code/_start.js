const SCREEN_RATIO = 0.6;

let ww = window.innerWidth;let wh = window.innerHeight;let kaboomDimensions = {};if (ww * SCREEN_RATIO > wh) {kaboomDimensions = { w: wh / SCREEN_RATIO,h: wh};} else {kaboomDimensions = {w: ww,h: ww * SCREEN_RATIO};};

kaboom({
	background: [0,0,0],
	width: kaboomDimensions.w,
	height: kaboomDimensions.h,
	inspectColor: [255,255,255],
	pixelDensity: 1,
	crisp: true,
	logMax: 3,
});

debug.inspect = false;

const SCALE = width()/16;

// --- FUNCTIONS ---

function chooseItem(a) { // Get a random item in a list
	return a[Math.floor((Math.random()*a.length))];
}

function toTile(v) { // Pixel coordinate to tile coordinate
	let rawConverted = v.scale(1/SCALE).sub(0.5);
	return vec2(Math.round(rawConverted.x), Math.round(rawConverted.y));
}

function fromTile(v) { // Tile coordinate to pixel coordinate
	return v.add(0.5).scale(SCALE);
}

function onScreenFrom(eye, target) { // Check if target is on screen if a camera were at the eye (16 x 9.6)
	if (eye.x + SCALE*8 < target.x || eye.x - SCALE*8 > target.x) { return false; } 
	else if (eye.y + SCALE*4.8 < target.y || eye.y - SCALE*4.8 > target.y) { return false; }

	return true;
}

function getTileAt(row, column) { // Get map character
	return MAP[row][column];
}

function checkInventorySlot(who, slot) { // Check what item is in a slot
	return who.inventory.slots[slot];
}

function checkSelectedSlot(who) { // Check selected slot item
	return checkInventorySlot(who, who.inventory.selected);
}

function getModePriority(mode) {
	return PATHFIND_MODE_PRIORITY[mode];
}

// --- SPRITES ---

const PLACEHOLDER = 'https://i.ibb.co/Yhq6tgx/IMG-2591.png';

loadSprite('person', PLACEHOLDER);
loadSprite('block', PLACEHOLDER);
loadSprite('coin', PLACEHOLDER);
loadSprite('bullet', PLACEHOLDER);
loadSprite('gravestone', PLACEHOLDER);
loadSprite('sheriffDrop', PLACEHOLDER);

// loadRoot('sprites/');
