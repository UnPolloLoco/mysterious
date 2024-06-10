scene('game', () => {

	// --- LAYERS ---

	const L = {
		floor:   0,
		players: 100,
		walls:   200,
		ui:      300,
	}
	
	// --- MAP CREATION ---

	function getBehavior(char) {
		let tileInfo = MAP_ICON_INFO[char];
		if (tileInfo == undefined) return 'NONE';
		return tileInfo.behavior;
	}

	let possibleSpawnPoints = [];
	let coinSpawnPoints = [];
	let usedCoinSpawnPoints = [];

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
					tile.use(z(L.walls));
				}

				// Floor, spawn, OR coin tile
				if (['FLOOR', 'SPAWN', 'COIN'].includes(tileBehavior)) {
					tile.use(color(rgb(60,60,60)));

					// Spawn tile only
					if (tileBehavior == 'SPAWN') {
						possibleSpawnPoints.push(tilePosition.add(SCALE/2));
					}
					// Coin tile only
					if (tileBehavior == 'COIN') {
						coinSpawnPoints.push(tilePosition);
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
		for (let i = 0; i < 360; i += 0.1) {
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


	// --- PERSON SPAWN ---

	function useSpawnPoint() {
		let spawnPoint = chooseItem(possibleSpawnPoints);

		const index = possibleSpawnPoints.indexOf(spawnPoint);
		if (index > -1) {
			possibleSpawnPoints.splice(index, 1);
		}

		return spawnPoint;
	}

	// Spawn YOU

	const player = add([
		sprite('block'),
		pos(useSpawnPoint()),
		scale(SCALE/500),
		anchor('center'),
		rotate(0),
		area({ collisionIgnore: ['person'] }),
		body(),
		z(L.players + 1),
		{
			acceleration: 0,
			rotationAcceleration: 0,
			coins: 0,
			role: 'NONE',
		},
		'person',
		'player'
	])

	// Spawn NPCs

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

	let reamainingSpawns = possibleSpawnPoints.length;

	for (let i = 0; i < reamainingSpawns; i++) {
		let npc = add([
			sprite('block'),
			pos(useSpawnPoint()),
			scale(SCALE/500),
			anchor('center'),
			rotate(0),
			area({ collisionIgnore: ['person'] }),
			body(),
			z(L.players),
			{
				acceleration: 0,
				rotationTween: false,
				fakeAngle: 0,
				coins: 0,
				role: 'NONE',
				pathfind: {
					mainGoal: vec2(0),
					mode: 'MAIN',
					path: [],
					coin: {
						coinID: 0,
						goal: vec2(0)
					},
				}
			},
			'person',
			'npc'
		])

		choosePathfindGoal(npc);
	}

	// --- ROLE ASSIGNMENT ---

	let murdererNumber = randi(MAX_PLAYER_COUNT);
	let sheriffNumber;

	// Get a sheriff ID that doens't match the murderer's
	for (let i = 0; i < 100; i++) {
		sheriffNumber = randi(MAX_PLAYER_COUNT);
		if (sheriffNumber != murdererNumber) {
			break;
		}
	}

	// Assign roles
	let iter = -1;
	get('person').forEach((p) => {
		iter++;

		if (iter == murdererNumber) {
			p.role = 'MURDERER';
			p.use(color(RED));
		} else if (iter == sheriffNumber) {
			p.role = 'SHERIFF';
			p.use(color(rgb(0,127,255)));
		} else {
			p.role = 'INNOCENT';
			p.use(color(GREEN));
		}
	})

	// --- COIN SPAWNING ---

	function spawnCoin() {
		wait(rand(1,5), () => {
			let spawnPoint;
			let isCoinSpawnable = false;

			for (let i = 0; i < 100; i++) {
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
	})

	// --- NPC AI COIN REROUTE ---

	loop(0.5, () => {
		let activeCoinList = [];
		get('coin').forEach((c) => {
			activeCoinList.push(c);
		})

		get('npc').forEach((npc) => {
			// Not already tracking a coin
			if (npc.pathfind.mode != 'COIN') {
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
				if (nearestCoin.id != 0) {
					// Begin following nearest visible coin
					npc.use(`trackCoin${nearestCoin.id}`);
					npc.pathfind.mode = 'COIN';
					npc.pathfind.coin.coinID = nearestCoin.id;
					npc.pathfind.coin.goal = toTile(nearestCoin.obj.pos);
	
					npc.pathfind.path = pathfind(
						toTile(npc.pos.add(SCALE/2)),
						npc.pathfind.coin.goal
					);
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

		if (debug.zoomOut) { camScale(0.2); }
		else { camScale(1); };
	})

	let movementInputStyle = ['tank', 'point'][1];

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
			WALKING_SPEED * SCALE * dt() * player.acceleration);

		player.pos = player.pos.add(displacement);

		// --- NPC MOVEMENTS ---

		get('npc').forEach((npc) => {
			if (npc.pathfind.path.length == 0) {
				// - New path -
				choosePathfindGoal(npc);

			} else {
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
						-WALKING_SPEED * SCALE * dt());
			
					npc.pos = npc.pos.add(displacement);
				}
	
				// - Waypoint navigation -
				if (toTile(npc.pos).sdist(npc.pathfind.path[0]) < 1) {
					npc.pathfind.path.shift();
				}

			}
		})

		// --- CAMERA EFFECTS ---

		camPos(player.pos);
	})

	// --- ON DRAW ---

	onDraw(() => {
		drawWallMask();
	})

});

go('game');
