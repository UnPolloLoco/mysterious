scene('game', () => {

	// --- MAP CREATION ---

	var possibleSpawnPoints = [];

	for (let row = 0; row < MAP.length; row++) {
		for (let column = 0; column < MAP[row].length; column++) {

			let currentTile = MAP[row][column];
			let currentTileInfo = MAP_ICON_INFO[currentTile];
			let tileBehavior;

			if (currentTileInfo == undefined) {
				tileBehavior = 'NONE';
			} else {
				tileBehavior = currentTileInfo.behavior;
			}

			// Ignore tile if nothing should be done with it
			if (tileBehavior != 'NONE') {

				let tilePosition = vec2(
					column * SCALE, 
					row * SCALE);

				let tile = add([
					sprite('block'),
					scale(SCALE/500),
					pos(tilePosition),
					opacity(0.5),
					{
						tile: currentTile,
						behavior: tileBehavior,
					},
					'tile',
				])

				// Wall tile
				if (tileBehavior == 'WALL') {
					tile.use('wall');
					tile.use(color(YELLOW))
				} 

				// Hitbox tile
				if (tileBehavior == 'HITBOX') {
					tile.use(area());
					tile.use(body({ isStatic: true }));
				}

				// Floor OR spawn point tile
				if (['FLOOR', 'SPAWN'].includes(tileBehavior)) {
					tile.use(color(BLUE));
					// Spawn tile only
					if (tileBehavior == 'SPAWN') possibleSpawnPoints.push(tilePosition);
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
				opacity(0.5),
				area(),
				body({ isStatic: true }),
				tile({ isObstacle: true }),
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
			} 
		}
		pts.push(pts[1]);

		// Subtraction creation

		let edgeOffset = 7;

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

	onUpdate(() => {

		// --- PLAYER MOVEMENT INPUTS ---

		// - Movement -
		if (isKeyDown('w')) {
			player.acceleration += dt() * WALKING_ACCELERATION;
		} else {
			player.acceleration -= dt() * WALKING_ACCELERATION;
		}

		player.acceleration = Math.max(0, Math.min(player.acceleration, 1));

		// - Rotation -
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

		// --- PLAYER MOVEMENT ---

		player.angle -= player.rotationAcceleration * dt() * TURNING_SPEED;

		let displacement = Vec2.fromAngle(player.angle - 90).scale(
			WALKING_SPEED * SCALE * dt() * player.acceleration);

		player.pos = player.pos.add(displacement);

		// --- CAMERA EFFECTS ---

		camPos(player.pos);
	})

	// --- ON DRAW ---

	onDraw(() => {
		drawWallMask();
	})

});

go('game');
