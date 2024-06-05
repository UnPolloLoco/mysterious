scene('game', () => {

	// --- MAP CREATION ---

	function getBehavior(char) {
		let tileInfo = MAP_ICON_INFO[char];
		if (tileInfo == undefined) return 'NONE';
		return tileInfo.behavior;
	}

	var possibleSpawnPoints = [];

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
				}

				// Floor OR spawn point tile
				if (['FLOOR', 'SPAWN'].includes(tileBehavior)) {
					tile.use(color(BLUE));
					// Spawn tile only
					if (tileBehavior == 'SPAWN') {
						possibleSpawnPoints.push(tilePosition.add(SCALE/2));
					}
				}

			}
		}
	}

	// --- SPECIAL WALLS CREATION ---

	const wallLevel = addLevel(MAP, {
		tileWidth: SCALE, tileHeight: SCALE,
		tiles: {
			'#': () => [
				rect(SCALE, SCALE),
				color(GREEN),
				area(),
				body({ isStatic: true }),
				tile({ isObstacle: true }),
				opacity(0.7),
			]
		}
	});

	function drawWallMask() {
		// Thank you Kaplay Playground
		// Raycast
		const pts = [player.pos];
		for (let i = 0; i < 360; i += 0.1) {
			const hit = wallLevel.raycast(player.pos, Vec2.fromAngle(i));
			
			if (hit) {
				let point = hit.point;
				pts.push(point);

				if (false) drawRect({
					pos: point.sub(3),
					width: 6,
					height: 6,
					color: RED,
				})
			} else {
				//debug.log('no point :(')
			}
		}
		pts.push(pts[1]);

		// Subtraction creation

		let edgeOffset = 1;

		drawSubtracted(
			() => drawRect({
				pos: vec2(SCALE * -edgeOffset),
				width: (MAP[0].length + 2*edgeOffset) * SCALE,
				height: (MAP.length + 2*edgeOffset) * SCALE,
				color: BLACK,
			}),
			() => drawPolygon({
				pts: pts,
			})
		)
	}

	// --- PATHFINDER PREP ---

	// - Graph creation -

	const HITBOX_GRAPH_LIST = [];

	function getTileAt(row, column) {
		return MAP[row][column];
	}

	function isHitboxAt(row, column) {
		let behavior = getBehavior(getTileAt(row, column));
		return ['WALL', 'HITBOX', 'NONE'].includes(behavior);
	}

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
		console.log(`${start}, ${end}`)
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

	// --- PLAYERS SPAWN ---

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
		area({ collisionIgnore: ['player'] }),
		body(),
		color(GREEN),
		{
			acceleration: 0,
			rotationAcceleration: 0,
		},
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
			area({ collisionIgnore: ['player'] }),
			body(),
			color(RED),
			{
				acceleration: 0,
				rotationTween: false,
				fakeAngle: 0,
				pathfind: {
					mainGoal: vec2(0),
					secondaryGoal: vec2(0),
					mode: 'main',
					path: [],
				},
			},
			'player',
			'npc'
		])

		choosePathfindGoal(npc);
	}

	// --- DEBUG TOGGLE ---

	onKeyPress('space', () => {
		debug.inspect = !debug.inspect;
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
				/* debug only */ let oldEA = endAngle;
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
				debug.log(`${Math.round(endAngle)} (${Math.round(oldEA)})`)

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

		camScale(0.5)
		camPos(player.pos);
	})

	// --- ON DRAW ---


	onDraw(() => {
		drawWallMask();

		// Pathfinding test
		get('npc').forEach((npc) => {
			let path = npc.pathfind.path;

			for (let i = 0; i < path.length; i++) {
				drawRect({
					pos: path[i].add(0.5).scale(SCALE),
					color: RED,
					width: SCALE/10,
					height: SCALE/10,
					anchor: 'center',
				})
			}
		})
	})

});

go('game');
