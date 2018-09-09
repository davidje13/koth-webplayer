define([
	'core/objectUtils',
	'fetch/sourceUtils',
	'fetch/entryUtils',
	'math/vector',
	'math/LineSegment',
], (
	objectUtils,
	sourceUtils,
	entryUtils,
	vector,
	LineSegment
) => {
	'use strict';

	// Based on the original challenge reference implementation:
	// http://play.starmaninnovations.com/static/Spacewar/game_engine.js

	function checkError(action) {
		if(!Array.isArray(action)) {
			return 'Invalid actions: ' + action;
		}
		if(action.some((act) => (typeof act !== 'string'))) {
			return 'Invalid action: ' + JSON.stringify(action);
		}
		return '';
	}

	function teamForSide(side) {
		return (side === 0) ? 'red' : 'blue';
	}

	function mod(a, b) {
		return ((a % b) + b) % b;
	}

	function rotationVector(rotation) {
		return new vector.V2(
			Math.sin(rotation),
			-Math.cos(rotation)
		);
	}

	function cap(v, length) {
		if(v.dot(v) > length * length) {
			return v.norm(length);
		}
		return v;
	}

	function positionShape(shape, pos) {
		const s = Math.sin(pos.rotation);
		const c = Math.cos(pos.rotation);
		const xx = pos.position.x;
		const yy = pos.position.y;
		return shape.map((p) => new vector.V2(
			xx + p[0] * c - p[1] * s,
			yy + p[0] * s + p[1] * c
		));
	}

	// This function is sent to the worker stringified later, so cannot
	// use any external functions, such as vectors.
	const lineIntersection = ([a1, a2], [b1, b2]) => {
		const s1 = [a2[0]-a1[0], a2[1]-a1[1]];
		const s2 = [b2[0]-b1[0], b2[1]-b1[1]];
		const d = [b1[0]-a1[0], b1[1]-a1[1]];
		const norm = 1/(s1[0]*s2[1] - s1[1]*s2[0]);
		const f1 = (d[0]*s2[1] - d[1]*s2[0])*norm;
		const f2 = (d[0]*s1[1] - d[1]*s1[0])*norm;
		const intersection = (f1 >= 0 && f1 <= 1 && f2 >= 0 && f2 <= 1);
		if(!intersection) {
			return [];
		}
		return [
			[a1[0]+b1[0]*f1, a1[1]+b1[1]*f1],
			[f1, f2],
		];
	};

	function shipHealth(entry) {
		return (entry.leftWing ?
			(entry.rightWing ? 'full ship' : 'left wing') :
			(entry.rightWing ? 'right wing' : 'nose only')
		);
	}

	class Entry {
		constructor(id, side) {
			this.id = id;
			this.pauseOnError = false;
			this.disqualified = false;
			this.error = null;
			this.errorInput = null;
			this.errorOutput = null;
			this.console = [];
			this.side = side;
			this.fn = null;
			this.vars = null;
			this.position = new vector.V2();
			this.velocity = new vector.V2();
			this.rotation = 0;
			this.alive = true;
			this.leftWing = true;
			this.rightWing = true;
			this.engine = false;
			this.firing = false;
			this.hyperspace = 0;
			this.destructTimer = 0;
			this.tangible = true;
			this.missiles = 0;
			this.cooldown = 0;
			this.kills = 0;
			this.deaths = 0;
			this.score = 0;
			this.codeSteps = 0;
			this.elapsedTime = 0;
			this.currentAction = null;
			this.shapes = null;
		}

		reset(config) {
			this.velocity.x = 0;
			this.velocity.y = 0;
			this.alive = true;
			this.leftWing = true;
			this.rightWing = true;
			this.engine = false;
			this.firing = false;
			this.hyperspace = 0;
			this.destructTimer = 0;
			this.tangible = true;
			this.missiles = config.initialMissiles;
			this.cooldown = 0;
		}

		getStrength() {
			return (this.leftWing ? 1 : 0) + (this.rightWing ? 1 : 0);
		}
	}

	return class GameManager {
		constructor(random, config) {
			this.random = random;

			this.config = config;
			this.sunPos = null;
			this.turnSpeeds = [];
			this.engineSpeeds = [];
			this.hyperspaceFatalityRatios = [];
			this.updateConfig(config);

			this.teams = config.teams;
			this.entryLookup = new Map();
			this.missiles = [];
			this.resetTimer = 0;
			this.frame = 0;
			this.simulationTime = 0;

			this.teams.forEach((team, teamIndex) => team.entries.forEach((entry) => {
				const entryObj = new Entry(entry.id, teamIndex % 2);
				this.entryLookup.set(entry.id, entryObj);
				this.updateEntry(entry);
			}));
			this.beginCombat();
		}

		beginCombat() {
			this.entryLookup.forEach((entry) => {
				const dx = this.config.startInsetX;
				const dy = this.config.startInsetY;
				entry.position.x = (entry.side === 0) ? dx : this.config.width - dx;
				entry.position.y = this.random.next(this.config.height - dy * 2) + dy;
				entry.rotation = (entry.side === 0) ? (Math.PI * 0.5) : (-Math.PI * 0.5);
				entry.reset(this.config);
			});
			this.missiles.length = 0;
		}

		updateEntry({id, code = null, pauseOnError = null, disqualified = null}) {
			const entry = this.entryLookup.get(id);
			if(!entry) {
				throw new Error('Attempt to modify an entry which was not registered in the game');
			}
			if(code !== null) {
				let compiledCode = entryUtils.compile({
					initPre: `
						let LineIntersection = ${lineIntersection};
						let shipShapes = params.shipShapes;
					`,
					initCode: `
						${code}
						this._setup = ${sourceUtils.buildFunctionFinder(code, '*_setup')};
						this._getActions = ${sourceUtils.buildFunctionFinder(code, '*_getActions')};
					`,
					initParams: {
						shipShapes: {
							'full ship': this.config.shapes.all,
							'left wing': this.config.shapes.noseLeftWing,
							'right wing': this.config.shapes.noseRightWing,
							'nose only': this.config.shapes.nose,
						},
					},
					initSloppy: true,
				}, {
					setup: {
						code: 'return _setup(team)',
						paramNames: [
							'_setup',
							'team',
						],
					},
					getActions: {
						pre: `
							let _shipCoords = extras.shipCoords;
							let getShipCoords = function(color) {
								if (color === 'red') {
									return _shipCoords.red;
								} else if (color === 'blue') {
									return _shipCoords.blue;
								}
							};
						`,
						code: 'return _getActions(gameInfo, botVars)',
						paramNames: [
							'_getActions',
							'gameInfo',
							'botVars',
						],
					},
				});
				if(compiledCode.compileError) {
					entry.disqualified = true;
					entry.error = compiledCode.compileError;
				} else {
					const oldRandom = Math.random;
					Math.random = this.random.floatGenerator();
					try {
						const functions = compiledCode.fns;
						const team = teamForSide(entry.side);
						entry.vars = functions.setup.call({}, team);
						entry.fn = functions.getActions;
						// Automatically un-disqualify entries when code is updated
						entry.error = null;
						entry.disqualified = false;
					} catch(e) {
						entry.disqualified = true;
						entry.error = String(e);
					}
					Math.random = oldRandom;
				}
				entry.errorInput = null;
				entry.errorOutput = null;
			}
			if(pauseOnError !== null) {
				entry.pauseOnError = pauseOnError;
			}
			if(disqualified !== null) {
				entry.disqualified = disqualified;
			}
		}

		entryGetPlayer(entryID, lookupTeam) {
			const selfEntry = this.entryLookup.get(entryID);
			const selfTeam = teamForSide(selfEntry.side);
			let target = null;
			if(lookupTeam === selfTeam) {
				target = selfEntry;
			} else if(lookupTeam === 'red' || lookupTeam === 'blue') {
				this.entryLookup.forEach((entry) => {
					if(teamForSide(entry.side) === lookupTeam) {
						target = entry;
					}
				});
			} else {
				target = this.entryLookup.get(lookupTeam);
			}
			return target;
		}

		entryGetShipCoords(entryID, lookupTeam) {
			const target = this.entryGetPlayer(entryID, lookupTeam);
			if(!target) {
				return null;
			}
			let shape = null;
			if(target.leftWing && target.rightWing) {
				shape = this.config.shapes.all;
			} else if(target.leftWing) {
				shape = this.config.shapes.noseLeftWing;
			} else if(target.rightWing) {
				shape = this.config.shapes.noseRightWing;
			} else {
				shape = this.config.shapes.nose;
			}
			const s = Math.sin(target.rotation);
			const c = Math.cos(target.rotation);
			const xx = target.position.x;
			const yy = target.position.y;
			return shape.map((p) => ({
				x: xx + p[0] * c - p[1] * s,
				y: yy + p[0] * s + p[1] * c,
			}));
		}

		updateConfig(config) {
			this.config = config;
			this.sunPos = new vector.V2(this.config.sun.x, this.config.sun.y);
			this.turnSpeeds = [
				this.config.turnSpeeds.nose,
				this.config.turnSpeeds.wing,
				this.config.turnSpeeds.all,
			];
			this.engineSpeeds = [
				this.config.acceleration.nose,
				this.config.acceleration.wing,
				this.config.acceleration.all,
			];
			this.hyperspaceFatalityRatios = [
				this.config.hyperspaceFatalityRatio.nose,
				this.config.hyperspaceFatalityRatio.wing,
				this.config.hyperspaceFatalityRatio.all,
			];
		}

		handleError(entry, params, action, error) {
			entry.errorInput = JSON.stringify(params);
			entry.errorOutput = JSON.stringify(action);
			entry.error = (
				error + ' (gave ' + entry.errorOutput +
				' for ' + entry.errorInput + ')'
			);
			if(entry.pauseOnError) {
				this.random.rollback();
				throw 'PAUSE';
			}
		}

		getGameInfo(redEntry, blueEntry, missiles) {
			/* jshint -W106 */ // snake_case variables are part of spec
			return {
				redScore: redEntry.score,
				blueScore: blueEntry.score,
				timeLeft: Math.floor((this.config.maxFrame - this.frame) / (100 / 3)),
				fieldWidth: this.config.width,
				fieldHeight: this.config.height,
				sun_x: this.config.sun.x,
				sun_y: this.config.sun.y,
				sun_r: this.config.sun.radius,
				gravityStrength: this.config.sun.G,
				engineThrust: this.config.acceleration.all,
				speedLimit: this.config.maxEngineSpeed,
				maxSpeed: this.config.maxSpeed,

				red_x: redEntry.position.x,
				red_y: redEntry.position.y,
				red_rot: redEntry.rotation * 180 / Math.PI,
				red_xv: redEntry.velocity.x,
				red_yv: redEntry.velocity.y,
				red_shape: shipHealth(redEntry),
				red_missileStock: redEntry.missiles,
				red_inHyperspace: Boolean(redEntry.hyperspace),
				red_exploded: !redEntry.alive && !redEntry.tangible,
				red_alive: redEntry.alive,

				blue_x: blueEntry.position.x,
				blue_y: blueEntry.position.y,
				blue_rot: blueEntry.rotation * 180 / Math.PI,
				blue_xv: blueEntry.velocity.x,
				blue_yv: blueEntry.velocity.y,
				blue_shape: shipHealth(blueEntry),
				blue_missileStock: blueEntry.missiles,
				blue_inHyperspace: Boolean(blueEntry.hyperspace),
				blue_exploded: !blueEntry.alive && !blueEntry.tangible,
				blue_alive: blueEntry.alive,

				numMissiles: missiles.length,
				missiles,
			};
		}

		callEntry(entry) {
			entry.currentAction = null;
			if(entry.disqualified || !entry.alive || entry.hyperspace) {
				return;
			}

			entry.newVars = objectUtils.deepCopy(entry.vars);

			const redEntry = this.entryGetPlayer(entry.id, 'red');
			const blueEntry = this.entryGetPlayer(entry.id, 'blue');
			const missiles = this.missiles.map((missile) => ({
				x: missile.position.x,
				y: missile.position.y,
				xv: missile.velocity.x,
				yv: missile.velocity.y,
			}));
			const gameInfo = this.getGameInfo(redEntry, blueEntry, missiles);

			let action = null;
			let error = null;
			let elapsed = 0;

			const oldRandom = Math.random;
			Math.random = this.random.floatGenerator();
			Math.degrees = (rad) => (rad * 180 / Math.PI);
			try {
				const begin = performance.now();
				action = entry.fn.call({}, {
					gameInfo,
					botVars: entry.newVars,
				}, {
					consoleTarget: this.console,
					shipCoords: {
						red: this.entryGetShipCoords(entry.id, 'red'),
						blue: this.entryGetShipCoords(entry.id, 'blue'),
					},
				});
				elapsed = performance.now() - begin;

				error = checkError(action);
			} catch(e) {
				error = entryUtils.stringifyEntryError(e);
			}
			Math.random = oldRandom;
			Math.degrees = undefined;

			entry.elapsedTime += elapsed;
			++ entry.codeSteps;

			if(error) {
				this.handleError(entry, {gameInfo, botVars: entry.vars}, action, error);
			} else {
				entry.currentAction = action;
			}
		}

		markDead(entry) {
			if(!entry.alive) {
				return false;
			}
			entry.alive = false;
			entry.deaths ++;
			entry.destructTimer = this.config.deathFrames;
			if(this.resetTimer <= 0) {
				this.resetTimer = this.config.resetFrames;
			}
			return true;
		}

		leaveHyperspace(entry) {
			entry.position.x = this.random.next(this.config.width);
			entry.position.y = this.random.next(this.config.height);
			entry.tangible = true;
			entry.velocity.x = 0;
			entry.velocity.y = 0;
			if(
				this.random.nextFloat() <
				this.hyperspaceFatalityRatios[entry.getStrength()]
			) {
				this.markDead(entry);
			}
		}

		stepEntry(entry) {
			entry.vars = entry.newVars;
			entry.engine = false;
			entry.firing = false;
			if(entry.cooldown > 0) {
				-- entry.cooldown;
			}
			if(entry.destructTimer > 0) {
				-- entry.destructTimer;
				if(entry.destructTimer <= 0) {
					entry.tangible = false;
				}
			}
			if(entry.hyperspace > 0) {
				-- entry.hyperspace;
				if(entry.hyperspace <= 0) {
					this.leaveHyperspace(entry);
				}
			}
		}

		controlEntry(entry) {
			if(entry.disqualified || !entry.alive || entry.hyperspace > 0) {
				return;
			}
			const strength = entry.getStrength();
			const action = entry.currentAction || [];
			const turnLeft = action.indexOf('turn left') !== -1;
			const turnRight = action.indexOf('turn right') !== -1;
			const turn = (turnRight ? 1 : 0) - (turnLeft ? 1 : 0);
			const engine = action.indexOf('fire engine') !== -1;
			const fire = action.indexOf('fire missile') !== -1;
			const hyperspace = action.indexOf('hyperspace') !== -1;

			if(hyperspace) {
				entry.hyperspace = this.config.hyperspaceFrames;
				entry.tangible = false;
				return;
			}

			entry.rotation += turn * this.turnSpeeds[strength] * 0.5;
			if(engine) {
				entry.engine = true;
				const speedLimit = Math.max(
					entry.velocity.length(),
					this.config.maxEngineSpeed
				);
				entry.velocity = cap(entry.velocity.addMult(
					rotationVector(entry.rotation),
					this.engineSpeeds[strength]
				), speedLimit);
			}
			entry.rotation += turn * this.turnSpeeds[strength] * 0.5;
			if(fire && entry.cooldown <= 0 && entry.missiles > 0) {
				entry.firing = true;
				-- entry.missiles;
				entry.cooldown = this.config.missileCooldownFrames;
			}
		}

		moveEntry(entry) {
			if(!entry.alive || entry.hyperspace > 0) {
				return;
			}
			const sunDist = this.sunPos.sub(entry.position);
			const gravity = this.config.sun.G / sunDist.dot(sunDist);
			entry.velocity = cap(
				entry.velocity.add(sunDist.norm(gravity)),
				this.config.maxSpeed
			);
			entry.position = entry.position.add(entry.velocity);
			entry.position.x = mod(entry.position.x, this.config.width);
			entry.position.y = mod(entry.position.y, this.config.height);
			if(entry.firing) {
				const dir = rotationVector(entry.rotation);
				this.missiles.push({
					position: entry.position.addMult(dir, this.config.missileSpawnDistance),
					lastPosition: null,
					velocity: entry.velocity.addMult(dir, this.config.missileSpeed),
					entryID: entry.id,
					lifespan: this.config.missileLifetime,
					dead: false,
				});
			}
		}

		moveMissile(missile) {
			-- missile.lifespan;
			if(missile.lifespan <= 0) {
				missile.dead = true;
				return;
			}
			const sunDist = this.sunPos.sub(missile.position);
			const gravity = this.config.sun.G / sunDist.dot(sunDist);
			missile.velocity = cap(
				missile.velocity.add(sunDist.norm(gravity)),
				this.config.maxMissileSpeed
			);
			missile.lastPosition = missile.position;
			missile.position = missile.position.add(missile.velocity);
			const dx = mod(missile.position.x, this.config.width) - missile.position.x;
			const dy = mod(missile.position.y, this.config.height) - missile.position.y;
			missile.position.x += dx;
			missile.position.y += dy;
			missile.lastPosition.x += dx;
			missile.lastPosition.y += dy;
		}

		cullMissiles() {
			let del = 0;
			for(let i = 0; i < this.missiles.length; ++ i) {
				if(this.missiles[i].dead) {
					++ del;
				} else if(del > 0) {
					this.missiles[i - del] = this.missiles[i];
				}
			}
			this.missiles.length -= del;
		}

		getShapes(entry) {
			const shapes = this.config.shapes;
			return {
				nose: positionShape(shapes.nose, entry),
				leftWing: entry.leftWing ? positionShape(shapes.leftWing, entry) : null,
				rightWing: entry.rightWing ? positionShape(shapes.rightWing, entry) : null,
			};
		}

		checkLineHitSun(line) {
			const hit = line.findCircleIntersection(this.sunPos, this.config.sun.radius);
			if(hit.intersectionEntry) {
				return hit.fractionEntry;
			} else {
				return 1;
			}
		}

		checkHitSun(shape) {
			if(!shape) {
				return;
			}
			for(let i = 0; i < shape.length; ++ i) {
				const l = new LineSegment(shape[i], shape[(i + 1) % shape.length]);
				if(this.checkLineHitSun(l) < 1) {
					return true;
				}
			}
			return false;
		}

		checkLineHitShape(line, shape) {
			if(!shape) {
				return;
			}
			for(let i = 0; i < shape.length; ++ i) {
				const l = new LineSegment(shape[i], shape[(i + 1) % shape.length]);
				const hit = line.findLineIntersection(l);
				if(hit.intersection) {
					return hit.fraction1;
				}
			}
			return 1;
		}

		checkShapeHitShape(shape1, shape2) {
			if(!shape1 || !shape2) {
				return;
			}
			for(let i = 0; i < shape1.length; ++ i) {
				const l = new LineSegment(shape1[i], shape1[(i + 1) % shape1.length]);
				if(this.checkLineHitShape(l, shape2) < 1) {
					return true;
				}
			}
			return false;
		}

		checkMissileCollisions(missile) {
			if(missile.dead) {
				return;
			}
			const missileLine = new LineSegment(
				missile.lastPosition,
				missile.position
			);
			let firstHit = this.checkLineHitSun(missileLine);
			let firstHitEntry = null;
			let firstHitPos = 0;
			this.entryLookup.forEach((entry) => {
				const shapes = entry.shapes;
				if(!shapes) {
					return;
				}
				let hit = this.checkLineHitShape(missileLine, shapes.nose);
				if(hit < firstHit) {
					firstHit = hit;
					firstHitEntry = entry;
					firstHitPos = 0;
				}
				hit = this.checkLineHitShape(missileLine, shapes.leftWing);
				if(hit < firstHit) {
					firstHit = hit;
					firstHitEntry = entry;
					firstHitPos = 1;
				}
				hit = this.checkLineHitShape(missileLine, shapes.rightWing);
				if(hit < firstHit) {
					firstHit = hit;
					firstHitEntry = entry;
					firstHitPos = 2;
				}
			});
			if(firstHitEntry && firstHitEntry.alive) {
				if(firstHitPos === 0) {
					if(this.markDead(firstHitEntry)) {
						++ this.entryLookup.get(missile.entryID).kills;
					}
				} else if(firstHitPos === 1) {
					firstHitEntry.leftWing = false;
				} else {
					firstHitEntry.rightWing = false;
				}
			}
			if(firstHit < 1) {
				missile.dead = true;
			}
		}

		checkShipSunCollision(entry) {
			if(
				entry.position.distance(this.sunPos) >
				this.config.sun.radius + this.config.shipMaxRadius
			) {
				return; // Optimisation
			}
			if(
				this.checkHitSun(entry.shapes.nose) ||
				this.checkHitSun(entry.shapes.leftWing) ||
				this.checkHitSun(entry.shapes.rightWing)
			) {
				this.markDead(entry);
			}
		}

		checkShipFrozenCollision(entry, frozen) {
			const shapes = entry.shapes;
			const shapesF = frozen.shapes;
			if(
				this.checkShapeHitShape(shapes.nose, shapesF.nose) ||
				this.checkShapeHitShape(shapes.nose, shapesF.leftWing) ||
				this.checkShapeHitShape(shapes.nose, shapesF.rightWing)
			) {
				this.markDead(entry);
				return;
			}
			if(
				this.checkShapeHitShape(shapes.leftWing, shapesF.nose) ||
				this.checkShapeHitShape(shapes.leftWing, shapesF.leftWing) ||
				this.checkShapeHitShape(shapes.leftWing, shapesF.rightWing)
			) {
				entry.leftWing = false;
			}
			if(
				this.checkShapeHitShape(shapes.rightWing, shapesF.nose) ||
				this.checkShapeHitShape(shapes.rightWing, shapesF.leftWing) ||
				this.checkShapeHitShape(shapes.rightWing, shapesF.rightWing)
			) {
				entry.rightWing = false;
			}
		}

		checkShipShipDamage(victim, aggressor) {
			const shapesV = victim.shapes;
			const shapesA = aggressor.shapes;

			if(
				this.checkShapeHitShape(shapesV.leftWing, shapesA.nose) ||
				this.checkShapeHitShape(shapesV.leftWing, shapesA.leftWing) ||
				this.checkShapeHitShape(shapesV.leftWing, shapesA.rightWing)
			) {
				victim.leftWing = false;
			}

			if(
				this.checkShapeHitShape(shapesV.rightWing, shapesA.nose) ||
				this.checkShapeHitShape(shapesV.rightWing, shapesA.leftWing) ||
				this.checkShapeHitShape(shapesV.rightWing, shapesA.rightWing)
			) {
				victim.rightWing = false;
			}
		}

		checkShipShipCollision(entry1, entry2) {
			if(!entry1.alive && !entry2.alive) {
				return;
			}
			if(
				entry1.position.distance(entry2.position) >
				this.config.shipMaxRadius * 2
			) {
				return; // Optimisation
			}

			if(!entry1.alive) {
				this.checkShipFrozenCollision(entry2, entry1);
			} else if(!entry2.alive) {
				this.checkShipFrozenCollision(entry1, entry2);
			} else if(this.checkShapeHitShape(entry1.shapes.nose, entry2.shapes.nose)) {
				if(this.markDead(entry1)) {
					++ entry2.kills;
				}
				if(this.markDead(entry2)) {
					++ entry1.kills;
				}
			} else {
				this.checkShipShipDamage(entry1, entry2);
				this.checkShipShipDamage(entry2, entry1);
			}
		}

		checkCollisions() {
			this.entryLookup.forEach((entry) => {
				entry.shapes = entry.tangible ? this.getShapes(entry) : null;
			});

			this.missiles.forEach(this.checkMissileCollisions.bind(this));
			this.entryLookup.forEach((entry1) => {
				if(!entry1.shapes) {
					return;
				}
				this.checkShipSunCollision(entry1);
				this.entryLookup.forEach((entry2) => {
					if(entry1 !== entry2 && entry2.shapes) {
						this.checkShipShipCollision(entry1, entry2);
					}
				});
			});
		}

		rewardSurvivors() {
			this.entryLookup.forEach((entry) => {
				if(entry.alive) {
					++ entry.score;
				}
			});
		}

		step() {
			if(this.frame >= this.config.maxFrame) {
				return;
			}

			const begin = performance.now();

			this.random.save();
			if(this.resetTimer > 0) {
				-- this.resetTimer;
				if(this.resetTimer <= 0) {
					this.rewardSurvivors();
					this.beginCombat();
				}
			}
			this.entryLookup.forEach(this.callEntry.bind(this));
			this.entryLookup.forEach(this.stepEntry.bind(this));
			this.entryLookup.forEach(this.controlEntry.bind(this));
			this.entryLookup.forEach(this.moveEntry.bind(this));
			this.missiles.forEach(this.moveMissile.bind(this));
			this.checkCollisions();
			this.cullMissiles();

			++ this.frame;
			this.simulationTime += performance.now() - begin;
		}

		isOver() {
			return this.frame >= this.config.maxFrame;
		}

		getState() {
			return {
				// Framework data
				over: this.isOver(),
				progress: this.frame / this.config.maxFrame,

				// Game specific data
				frame: this.frame,
				simulationTime: this.simulationTime,
				teams: this.teams.map((team) => ({
					id: team.id,
					entries: team.entries.map((entry) => {
						const entryState = this.entryLookup.get(entry.id);
						return {
							id: entryState.id,
							disqualified: entryState.disqualified,

							error: entryState.error,
							errorInput: entryState.errorInput,
							errorOutput: entryState.errorOutput,
							console: entryState.console,
							codeSteps: entryState.codeSteps,
							elapsedTime: entryState.elapsedTime,

							x: entryState.position.x,
							y: entryState.position.y,
							xv: entryState.velocity.x,
							yv: entryState.velocity.y,
							rotation: entryState.rotation,
							alive: entryState.alive,
							leftWing: entryState.leftWing,
							rightWing: entryState.rightWing,
							engine: entryState.engine,
							firing: entryState.firing,
							hyperspace: entryState.hyperspace / this.config.hyperspaceFrames,
							tangible: entryState.tangible,
							missiles: entryState.missiles,
							kills: entryState.kills,
							deaths: entryState.deaths,
							score: entryState.score,
							activeMissiles: this.missiles
								.filter((missile) => missile.entryID === entry.id)
								.map((missile) => ({
									x: missile.position.x,
									y: missile.position.y,
									ox: missile.lastPosition.x,
									oy: missile.lastPosition.y,
									vx: missile.velocity.x,
									vy: missile.velocity.y,
								})),
						};
					}),
				})),
			};
		}
	};
});
