define([
	'fetch/entryUtils',
	'math/vector',
	'math/LineSegment',
], (
	entryUtils,
	vector,
	LineSegment
) => {
	'use strict';

	function deepCopy(o) {
		// TODO
		return Object.assign({}, o);
	}

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

	function lineIntersection(l1, l2) {
		const result = new LineSegment(
			new vector.V2(l1[0].x, l1[0].y),
			new vector.V2(l1[1].x, l1[1].y)
		).findLineIntersection(new LineSegment(
			new vector.V2(l2[0].x, l2[0].y),
			new vector.V2(l2[1].x, l2[1].y)
		));
		if(!result.intersection) {
			return [];
		}
		return [
			[result.intersection.x, result.intersection.y],
			[result.fraction1, result.fraction2],
		];
	}

	return class GameManager {
		constructor(random, config) {
			this.random = random;

			this.config = config;

			this.teams = config.teams;
			this.entryLookup = new Map();
			this.missiles = [];
			this.resetTimer = 0;
			this.frame = 0;
			this.simulationTime = 0;

			this.teams.forEach((team, teamIndex) => team.entries.forEach((entry) => {
				const entryObj = {
					id: entry.id,
					pauseOnError: false,
					disqualified: false,
					error: null,
					errorInput: null,
					errorOutput: null,
					console: [],
					side: teamIndex % 2,
					fn: null,
					vars: null,
					position: new vector.V2(),
					velocity: new vector.V2(),
					rotation: 0,
					alive: true,
					leftWing: true,
					rightWing: true,
					engine: false,
					firing: false,
					hyperspace: 0,
					destructTimer: 0,
					tangible: true,
					missiles: 0,
					cooldown: 0,
					kills: 0,
					deaths: 0,
					score: 0,
					codeSteps: 0,
					elapsedTime: 0,
					currentAction: null,
				};
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
				entry.velocity.x = 0;
				entry.velocity.y = 0;
				entry.rotation = (entry.side === 0) ? (Math.PI * 0.5) : (-Math.PI * 0.5);
				entry.alive = true;
				entry.leftWing = true;
				entry.rightWing = true;
				entry.engine = false;
				entry.firing = false;
				entry.hyperspace = 0;
				entry.destructTimer = 0;
				entry.tangible = true;
				entry.missiles = this.config.initialMissiles;
				entry.cooldown = 0;
			});
			this.missiles.length = 0;
		}

		updateEntry({id, code = null, pauseOnError = null, disqualified = null}) {
			const entry = this.entryLookup.get(id);
			if(!entry) {
				throw new Error('Attempt to modify an entry which was not registered in the game');
			}
			if(code !== null) {
				const compiledCode = entryUtils.compile(
					code,
					['shipShapes', 'LineIntersection', 'getShipCoords'],
					{returning: {
						setup: '*_setup',
						actions: '*_getActions',
					}}
				);
				if(compiledCode.compileError) {
					entry.disqualified = true;
					entry.error = compiledCode.compileError;
				} else {
					const oldRandom = Math.random;
					Math.random = this.random.floatGenerator();
					try {
						const functions = compiledCode.fn({
							shipShapes: {
								'full ship': this.config.shapes.all,
								'left wing': this.config.shapes.noseLeftWing,
								'right wing': this.config.shapes.noseRightWing,
								'nose only': this.config.shapes.nose,
							},
							LineIntersection: lineIntersection,
							getShipCoords: this.entryGetShipCoords.bind(this, id),
						}, {consoleTarget: entry.console});
						const team = teamForSide(entry.side);
						entry.vars = functions.setup.call({}, team);
						entry.fn = functions.actions;
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
				engineThrust: this.config.acceleration,
				speedLimit: this.config.maxEngineSpeed,
				maxSpeed: this.config.maxSpeed,

				red_x: redEntry.position.x,
				red_y: redEntry.position.y,
				red_rot: redEntry.rotation * 180 / Math.PI,
				red_xv: redEntry.velocity.x,
				red_yv: redEntry.velocity.y,
				red_shape: redEntry.leftWing ?
					(redEntry.rightWing ? 'full ship' : 'left wing') :
					(redEntry.rightWing ? 'right wing' : 'nose only'),
				red_missileStock: redEntry.missiles,
				red_inHyperspace: Boolean(redEntry.hyperspace),
				red_exploded: !redEntry.alive && !redEntry.tangible,
				red_alive: redEntry.alive,

				blue_x: blueEntry.position.x,
				blue_y: blueEntry.position.y,
				blue_rot: blueEntry.rotation * 180 / Math.PI,
				blue_xv: blueEntry.velocity.x,
				blue_yv: blueEntry.velocity.y,
				blue_shape: blueEntry.leftWing ?
					(blueEntry.rightWing ? 'full ship' : 'left wing') :
					(blueEntry.rightWing ? 'right wing' : 'nose only'),
				blue_missileStock: blueEntry.missiles,
				blue_inHyperspace: Boolean(blueEntry.hyperspace),
				blue_exploded: !blueEntry.alive && !blueEntry.tangible,
				blue_alive: blueEntry.alive,

				numMissiles: missiles.length,
				missiles,
			};
		}

		stepEntry(entry) {
			entry.currentAction = null;
			if(entry.disqualified || !entry.alive || entry.hyperspace) {
				return;
			}

			entry.newVars = deepCopy(entry.vars);

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
				action = entry.fn.call({}, gameInfo, entry.newVars);
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
			entry.tangible = true;
			entry.position.x = this.random.next(this.config.width);
			entry.position.y = this.random.next(this.config.height);
			entry.velocity.x = 0;
			entry.velocity.y = 0;
			let fatality = 0;
			if(entry.leftWing && entry.rightWing) {
				fatality = this.config.hyperspaceFatalityRatioAll;
			} else if(entry.leftWing || entry.rightWing) {
				fatality = this.config.hyperspaceFatalityRatioWing;
			} else {
				fatality = this.config.hyperspaceFatalityRatioNose;
			}
			if(this.random.nextFloat() < fatality) {
				this.markDead(entry);
			}
		}

		controlEntry(entry) {
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
			if(entry.disqualified || !entry.alive || entry.hyperspace > 0) {
				return;
			}
			const action = entry.currentAction || [];
			const turnLeft = (
				(action.indexOf('turn left') !== -1) &&
				(entry.leftWing || entry.rightWing)
			);
			const turnRight = (
				(action.indexOf('turn right') !== -1) &&
				(entry.leftWing || entry.rightWing)
			);
			const engine = (
				(action.indexOf('fire engine') !== -1) &&
				(entry.leftWing || entry.rightWing)
			);
			const fire = (
				(action.indexOf('fire missile') !== -1) &&
				entry.cooldown <= 0 &&
				entry.missiles > 0
			);
			const hyperspace = action.indexOf('hyperspace') !== -1;

			if(hyperspace) {
				entry.hyperspace = this.config.hyperspaceFrames;
				entry.tangible = false;
			} else {
				if(turnLeft && !turnRight) {
					// TODO: dynamic turn speed (turnSpeedWing/turnSpeedNose)
					entry.rotation -= this.config.turnSpeedAll * 0.5;
				} else if(turnRight && !turnLeft) {
					entry.rotation += this.config.turnSpeedAll * 0.5;
				}
				if(engine) {
					entry.engine = true;
					const speedLimit = Math.max(
						entry.velocity.length(),
						this.config.maxEngineSpeed
					);
					// TODO: dynamic acceleration (accelerationWing/accelerationNose)
					entry.velocity = cap(entry.velocity.addMult(
						rotationVector(entry.rotation),
						this.config.accelerationAll *
						(entry.leftWing + entry.rightWing) * 0.5
					), speedLimit);
				}
				if(turnLeft && !turnRight) {
					entry.rotation -= this.config.turnSpeedAll * 0.5;
				} else if(turnRight && !turnLeft) {
					entry.rotation += this.config.turnSpeedAll * 0.5;
				}
				if(fire) {
					entry.firing = true;
					-- entry.missiles;
					entry.cooldown = this.config.missileCooldownFrames;
				}
			}
		}

		moveEntry(entry) {
			if(!entry.alive || entry.hyperspace > 0) {
				return;
			}
			const sunPos = new vector.V2(this.config.sun.x, this.config.sun.y);
			const sunDist = sunPos.sub(entry.position);
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
			const sunPos = new vector.V2(this.config.sun.x, this.config.sun.y);
			const sunDist = sunPos.sub(missile.position);
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

		checkLineHitSun(line) {
			const hit = line.findCircleIntersection(
				new vector.V2(this.config.sun.x, this.config.sun.y),
				this.config.sun.radius
			);
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

		getShapes(entry) {
			return {
				nose: positionShape(this.config.shapes.nose, entry),
				leftWing: entry.leftWing ?
					positionShape(this.config.shapes.leftWing, entry) : null,
				rightWing: entry.rightWing ?
					positionShape(this.config.shapes.rightWing, entry) : null,
			};
		}

		checkCollisions() {
			const shapeMap = new Map();
			this.entryLookup.forEach((entry) => {
				if(!entry.tangible) {
					return;
				}
				shapeMap.set(entry.id, this.getShapes(entry));
			});

			this.missiles.forEach((missile) => {
				if(missile.dead) {
					return;
				}
				let firstHit = 2;
				let firstHitEntry = null;
				let firstHitPos = 0;
				const missileLine = new LineSegment(
					missile.lastPosition,
					missile.position
				);
				const sunHit = this.checkLineHitSun(missileLine);
				if(sunHit < firstHit) {
					firstHit = sunHit;
					firstHitEntry = null;
				}
				this.entryLookup.forEach((entry) => {
					const shapes = shapeMap.get(entry.id);
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
			});
			this.entryLookup.forEach((entry1) => {
				const shapes1 = shapeMap.get(entry1.id);
				if(!shapes1) {
					return;
				}
				if(
					this.checkHitSun(shapes1.nose) ||
					this.checkHitSun(shapes1.leftWing) ||
					this.checkHitSun(shapes1.rightWing)
				) {
					this.markDead(entry1);
					return;
				}
				this.entryLookup.forEach((entry2) => {
					const shapes2 = shapeMap.get(entry2.id);
					if(entry2 === entry1 || !shapes2) {
						return;
					}
					if(
						entry1.position.sub(entry2.position).length() >
						this.config.shipMaxRadius * 2
					) {
						// optimisation
						return;
					}
					if(this.checkShapeHitShape(shapes1.nose, shapes2.nose)) {
						if(this.markDead(entry1)) {
							++ entry2.kills;
						}
						if(this.markDead(entry2)) {
							++ entry1.kills;
						}
						return;
					}
					if(this.checkShapeHitShape(shapes1.nose, shapes2.leftWing)) {
						if(entry2.alive) {
							entry2.leftWing = false;
						} else {
							this.markDead(entry1);
						}
					}
					if(this.checkShapeHitShape(shapes1.nose, shapes2.rightWing)) {
						if(entry2.alive) {
							entry2.rightWing = false;
						} else {
							this.markDead(entry1);
						}
					}
					if(this.checkShapeHitShape(shapes2.nose, shapes1.leftWing)) {
						if(entry1.alive) {
							entry1.leftWing = false;
						} else {
							this.markDead(entry2);
						}
					}
					if(this.checkShapeHitShape(shapes2.nose, shapes1.rightWing)) {
						if(entry1.alive) {
							entry1.rightWing = false;
						} else {
							this.markDead(entry2);
						}
					}
					if(this.checkShapeHitShape(shapes1.leftWing, shapes2.leftWing)) {
						if(entry1.alive) {
							entry1.leftWing = false;
						}
						if(entry2.alive) {
							entry2.leftWing = false;
						}
					}
					if(this.checkShapeHitShape(shapes1.leftWing, shapes2.rightWing)) {
						if(entry1.alive) {
							entry1.leftWing = false;
						}
						if(entry2.alive) {
							entry2.rightWing = false;
						}
					}
					if(this.checkShapeHitShape(shapes1.rightWing, shapes2.leftWing)) {
						if(entry1.alive) {
							entry1.rightWing = false;
						}
						if(entry2.alive) {
							entry2.leftWing = false;
						}
					}
					if(this.checkShapeHitShape(shapes1.rightWing, shapes2.rightWing)) {
						if(entry1.alive) {
							entry1.rightWing = false;
						}
						if(entry2.alive) {
							entry2.rightWing = false;
						}
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
