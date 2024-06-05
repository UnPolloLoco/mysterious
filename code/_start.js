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

function chooseItem(a) {
	return a[Math.floor((Math.random()*a.length))];
}

function toTile(v) {
	let rawConverted = v.scale(1/SCALE).sub(0.5);
	return vec2(Math.round(rawConverted.x), Math.round(rawConverted.y));
}

function fromTile(v) {
	return v.add(0.5).scale(SCALE);
}

// --- SPRITES ---

const PLACEHOLDER = 'https://i.ibb.co/Yhq6tgx/IMG-2591.png';

loadSprite('block', PLACEHOLDER);

// loadRoot('sprites/');
