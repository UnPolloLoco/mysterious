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

	let graphList = [];

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
				if (isHitboxAt(row+1, column)) weight += 0.5;
				if (isHitboxAt(row-1, column)) weight += 0.5;
				if (isHitboxAt(row, column+1)) weight += 0.5;
				if (isHitboxAt(row, column-1)) weight += 0.5;
			}

			graphListRow.push(weight);
		}
		graphList.push(graphListRow);
	}

	let weightGraph = new Graph(graphList, { diagonal: true });

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

	// --- PLAYER SPAWN ---

	const player = add([
		sprite('block'),
		pos(chooseItem(possibleSpawnPoints)),
		scale(SCALE/500),
		anchor('center'),
		rotate(0),
		area(),
		body(),
		{
			acceleration: 0,
			rotationAcceleration: 0,
		},
		'player'
	])

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

		// --- CAMERA EFFECTS ---

		camPos(player.pos);
	})

	// --- ON DRAW ---

	let path = pathfind(vec2(2,3), vec2(5,21));

	onDraw(() => {
		drawWallMask();

		// Pathfinding test
		for (let i = 0; i < path.length; i++) {
			drawRect({
				pos: path[i].add(0.5).scale(SCALE),
				color: RED,
				width: 5,
				height: 5,
			})
		}
	})

});

go('game');
