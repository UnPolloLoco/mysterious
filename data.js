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
const MELEE_INDICATOR_OPACITY = 0.15;

const BLASTER_BULLET_SPEED = 20;
const RANGED_INDICATOR_OPACITY = 0.15;

const BOOST_COOLDOWN = 8;
const BOOST_DURATION = 1.5;
const BOOST_MULTIPLIER = 1.5;

const ARMORY_USE_RANGE = 3;
const ARMORY_USE_COST = 5;

const PATHFIND_MODE_PRIORITY = {
	'MAIN': 0,
	'COIN': 1,
	'MURDER': 2,
	'GET_HAT': 2,
	'GET_SUSPECT': 3,
	'ESCAPE': 4,
}

const MAP_ICON_INFO = {
	' ': { behavior: 'NONE' },
	'@': { behavior: 'SPAWN' },
	'$': { behavior: 'COIN' },
	'#': { behavior: 'WALL', sprite: 'tile' },
	'%': { behavior: 'HITBOX', sprite: 'tile' },
	'o': { behavior: 'HITBOX', sprite: 'tile' },
	'.': { behavior: 'FLOOR', sprite: 'tile' },
	'A': { behavior: 'ARMORY', sprite: 'tile' },
} 

const MAP = [
	'#####################',
	'#%%%%%%%%%%%%%#%%%%%#',
	'#.............#..A..#',
	'#..........@..#.....#',
	'#..$.o........#.....#',
	'#....o........#.....#',
	'#ooooo.....@..#.....#',
	'#.............%.....#',
	'#..@.......$........#',
	'#...................#',
	'######...######.....#',
	'#%%%%%...%%%%%#########',
	'#.............#',
	'#..@.......$..#',
	'#.............#',
	'###...#####...#',
	'#%%...%%#%%...#',
	'#.......#.....#',
	'#.......#.....#',
	'#.......#.....#',
	'#.......#...###',
	'#..@....#...%%#',
	'#.......#.....#',
	'#.......#.....#',
	'#..@....#.....#',
	'#.......###...#',
	'#.......%%%...#',
	'#..@..........#',
	'#..$.......$..#',
	'#.............#',
	'###############',
]