const WALKING_SPEED = 6;
const WALKING_ACCELERATION = 6;
const TURNING_SPEED = 350;
const TURNING_ACCELERATION = 9;

const AI_ROTATION_TWEEN_DURATION = 0.2;
const PROXIMITY_WEIGHT_ADDITIVE = 0.5;

const RAYCAST_ANGLE_STEP = 0.1;

const MELEE_ATTACK_DISTANCE = 1.5;
const MELEE_INDICATOR_OPACITY = 0.15;

const BLASTER_BULLET_SPEED = 20;
const RANGED_INDICATOR_OPACITY = 0.15;

const MAP_ICON_INFO = {
	' ': { behavior: 'NONE' },
	'@': { behavior: 'SPAWN' },
	'$': { behavior: 'COIN' },
	'#': { behavior: 'WALL', sprite: 'tile' },
	'%': { behavior: 'HITBOX', sprite: 'tile' },
	'o': { behavior: 'HITBOX', sprite: 'tile' },
	'.': { behavior: 'FLOOR', sprite: 'tile' },
} 

const MAP = [
	'###############',
	'#%%%%%%%%%%%%%#',
	'#.............#',
	'#.............#',
	'#..........@..#',
	'#..$.o........#',
	'#....o........#',
	'#ooooo.....@..#',
	'#.............#',
	'#..@.......$..#',
	'#.............#',
	'######...######',
	'#%%%%%...%%%%%#',
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