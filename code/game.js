scene('game', () => {

	// --- LAYERS AND OTHER SETTINGS ---

	const L = {
		floor:   0,
		players: 100,
		walls:   200,
		ui:      300,
	}

	const GAME_STATE = {
		isSheriffHatDropped: false,
		droppedSheriffHat: null,
	}

	let movementInputStyle = ['tank', 'point'][1];
	
	// --- MAP CREATION ---

	function getBehavior(char) {
		let tileInfo = MAP_ICON_INFO[char];
		if (tileInfo == undefined) return 'NONE';
		return tileInfo.behavior;
	}

	let possibleSpawnPoints = [];
	let coinSpawnPoints = [];
	let usedCoinSpawnPoints = [];

	let armoryBlaster;

	for (let row = 0; row < MAP.length; row++) {
		for (let column = 0; column < MAP[row].length; column++) {

			let currentTile = MAP[row][column];
			let tileBehavior = getBehavior(currentTile);

			// Ignore tile if nothing should be done with it
			if (!['NONE', 'WALL'].includes(tileBehavior)) {

				let tilePosition = vec2(
					column * SCALE, 
					row * SCALE);

				let tile = add([
					sprite('block'),
					scale(SCALE/500),
					pos(tilePosition),
					z(L.floor),
					{
						tile: currentTile,
						behavior: tileBehavior,
					},
					'tile',
				])

				// Hitbox tile
				if (tileBehavior == 'HITBOX') {
					tile.use(area());
					tile.use(body({ isStatic: true }));
					tile.use(color(rgb(200,200,200)));
					tile.use(z(L.players - 10));
				}

				// Floor, spawn, coin, OR blaster tile
				if (['FLOOR', 'SPAWN', 'COIN', 'ARMORY'].includes(tileBehavior)) {
					tile.use(color(rgb(60,60,60)));

					// Spawn tile only
					if (tileBehavior == 'SPAWN') {
						possibleSpawnPoints.push(tilePosition.add(SCALE/2));
					}
					// Coin tile only
					if (tileBehavior == 'COIN') {
						coinSpawnPoints.push(tilePosition);
					}

					// Blaster tile only
					if (tileBehavior == 'ARMORY') {
						armoryBlaster = add([
							sprite('blaster'),
							pos(tilePosition.add(SCALE/2)),
							scale(SCALE/500 * 0.8),
							area(),
							anchor('center'),
							color(BLUE),
							'armoryBlaster',
						])
					}
				}

			}
		}
	}

	const MAX_PLAYER_COUNT = possibleSpawnPoints.length;

	// --- SPECIAL WALLS CREATION ---

	const wallLevel = addLevel(MAP, {
		tileWidth: SCALE, tileHeight: SCALE,
		tiles: {
			'#': () => [
				rect(SCALE, SCALE),
				color(BLACK),
				area(),
				body({ isStatic: true }),
				tile({ isObstacle: true }),
				'wall',
			]
		}
	});

	// Vision polygon

	const raycastedWallEffectMask = add([
		pos(0,0),
		polygon([vec2(0), vec2(300), vec2(0,300)]),
		mask('subtract'),
		z(L.walls + 10),
	])

	// Masked black rectangle

	const raycastedWallEffect = raycastedWallEffectMask.add([
		pos(0,0),
		rect(
			SCALE * MAP[0].length,
			SCALE * MAP.length,
		),
		color(BLACK),
		z(L.walls + 10),
	])

	function drawWallMask() {
		// Thank you Kaplay Playground
		// Raycast
		const pts = [player.pos];
		for (let i = 0; i < 360; i += RAYCAST_ANGLE_STEP) {
			const hit = wallLevel.raycast(player.pos, Vec2.fromAngle(i));
			
			if (hit) {
				let point = hit.point;
				pts.push(point);
			}
		}
		pts.push(pts[1]);

		// Subtraction edit

		raycastedWallEffectMask.pts = pts;
	}

	// --- BLACK BORDERS ---

	let mapWidth = MAP[0].length;
	let mapHeight = MAP.length;

	// Top
	add([
		rect(SCALE*(40 + mapWidth), SCALE*20),
		pos(SCALE * mapWidth/2, 0),
		anchor('bot'),
		color(BLACK),
		z(L.walls + 10),
	])

	// Bottom
	add([
		rect(SCALE*(40 + mapWidth), SCALE*20),
		pos(SCALE * mapWidth/2, SCALE*mapHeight),
		anchor('top'),
		color(BLACK),
		z(L.walls + 10),
	])

	// Left
	add([
		rect(SCALE*20, SCALE*(40 + mapHeight)),
		pos(0, SCALE * mapHeight/2),
		anchor('right'),
		color(BLACK),
		z(L.walls + 10),
	])
	
	// Right
	add([
		rect(SCALE*20, SCALE*(40 + mapHeight)),
		pos(SCALE*mapWidth, SCALE * mapHeight/2),
		anchor('left'),
		color(BLACK),
		z(L.walls + 10),
	])

	// --- PATHFINDER PREP ---
	
	function isHitboxAt(row, column) {
		let behavior = getBehavior(getTileAt(row, column));
		return ['WALL', 'HITBOX', 'NONE'].includes(behavior);
	}

	// - Graph creation -

	const HITBOX_GRAPH_LIST = [];

	for (let row = 0; row < MAP.length; row++) {
		let graphListRow = [];
		for (let column = 0; column < MAP[0].length; column++) {
			let tile = getTileAt(row, column);
			let weight;

			// Has a hitbox?
			if (isHitboxAt(row, column)) {
				weight = 0;
			} else {
				weight = 1;
				if (isHitboxAt(row+1, column)) weight += PROXIMITY_WEIGHT_ADDITIVE;
				if (isHitboxAt(row-1, column)) weight += PROXIMITY_WEIGHT_ADDITIVE;
				if (isHitboxAt(row, column+1)) weight += PROXIMITY_WEIGHT_ADDITIVE;
				if (isHitboxAt(row, column-1)) weight += PROXIMITY_WEIGHT_ADDITIVE;
			}

			graphListRow.push(weight);
		}
		HITBOX_GRAPH_LIST.push(graphListRow);
	}

	let weightGraph = new Graph(HITBOX_GRAPH_LIST, { diagonal: true });

	// - Simplified function -

	function pathfind(start, end) {
		let convertedStart = weightGraph.grid[start.y][start.x];
		let convertedEnd = weightGraph.grid[end.y][end.x];
		let result = astar.search(
			weightGraph, 
			convertedStart,
			convertedEnd,
			{ heuristic: astar.heuristics.diagonal });
		let final = [];

		for (let point = 0; point < result.length; point++) {
			let pointData = result[point];
			final.push(vec2(pointData.y, pointData.x));
		}

		return final;
	}

	// --- PATHFINDER GOAL LIST ---

	const PATHFIND_GOAL_LIST = [];

	for (let row = 0; row < HITBOX_GRAPH_LIST.length; row++) {
		for (let column = 0; column < HITBOX_GRAPH_LIST[0].length; column++) {
			let weight = HITBOX_GRAPH_LIST[row][column];

			if (weight == 1) {
				PATHFIND_GOAL_LIST.push(vec2(column, row));
			}
		}
	}

	// --- COIN PATHFINDING DETOUR PREP ---

	const WALL_OBJECTS = [];

	get('wall', { recursive: true }).forEach((w) => {
		WALL_OBJECTS.push(w);
	})

	function isLineOfSightBetween(eye, target) {
		if (!onScreenFrom(eye, target)) {return false;}
	
		let isSightObstructed = false;
		let sightLine = new Line(eye, target);
		let sightLineBBox = new Rect(
			vec2(
				Math.min(eye.x, target.x),
				Math.min(eye.y, target.y),
			),
			Math.abs(eye.x - target.x),
			Math.abs(eye.y - target.y),
		);

		WALL_OBJECTS.forEach((wo) => {
			let wallBBox = Rect.fromPoints(wo.pos, wo.pos.add(SCALE));

			if (testRectRect(wallBBox, sightLineBBox)) {
				if (testRectLine(wallBBox, sightLine)) {
					isSightObstructed = true;
				}
			}
		});

		return !isSightObstructed;
	}

	// --- PATHFINDING FUNCTIONS ---

	function choosePathfindGoal(npc) {
		let startTile = toTile(npc.pos);
		let goalCandidate;

		for (let i = 0; i < 1000; i++) {
			goalCandidate = chooseItem(PATHFIND_GOAL_LIST);

			if (startTile.sdist(goalCandidate) > 25) {
				npc.pathfind.mainGoal = goalCandidate;
				break;
			}
		}

		npc.pathfind.path = pathfind(startTile, npc.pathfind.mainGoal);
	}

	// Armory-specific

	function armoryPathfind(npc) {
		npc.pathfind.path = pathfind(
			toTile(npc.pos),
			toTile(armoryBlaster.pos),
		);
		npc.pathfind.mode = 'GET_ARMORY';

		npc.pathfind.path.pop();
	}

	// --- PERSON SPAWN ---

	function useSpawnPoint() {
		let spawnPoint = chooseItem(possibleSpawnPoints);

		const index = possibleSpawnPoints.indexOf(spawnPoint);
		if (index > -1) {
			possibleSpawnPoints.splice(index, 1);
		}

		return spawnPoint;
	}

	// Create hitboxes

	let personHitboxPointList = [];
	let phplSides = 8;
	let tau = Math.PI * 2;

	for (let i = 0; i < phplSides; i++) {
		personHitboxPointList.push(vec2(
			Math.cos(i/phplSides * tau),
			Math.sin(i/phplSides * tau)
		).scale(250 * PERSON_HITBOX_SCALE));
	}

	// Spawn YOU

	const player = add([
		sprite('person'),
		pos(useSpawnPoint()),
		scale(SCALE/500),
		anchor('center'),
		rotate(0),
		opacity(0),
		area({ 
			shape: new Polygon(personHitboxPointList),
			collisionIgnore: ['person'],
		}),
		body(),
		z(L.players + 1),
		{
			isNPC: false,
			puppet: null,
			acceleration: 0,
			rotationAcceleration: 0,
			coins: 0,
			role: 'NONE',
			lastBoostTime: -BOOST_COOLDOWN,
			lastAttackTime: INITIAL_ATTACK_COOLDOWN,
			inventory: {
				slots: ['BOOST', 'NONE', 'NONE'],
				selected: 1
			}
		},
		'person',
		'player'
	])

	// Spawn NPCs

	let reamainingSpawns = possibleSpawnPoints.length;

	for (let i = 0; i < reamainingSpawns; i++) {
		let npc = add([
			sprite('person'),
			pos(useSpawnPoint()),
			scale(SCALE/500),
			anchor('center'),
			rotate(0),
			opacity(0),
			area({ 
				shape: new Polygon(personHitboxPointList),
				collisionIgnore: ['person'],
			}),
			body(),
			z(L.players),
			{
				isNPC: true,
				puppet: null,
				acceleration: 0,
				rotationTween: false,
				fakeAngle: 0,
				coins: 0,
				role: 'NONE',
				lastBoostTime: -BOOST_COOLDOWN,
				lastAttackTime: INITIAL_ATTACK_COOLDOWN,
				witness: {
					suspect: null,
					timestamp: null,
				},
				inventory: {
					slots: ['BOOST', 'NONE', 'NONE'],
					selected: 1
				},
				pathfind: {
					mainGoal: vec2(0),
					mode: 'MAIN',
					path: [],
					trapped: {
						posHistory: [vec2(-SCALE), vec2(-SCALE), vec2(-SCALE)],
						liberationTime: -10,
					},
					secondary: {
						goal: vec2(0),	// generic
						coinID: 0,		// coin chaser
						victim: null,	// attack
					},
				}
			},
			'person',
			'npc'
		])

		choosePathfindGoal(npc);
	} 

	// --- PEOPLE SKINS ---

	get('person').forEach((person) => {
		person.puppet = add([
			sprite('person2', { anim: 'front' }),
			pos(0,0),
			anchor('bot'),
			scale(SCALE/45 * PUPPET_SIZE),
			z(L.players + 1),
			area(),
			{
				master: person,
			},
			'puppet',
		])
	})

	// --- BOOSTER ---
	
	function useBoost(who) {
		if (time() - who.lastBoostTime > BOOST_COOLDOWN) {
			who.lastBoostTime = time();
		}
	}
	
	function isBoostActive(who) {
		return (time() - who.lastBoostTime < BOOST_DURATION);
	}

	function getBoostMulti(who) {
		if (isBoostActive(who)) {
			return BOOST_MULTIPLIER;
		} else {
			return 1;
		}
	}

	// --- INVENTORY FUNCTIONS ---

	// Choose a slot
	function selectInventorySlot(who, number) {
		who.inventory.selected = number;

		if (who == player) {
			debug.log(`${number}: ${checkSelectedSlot(who)}`);
		}
	}

	// Use the item in current slot
	function useSelectedItem(who) {
		let item = checkSelectedSlot(who);

		if (item == 'BLADE') {
			attackAttempt(who, 'MELEE');
		} else if (item == 'BLASTER') {
			attackAttempt(who, 'RANGED')
		} else if (item == 'BOOST') {
			useBoost(who);
		}

		return (item != 'NONE'); // True if item exists
	}

	// --- INTERACTIONS ---

	function interactionCheck(who) {
		if (isLineOfSightBetween(who.pos, armoryBlaster.pos) && who.pos.dist(armoryBlaster.pos) < SCALE*ARMORY_USE_RANGE) {
			if (who.inventory.slots[2] == 'NONE' && who.coins >= ARMORY_USE_COST) {
				who.inventory.slots[2] = 'BLASTER';
				who.coins -= ARMORY_USE_COST;

				if (who.isNpc) {
					who.pathfind.mode = 'MAIN'; 
					choosePathfindGoal(who);
				}
			}
		}
	}

	// --- ROLE ASSIGNMENT ---

	let murdererNumber = randi(MAX_PLAYER_COUNT);
	let sheriffNumber;

	// Get a sheriff ID that doens't match the murderer's
	for (let i = 0; i < 1000; i++) {
		sheriffNumber = randi(MAX_PLAYER_COUNT);
		if (sheriffNumber != murdererNumber) {
			break;
		}
	}

	// - Assignment Function -
	function setRole(who, role) {
		who.role = role;

		who.inventory.slots[2] = {
			'INNOCENT': 'NONE',
			'MURDERER': 'BLADE',
			'SHERIFF': 'BLASTER',
		}[role];

		if (true) {
		//if (who.is('player') || who.role == 'SHERIFF') {
			who.use(color({
				'INNOCENT': GREEN,
				'MURDERER': RED,
				'SHERIFF': rgb(0,127,255),
			}[role]));

			who.puppet.use(color(who.color))
		}

		if (role == 'SHERIFF') {
			who.lastAttackTime = -RANGED_ATTACK_COOLDOWN;
		} else if (role == 'MURDERER') {
			who.lastAttackTime = -MELEE_ATTACK_COOLDOWN;
		}
	}

	// - Assign Roles -
	let iter = -1;
	get('person').forEach((p) => {
		iter++;

		if (iter == murdererNumber) {
			setRole(p, 'MURDERER');
			p.lastAttackTime += INITIAL_ATTACK_COOLDOWN;

		} else if (iter == sheriffNumber) {
			setRole(p, 'SHERIFF');
			p.lastAttackTime += INITIAL_ATTACK_COOLDOWN;

		} else {
			setRole(p, 'INNOCENT');
		}
	})

	// --- RESPECTIVE ATTACK INDICATORS ---

	let playerMeleeIndicator;
	let playerRangedIndicator;

	if (player.role == 'MURDERER') {
		playerMeleeIndicator = add([
			circle(SCALE * MELEE_ATTACK_DISTANCE),
			pos(0,0),
			anchor('center'),
			color(WHITE),
			opacity(0),
			z(L.players - 1),
		])
		
		
	} else {
		// Ranged indicator exists for both sheriff AND innocent because innocents can arm themselves
		playerRangedIndicator = add([
			rect(SCALE*100, SCALE*0.1),
			pos(0,0),
			anchor('left'),
			rotate(0),
			opacity(0),
			color(WHITE),
			z(L.players - 1),
		])
	}

	// --- COIN SPAWNING ---

	function spawnCoin() {
		wait(rand(1,5), () => {
			let spawnPoint;
			let isCoinSpawnable = false;

			for (let i = 0; i < 1000; i++) {
				// If all spawn points are in use
				if (usedCoinSpawnPoints.length == coinSpawnPoints.length) {
					break;
				}

				spawnPoint = chooseItem(coinSpawnPoints);

				// If spawn point is available
				if (!usedCoinSpawnPoints.includes(spawnPoint)) {
					isCoinSpawnable = true;
					usedCoinSpawnPoints.push(spawnPoint);
					break;
				}
			}

			// Spawn the coin if all conditions are met
			if (isCoinSpawnable) {
				add([
					sprite('coin'),
					pos(spawnPoint.add(SCALE * rand(-0.4, 0.4))),
					scale(SCALE/500),
					color(YELLOW),
					area(),
					z(L.players - 1),
					'coin',
					{
						spawnPoint: spawnPoint,
						coinID: rand(),
					}
				])
			}

			spawnCoin();
		})
	}

	spawnCoin();

	// --- COIN COLLISION ---

	onCollide('person', 'coin', (p, c) => {
		// Take this coin's spawn point out of the in-use point list
		const index = usedCoinSpawnPoints.indexOf(c.spawnPoint);
		if (index > -1) {
			usedCoinSpawnPoints.splice(index, 1);
		}

		// Stop NPCs from tracking this coin
		let trackerTag = `trackCoin${c.coinID}`;
		get(trackerTag).forEach((npc) => {
			npc.unuse(trackerTag);
			npc.pathfind.mode = 'MAIN';
			npc.pathfind.path = pathfind(
				toTile(npc.pos.add(SCALE/2)),
				npc.pathfind.mainGoal
			);
		})

		destroy(c);
		p.coins += 1;

		if (p == player) debug.log(p.coins);
	})

	// --- JUSTICE FUNCTIONS ---

	function attemptPursuit(who) {
		selectInventorySlot(who, 2);

		who.pathfind.mode = 'GET_SUSPECT';
		who.pathfind.secondary.goal = toTile(who.witness.suspect.pos);
		who.pathfind.path = pathfind(
			toTile(who.pos.add(SCALE/2)),
			who.pathfind.secondary.goal
		);

		if (who.pos.dist(who.witness.suspect.pos) > SCALE*6) {
			useBoost(who);
		}
	}

	function cancelPursuit(who) {
		selectInventorySlot(who, 1);

		who.pathfind.mode = 'MAIN';
		who.pathfind.secondary.goal = vec2(0);

		choosePathfindGoal(who);
	}

	function boostEscapeCheck(who) {
		if (who.witness.suspect && who.pos.dist(who.witness.suspect.pos) < SCALE*4) {
			if (who.inventory.slots[2] == 'NONE' || !isAttackCooldownDone(who)) {
				// If suspect nearby + unarmed
				useBoost(who);
			}
		}
	}

	function prepareEscapePath(who) {
		for (let i = 0; i < 100; i++) {
			if (who.pathfind.path.length >= 2) {
				let nextNode = fromTile(who.pathfind.path[1]);
				let sPos = who.witness.suspect.pos;

				// If approaching suspect (that's bad)
				if (who.pos.sdist(sPos) > nextNode.sdist(sPos)) {
					choosePathfindGoal(who);
				} else {
					who.pathfind.mode = 'ESCAPE';
					break;
				}
			} else {
				choosePathfindGoal(who);
				//prepareEscapePath(who);
			}
		}
	}

	// --- NPC AI COIN REROUTE ---

	loop(0.5, () => {
		let activeCoinList = [];
		get('coin').forEach((c) => {
			activeCoinList.push(c);
		})

		get('npc').forEach((npc) => {
			// Not already tracking a coin
			if (getModePriority(npc.pathfind.mode) < getModePriority('COIN')) {
				let nearestCoin = {id: 0, sdist: 0, obj: 0};

				// Find the nearest visible coin
				for (let i = 0; i < activeCoinList.length; i++) {
					let coin = activeCoinList[i];
					let isCoinVisible = isLineOfSightBetween(npc.pos.add(SCALE/2), coin.pos.add(SCALE/2));

					if (isCoinVisible) {
						let sdistToCoin = npc.pos.sdist(coin.pos);

						// If no nearest coin or new nearest coin
						if (nearestCoin.id == 0 || nearestCoin.sdist > sdistToCoin) {
							nearestCoin = {
								id: coin.coinID,
								sdist: sdistToCoin,
								obj: coin,
							}
						}
					}
				}

				// Coin located?
				if (nearestCoin.id != 0 && getModePriority(npc.pathfind.mode) < getModePriority('COIN')) {
					// Begin following nearest visible coin
					npc.use(`trackCoin${nearestCoin.id}`);
					npc.pathfind.mode = 'COIN';
					npc.pathfind.secondary.coinID = nearestCoin.id;
					npc.pathfind.secondary.goal = toTile(nearestCoin.obj.pos);
	
					npc.pathfind.path = pathfind(
						toTile(npc.pos.add(SCALE/2)),
						npc.pathfind.secondary.goal
					);
				}

			}

			// --- CHECK FOR TRAPPED NPCS ---

			let posHistory = npc.pathfind.trapped.posHistory;

			// Check if all points are near each other and the NPC
			let isTrapped = true;
			for (let i = 0; i < 3; i++) {
				if (posHistory[i].sdist(npc.pos) > 0.5*SCALE*SCALE) {
					isTrapped = false;
				}
			}

			if (isTrapped && time() - npc.pathfind.trapped.liberationTime > 1) {
				console.log(`TRAPPED! at ${time()}`);
				npc.pathfind.trapped.liberationTime = time();
				npc.rotationTween.cancel();
				npc.rotationTween = tween(
					npc.angle, npc.angle + 180,
					0.5,
					(v) => {
						npc.angle = v;
					},
					easings.easeOutQuad
				);

				// Give it a new path just in case
				choosePathfindGoal(npc);
			}
			
			// Update history list and restrict length to 3
			posHistory.push(npc.pos);
			posHistory.shift();

			// --- MURDERER CHASE REROUTE ---

			if (npc.role == 'MURDERER') {
				if (isAttackCooldownDone(npc)) {
					let visiblePeopleList = getPeopleVisibleTo(npc);
					
					if (visiblePeopleList.length == 1) {
						// Alone with another
						let newVictim = visiblePeopleList[0];

						npc.pathfind.secondary.victim = newVictim;
						npc.pathfind.secondary.goal = toTile(newVictim.pos.add(SCALE/2));

						setMurdererPathToVictim(npc);
					} else {
						if (npc.pathfind.mode == 'MURDER' && isLineOfSightBetween(npc.pos, npc.pathfind.secondary.victim.pos)) {
							// Already chasing a visible person BUT no longer alone with victim
							setMurdererPathToVictim(npc);
						}
					}
				}

			// --- REROUTE TO SHERIFF HAT ---

			} else { 
				if (GAME_STATE.isSheriffHatDropped && isLineOfSightBetween(npc.pos, GAME_STATE.droppedSheriffHat.pos)) {
					// If innocent and the hat exists in view...
					if (getModePriority(npc.pathfind.mode) < getModePriority('GET_HAT')) {
						npc.pathfind.mode = 'GET_HAT';
						npc.pathfind.secondary.goal = toTile(GAME_STATE.droppedSheriffHat.pos);
						npc.pathfind.path = pathfind(
							toTile(npc.pos.add(SCALE/2)),
							npc.pathfind.secondary.goal
						);
					}
				}

				// --- ATTACK SUSPECT ---

				if (npc.pathfind.mode == 'GET_SUSPECT' && isAttackCooldownDone(npc) && isLineOfSightBetween(npc.pos, npc.witness.suspect.pos)) {
					npc.angle = npc.witness.suspect.pos.angle(npc.pos) + 90;

					let visiblePeopleList = getPeopleVisibleTo(npc);
					let canShoot = true;

					// For testing collision
					let attackLineArea = add([
						rect(SCALE*7, SCALE*0.1),
						pos(npc.pos),
						anchor('left'),
						rotate(npc.angle - 90),
						opacity(0),
						area(),
					])

					// Check if innocents will be caught in the crossfire
					visiblePeopleList.forEach((person) => {
						if (person != npc.witness.suspect) {
							// Too close?
							if (person.pos.sdist(npc.pos) < (SCALE*2)**2) {
								canShoot = false;
							}

							// In attack line?
							if (attackLineArea.isColliding(person)) {
								canShoot = false;
							}
						}
					})

					destroy(attackLineArea);
					if (canShoot) useSelectedItem(npc);
				}

				// If suspect in sight...
				if (npc.witness.suspect && isLineOfSightBetween(npc.pos, npc.witness.suspect.pos)) {
					
					// --- PURSUIT SUSPECT ---
					
					if (isAttackCooldownDone(npc) && npc.inventory.slots[2] != 'NONE') {
						if (getModePriority(npc.pathfind.mode) < getModePriority('GET_SUSPECT')) {
							attemptPursuit(npc);
						}

					} else {

						// --- ESCAPE THE SUSPECT ---

						boostEscapeCheck(npc);
						prepareEscapePath(npc);
						
					}
				}

				// --- ARMORY USE ---

				if (npc.coins >= ARMORY_USE_COST && npc.inventory.slots[2] == 'NONE') {
					if (getModePriority(npc.pathfind.mode) < getModePriority('GET_ARMORY')) {
						// - Pathfind -
						armoryPathfind(npc);

					} else if (npc.pathfind.mode == 'GET_ARMORY') {
						// - Purchase - 
						interactionCheck(npc);
					}
				}

			}

		})
	});

	// --- DEBUG TOGGLE ---

	onKeyPress('0', () => {
		debug.inspect = !debug.inspect;
	})
	
	debug.zoomOut = false;
	onKeyPress('9', () => {
		debug.zoomOut = !debug.zoomOut;

		if (debug.zoomOut) {
			camScale(0.4);
			raycastedWallEffect.use(opacity(0.5));
		} else { 
			camScale(1);
			raycastedWallEffect.use(opacity(1));
		};
	})

	// --- DEATH FUNCTIONS ---

	function murderEvent(victim, murderer) {
		if (murderer) witnessCheck(victim, murderer);
		deathEffect(victim);
	}

	// - Witness and suspect control -
	function witnessCheck(victim, murderer) {
		let witnesses = getPeopleVisibleTo(victim);

		debug.log(`witnesses: ${witnesses.length - 1}`)
		for (let i = 0; i < witnesses.length; i++) {
			let witness = witnesses[i];

			if (witness != murderer && witness != player) {
				if (isLineOfSightBetween(witness.pos, murderer.pos)) {
					// If the witness can see both the victim and murderer...
					witness.witness.suspect = murderer;
					prepareEscapePath(witness);
					boostEscapeCheck(witness);
				}
			}
		}
	}
	
	// - Grvaestones and other effects -
	function deathEffect(victim) {
		let centerPos = victim.pos;//.add(SCALE/2);

		add([
			sprite('gravestone'), 
			pos(centerPos),
			anchor('center'),
			scale(SCALE/500 * 0.6),
			z(L.floor + 5),
			area(),
			color(rgb(127,127,127)),
		])

		if (victim.role == 'SHERIFF') {
			let hat = add([
				sprite('sheriffDrop'),
				pos(centerPos),
				anchor('center'),
				scale(SCALE/500 * 0.4),
				z(L.floor + 6),
				area(),
				color(BLUE),
				"sheriffDrop"
			])

			GAME_STATE.isSheriffHatDropped = true;
			GAME_STATE.droppedSheriffHat = hat;
			debug.log('sheriff has perished D:')
		}

		if (victim.role == 'MURDERER') {
			debug.log('MURDERER has perished')
		}

		destroy(victim.puppet);
		destroy(victim);
		debug.log('womp womp')
	}

	// --- ATTACKING ---

	function getPeopleVisibleTo(person) {
		let list = [];

		get('person').forEach((p) => {
			// Visible and not itself
			if (isLineOfSightBetween(person.pos, p.pos) && p != person) {
				list.push(p);
			}
		})

		return list;
	}

	function getNearestVisiblePersonTo(person) {
		let currentNearest = {sdist: 0, obj: null};
		let peopleList = getPeopleVisibleTo(person);

		peopleList.forEach((p) => {
			let sdist = person.pos.sdist(p.pos);
			if (currentNearest.obj == null || sdist < currentNearest.sdist) {
				currentNearest = {
					sdist: sdist,
					obj: p,
				}
			}
		})

		return currentNearest.obj;
	}

	function setMurdererPathToVictim(who) {
		who.pathfind.mode = 'MURDER';
		selectInventorySlot(who, 2);

		who.pathfind.secondary.goal = toTile(who.pathfind.secondary.victim.pos.add(SCALE/2));

		who.pathfind.path = pathfind(
			toTile(who.pos.add(SCALE/2)),
			who.pathfind.secondary.goal
		);
	}

	function cancelMurdererAttempt(who) {
		who.pathfind.mode = 'MAIN';
		selectInventorySlot(who, 1);

		who.pathfind.secondary.goal = vec2(0);
		who.pathfind.secondary.victim = null;

		choosePathfindGoal(who);
	}

	function attackAttempt(attacker, attackStyle) {
		if (isAttackCooldownDone(attacker)) {
			if (attackStyle == 'MELEE') {
				let victim = getNearestVisiblePersonTo(attacker);
				
				if (victim != null) {
					let attackRange = SCALE * MELEE_ATTACK_DISTANCE;
					if (attacker.pos.sdist(victim.pos) <= attackRange**2) {
						murderEvent(victim, attacker);
						attacker.lastAttackTime = time();

						if (attacker.isNPC) {
							cancelMurdererAttempt(attacker);
						}
					}
				}
			} else if (attackStyle == 'RANGED') {
				//let angle = toWorld(mousePos()).angle(attacker.pos);
				let angle = attacker.angle - 90;
				
				add([
					sprite('bullet'),
					pos(attacker.pos),
					scale(SCALE/500 * 0.5),
					rotate(angle + 90),
					anchor('center'),
					move(angle, SCALE * BLASTER_BULLET_SPEED),
					area(),
					"bullet",
					{
						source: attacker,
					}
				])

				attacker.lastAttackTime = time();
			}
		}
	}
	
	function isAttackCooldownDone(who) {
		if (who.role == 'MURDERER') {
			return (time() - who.lastAttackTime > MELEE_ATTACK_COOLDOWN);
		} else {
			return (time() - who.lastAttackTime > RANGED_ATTACK_COOLDOWN);
		}
	}

	// --- BULLET COLLISION ---

	onCollide('bullet', 'puppet', (b, p) => {
		let person = p.master;

		if (b.source != person) {
			// If the victim was innocent, kill the sheriff
			if (person.role != 'MURDERER') {
				murderEvent(b.source, null);
			}

			murderEvent(person, null);
			destroy(b);
		}
	})

	onCollide('bullet', 'wall', (b, w) => {
		destroy(b);
	})

	// --- SHERIFF DROP COLLECTION ---

	onCollide('person', 'sheriffDrop', (p, sd) => {
		if (p.role == 'INNOCENT') {
			destroy(sd);
			setRole(p, 'SHERIFF')
			GAME_STATE.isSheriffHatDropped = false;
			GAME_STATE.droppedSheriffHat = null;
		}
	})

	// --- KEY PRESS EVENTS ---

	onKeyPress('space', () => {
		let itemWasUsed = useSelectedItem(player);

		if (itemWasUsed == false) {
			interactionCheck(player);
		}
	})

	onKeyPress('1', () => { selectInventorySlot(player, 0); });
	onKeyPress('2', () => { selectInventorySlot(player, 1); });
	onKeyPress('3', () => { selectInventorySlot(player, 2); }); 

 
	onUpdate(() => {
		// --- PLAYER ROTATION INPUTS ---

		// - Tank mode -
		if (movementInputStyle == 'tank') {
			if (isKeyDown('a')) {
				player.rotationAcceleration += dt() * TURNING_ACCELERATION;
			} else if (isKeyDown('d')) {
				player.rotationAcceleration -= dt() * TURNING_ACCELERATION;
			} else {
				// Deceleration
				let pra = player.rotationAcceleration;
				let speedDiff = dt() * TURNING_ACCELERATION;

				if (pra > 0) {
					// Positive
					if (pra - speedDiff < 0) {
						player.rotationAcceleration = 0;
					} else {
						player.rotationAcceleration -= speedDiff;
					}
				} else if (pra < 0) {
					// Negative
					if (pra + speedDiff > 0) {
						player.rotationAcceleration = 0;
					} else {
						player.rotationAcceleration += speedDiff;
					}
				}
			}

			player.rotationAcceleration = Math.max(-1, Math.min(player.rotationAcceleration, 1));

			player.angle -= player.rotationAcceleration * dt() * TURNING_SPEED;

		// - Point mode -
		} else if (movementInputStyle == 'point') {
			player.angle = toWorld(mousePos()).angle(player.pos) + 90;
		}

		// --- PLAYER MOVEMENT INPUTS ---

		let isWalking = movementInputStyle == 'tank' ? isKeyDown('w') : isMouseDown();

		if (isWalking) {
			player.acceleration += dt() * WALKING_ACCELERATION;
		} else {
			player.acceleration -= dt() * WALKING_ACCELERATION;
		}


		player.acceleration = Math.max(0, Math.min(player.acceleration, 1));

		let displacement = Vec2.fromAngle(player.angle - 90).scale(
			WALKING_SPEED * SCALE * dt() * player.acceleration * getBoostMulti(player));

		player.pos = player.pos.add(displacement);

		
		get('npc').forEach((npc) => {
			/*if (npc.pathfind.mode == 'COIN') {
				npc.scale = vec2(SCALE/500 * (1 + 0.2*Math.sin(time()*15)));
			} else {
				npc.scale = vec2(SCALE/500);
			}*/
			
			// --- END OF PATH BEHAVIOR ---

			if (npc.pathfind.path.length == 0) {
				// - Murderer -
				if (npc.pathfind.mode == 'MURDER') {
					if (isLineOfSightBetween(npc.pos, npc.pathfind.secondary.victim.pos)) {
						setMurdererPathToVictim(npc);
					} else {
						cancelMurdererAttempt(npc);
					}

				// - Suspect-chaser -
				} else if (npc.pathfind.mode == 'GET_SUSPECT') {
					if (isLineOfSightBetween(npc.pos, npc.witness.suspect.pos)) {
						attemptPursuit(npc);
					} else {
						cancelPursuit(npc);
					}

				} else if (npc.pathfind.mode == 'ESCAPE') {
					if (isLineOfSightBetween(npc.pos, npc.witness.suspect.pos)) {
						boostEscapeCheck(npc);
						prepareEscapePath(npc);
					} else {
						npc.pathfind.mode = 'MAIN';
						choosePathfindGoal(npc);
					}
					
				// - Average innocent -
				} else {
					choosePathfindGoal(npc);
				}

			// --- NPC MOVEMENTS ---
				
			} else if (time() - npc.pathfind.trapped.liberationTime > 0.5) {
				// - Rotation -
				if (npc.rotationTween) npc.rotationTween.cancel();
				
				let startAngle = npc.fakeAngle;
				let endAngle = fromTile(npc.pathfind.path[0]).angle(npc.pos);
				if (startAngle - endAngle > 180) endAngle += 360;
				if (startAngle - endAngle < -180) endAngle -= 360;
	
				npc.rotationTween = tween(
					startAngle, endAngle,
					AI_ROTATION_TWEEN_DURATION,
					(v) => {
						npc.fakeAngle = v; 
						npc.angle = npc.fakeAngle+90;
					},
					easings.easeOutQuad
				);
	
				// - Movement -
				let distanceToEndAngle = Math.abs(endAngle - startAngle);

				if (distanceToEndAngle < 900) {
					let displacement = Vec2.fromAngle(npc.angle + 90).scale(
						-WALKING_SPEED * SCALE * dt() * getBoostMulti(npc));
			
					npc.pos = npc.pos.add(displacement);
				}
	
				// - Waypoint navigation -
				if (toTile(npc.pos).sdist(npc.pathfind.path[0]) < 1) {
					npc.pathfind.path.shift();
				}

			}

			// --- MURDERER MURDERING ---

			if (npc.role == 'MURDERER' && npc.pathfind.secondary.victim != null) {
				let attackRange = SCALE * MELEE_ATTACK_DISTANCE;

				if (npc.pos.sdist(npc.pathfind.secondary.victim.pos) <= attackRange**2) {
					let witnesses = getPeopleVisibleTo(npc).length - 1;

					if (witnesses <= 1) {
						useSelectedItem(npc);
					}
				}
			}
		})

		// --- PUPPET VISUALS --- 

		get('person').forEach((person) => {
			let puppet = person.puppet;

			puppet.pos = person.pos.add(0, SCALE*PUPPET_OFFSET);

			let curAnim = puppet.getCurAnim().name;
			let newAnim;
			let fixedAngle = fixAngle(person.angle);

			if (fixedAngle >= 45 && fixedAngle < 135) {
				// RIGHT
				newAnim = 'side';
				puppet.flipX = false;

			} else if (fixedAngle >= 135 && fixedAngle < 225) {
				// DOWN
				newAnim = 'front';
				puppet.flipX = false;

			} else if (fixedAngle >= 225 && fixedAngle < 315) {
				// LEFT
				newAnim = 'side';
				puppet.flipX = true;

			} else if (fixedAngle >= 315 || fixedAngle < 45) {
				// UP
				newAnim = 'back';
				puppet.flipX = false;
			}

			if (newAnim != curAnim) puppet.play(newAnim);
		})

		// --- ATTACK INDICATOR VISUALS ---

		// Melee indicator
		if (playerMeleeIndicator) {
			playerMeleeIndicator.pos = player.pos;

			if (checkSelectedSlot(player) == 'BLADE') {
				playerMeleeIndicator.opacity = MELEE_INDICATOR_OPACITY;
			} else {
				playerMeleeIndicator.opacity = 0;
			}
		}

		// Ranged indicator
		if (playerRangedIndicator) {
			playerRangedIndicator.pos = player.pos;
			playerRangedIndicator.angle = toWorld(mousePos()).angle(player.pos);

			if (checkSelectedSlot(player) == 'BLASTER') {
				playerRangedIndicator.opacity = RANGED_INDICATOR_OPACITY;
			} else {
				playerRangedIndicator.opacity = 0;
			}
		}

		// --- ARMORY EFFECTS ---

		if (checkSelectedSlot(player) == 'NONE' && isLineOfSightBetween(armoryBlaster.pos, player.pos) && armoryBlaster.pos.dist(player.pos) < SCALE*ARMORY_USE_RANGE) {
			armoryBlaster.use(color(WHITE));
		} else {
			armoryBlaster.use(color(BLUE));
		}

		// --- CAMERA EFFECTS ---

		camPos(player.pos);
	})

	// --- ON DRAW ---

	onDraw(() => {
		drawWallMask();
	})

});

go('game');