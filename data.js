const WALKING_SPEED = 6;
const WALKING_ACCELERATION = 6;
const TURNING_SPEED = 350;
const TURNING_ACCELERATION = 9;

const AI_ROTATION_TWEEN_DURATION = 0.2;
const PROXIMITY_WEIGHT_ADDITIVE = 0.5;

const RAYCAST_ANGLE_STEP = 0.1;

const INITIAL_ATTACK_COOLDOWN = 10;
const MELEE_ATTACK_COOLDOWN = 5;
const RANGED_ATTACK_COOLDOWN = 2;

const MELEE_ATTACK_DISTANCE = 1.5;
const BLASTER_BULLET_SPEED = 20;

const MELEE_INDICATOR_OPACITY = 0.15;
const RANGED_INDICATOR_OPACITY = 0.15;

const BOOST_COOLDOWN = 8;
const BOOST_DURATION = 1.5;
const BOOST_MULTIPLIER = 1.5;

const ARMORY_USE_RANGE = 3;
const ARMORY_USE_COST = 5;

const PERSON_HITBOX_SCALE = 1.1;
const PUPPET_OFFSET = 0.35;
const PUPPET_SIZE = 1.5;

const PATHFIND_MODE_PRIORITY = {
	'MAIN': 0,
	'COIN': 1,
	'GET_ARMORY': 2,
	'MURDER': 3,
	'GET_HAT': 3,
	'GET_SUSPECT': 4,
	'ESCAPE': 5,
}

// sprite: frame, frame, frame *special (apple:1) (banana: 1,2 *peel)
const MAP_ICON_INFO = {
	' ': { behavior: 'NONE' },
	'@': { behavior: 'SPAWN' },
	'$': { behavior: 'COIN' },
	'#': { behavior: 'WALL', sprite: 'block' },
	'%': { behavior: 'HITBOX', sprite: 'wallTest' },
	'o': { behavior: 'HITBOX', sprite: 'block' },
	'.': { behavior: 'FLOOR', sprite: 'tile:2' },
	'A': { behavior: 'ARMORY', sprite: 'block' },
} 

const SPRITE_INFO = {
	'wallTest': {
		offset: [0, -0.5],
	}
}

// First row must be longest
const MAP = [
	'#####################',
	'#...................#',
	'#...................#',
	'#...................#',
	'#...#oo#oo#oo#oo#...#',
	'#...................#',
	'#...................#',
	'#...................#',
	'#...................#',
	'###..################',
	'#%%..%%%%%%%%%#%%%%%#',
	'#%%..%%%%%%%%%#%%%%%#',
	'#.............#..A..#',
	'#..........@..#.....#',
	'#..$.o........#.....#',
	'#....o........#.....#',
	'#ooooo.....@..%.....#',
	'#.............%.....#',
	'#..@.......$........#',
	'#...................#',
	'######...######.....#',
	'#%%%%%...%%%%%#######',
	'#%%%%%...%%%%%#',
	'#.............#',
	'#..@.......$..#',
	'#.............#',
	'###...#####...#',
	'#%%...%%#%%...#',
	'#%%...%%#%%...#',
	'#.......#.....#',
	'#.......#.....#',
	'#.......#.....#',
	'#.......#...###',
	'#.......#...%%#',
	'#..@....#...%%#',
	'#.......#.....#',
	'#.......#.....#',
	'#..@....#.....#',
	'#.......###...#',
	'#.......%%%...#',
	'#.......%%%...#',
	'#..@..........#',
	'#..$.......$..#',
	'#.............#',
	'###############',
]