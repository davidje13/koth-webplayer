define([
	'core/document_utils',
	'core/webgl_utils',
	'3d/ModelPoint',
	'3d/ModelTorus',
	'core/EventObject',
	'math/Mat4',
	'./style.css',
], (
	docutil,
	webgl_utils,
	ModelPoint,
	ModelTorus,
	EventObject,
	Mat4,
) => {
	'use strict';

	// TODO:
	// * move more low-level logic into webgl_utils
	// * is mip-mapping enabled on the texture? occasionally tries to read
	//   beyond provided data, causing a black mark at the wrap point
	//   (and can't use non-PoT texture)

	function blend(a, b, r) {
		return a * (1 - r) + b * r;
	}

	return class Full3DBoard extends EventObject {
		constructor({renderer, markerStore = null, markerTypes = null, width = 0, height = 0}) {
			super();

			this.renderer = renderer;
			this.markerStore = markerStore;
			this.markerTypes = markerTypes;
			this.wireframe = false;
			this.viewAngle = 0;
			this.viewLift = Math.PI * 0.25;
			this.viewDist = 0;
			this.frac3D = 1;

			window.devicePixelRatio = 1;
			this.canvas = docutil.make('canvas');
			this.board = docutil.make('div', {'class': 'game-board-3d'}, [this.canvas]);

			const gl = this.canvas.getContext('webgl');
			this.context = gl;

			gl.clearColor(0, 0, 0, 0);
			gl.clearDepth(1.0);
			gl.enable(gl.DEPTH_TEST);
			gl.depthFunc(gl.LEQUAL);
			gl.cullFace(gl.BACK);

			this.texBoard = webgl_utils.makeTexture(gl, gl.TEXTURE_2D, {
				[gl.TEXTURE_MAG_FILTER]: gl.NEAREST,
				[gl.TEXTURE_MIN_FILTER]: gl.LINEAR,
				[gl.TEXTURE_WRAP_S]: gl.REPEAT,
				[gl.TEXTURE_WRAP_T]: gl.REPEAT,
			});

			this.meshTorus = new ModelTorus();

			this.canvasProg = new webgl_utils.Program(gl, [
				webgl_utils.makeShader(gl, gl.VERTEX_SHADER, (
					'uniform mat4 matProj;\n' +
					'uniform mat4 matMV;\n' +
					'uniform mat3 matNorm;\n' +
					'attribute vec3 vert;\n' +
					'attribute vec3 norm;\n' +
					'attribute vec2 uv;\n' +
					'varying mediump vec2 texp;\n' +
					'varying mediump float light;\n' +
					'void main(void) {\n' +
					'  gl_Position = matProj * matMV * vec4(vert.xyz, 1);\n' +
					'  light = dot(normalize(matNorm * norm), vec3(0, 0, 1));\n' +
					'  texp = uv;\n' +
					'}\n'
				)),
				webgl_utils.makeShader(gl, gl.FRAGMENT_SHADER, (
					'uniform sampler2D tex;\n' +
					'uniform mediump vec2 texScale;\n' +
					'uniform mediump float shadowStr;\n' +
					'uniform mediump vec3 shadowCol;\n' +
					'uniform mediump vec3 backCol;\n' +
					'varying mediump vec2 texp;\n' +
					'varying mediump float light;\n' +
					'void main(void) {\n' +
					'  if(gl_FrontFacing) {\n' +
					'    gl_FragColor = vec4(mix(\n' +
					'      shadowCol,\n' +
					'      texture2D(tex, texp * texScale).rgb,\n' +
					'      mix(1.0, max(light, 0.0), shadowStr)\n' +
					'    ), 1);\n' +
					'  } else {\n' +
					'    gl_FragColor = vec4(mix(\n' +
					'      shadowCol,\n' +
					'      backCol,\n' +
					'      mix(1.0, max(-light, 0.0), shadowStr)\n' +
					'    ), 1);\n' +
					'  }\n' +
					'}\n'
				))
			]);

			this.defaultPointerModel = new ModelPoint({
				uv: false,
				stride: 6,
				radius: 0.02,
				height: 0.05,
			});
			this.defaultPointerProg = new webgl_utils.Program(gl, [
				webgl_utils.makeShader(gl, gl.VERTEX_SHADER, (
					'uniform mat4 matProj;\n' +
					'uniform mat4 matMV;\n' +
					'uniform mat3 matNorm;\n' +
					'attribute vec3 vert;\n' +
					'attribute vec3 norm;\n' +
					'varying mediump float light;\n' +
					'void main(void) {\n' +
					'  gl_Position = matProj * matMV * vec4(vert.xyz, 1);\n' +
					'  light = dot(normalize(matNorm * norm), vec3(0, 0, 1));\n' +
					'}\n'
				)),
				webgl_utils.makeShader(gl, gl.FRAGMENT_SHADER, (
					'uniform mediump vec3 col;\n' +
					'uniform mediump float shadowStr;\n' +
					'uniform mediump vec3 shadowCol;\n' +
					'varying mediump float light;\n' +
					'void main(void) {\n' +
					'  gl_FragColor = vec4(mix(\n' +
					'    shadowCol, col, mix(1.0, max(light, 0.0), shadowStr)\n' +
					'  ), 1);\n' +
					'}\n'
				))
			]);
			this.defaultPointerParams = {
				shadowStr: 0.8,
				shadowCol: [0.0, 0.02, 0.03],
				col: [1, 1, 1],
			};

			this.nextRerender = 0;
			this.rerenderTm = null;

			docutil.addDragHandler(this.board, (dx, dy) => {
				this.viewAngle -= dx * Math.PI / this.canvas.height;
				this.viewLift += dy * Math.PI / this.canvas.height;
				if(this.viewAngle > Math.PI) {
					this.viewAngle -= Math.PI * 2;
				}
				if(this.viewAngle < -Math.PI) {
					this.viewAngle += Math.PI * 2;
				}
				this.viewLift = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.viewLift));

				const now = Date.now();
				if(now > this.nextRerender) {
					this.rerender();
				} else if(!this.rerenderInt) {
					this.rerenderTm = setTimeout(
						() => this.rerender(),
						this.nextRerender - now
					);
				}
			});

			this.texWidth = 0;
			this.texHeight = 0;
			this.boardW = 0;
			this.boardH = 0;
			this.torusDirty = true;

			this._buildTorus();
			this.resize(width, height);
			this.setZoom(0);
		}

		resize(width, height) {
			if(this.canvas.width !== width * 2 || this.canvas.height !== height * 2) {
				this.canvas.width = width * 2;
				this.canvas.height = height * 2;
				this.canvas.style.width = width + 'px';
				this.canvas.style.height = height + 'px';
				this.context.viewport(0, 0, this.canvas.width, this.canvas.height);
			}
		}

		_buildTorus() {
			const gl = this.context;

			const fullRad2A = 0.2;
			const fullRad2B = 0.7;

			const frac3D = this.frac3D;
			const easeIn = frac3D * frac3D;
			const easeOut = 1 - (1 - frac3D) * (1 - frac3D);
			const animating = (frac3D > 0 && frac3D < 1);

			const aspect = this.boardW ? (this.boardH / this.boardW) : 1;

			const rad1 = 1 / Math.max(frac3D, 0.00001);
			const loopX = 1 / blend((rad1 * Math.PI) * aspect, 1, frac3D);
			const loopY = blend(0.5, 1, easeIn);
			const rad2A = fullRad2A * easeOut;
			const rad2B = blend(1, fullRad2B, frac3D);
			const dim = animating ? 64 : 128;

			this.meshTorus.setResolution(dim, dim);
			this.meshTorus.setRadii(rad1, rad2A, rad2B);
			this.meshTorus.setFractions(loopX, loopY);

			this.meshTorus.setAnimatingVertices(animating);

			if(frac3D >= 1) {
				gl.enable(gl.CULL_FACE);
			} else {
				gl.disable(gl.CULL_FACE);
			}

			this.torusDirty = false;
		}

		set3DRatio(frac3D) {
			if(this.frac3D !== frac3D) {
				this.frac3D = frac3D;
				this.torusDirty = true;
			}
		}

		setZoom(zoom) {
			this.viewDist = blend(2.5, 1.5, zoom);
		}

		setMarkerStore(markerStore) {
			this.markerStore = markerStore;
		}

		setMarkerTypes(markerTypes) {
			this.markerTypes = markerTypes;
		}

		setWireframe(on) {
			this.wireframe = on;
		}

		_renderBoard(matProjection, matView) {
			const gl = this.context;

			this.meshTorus.gl = gl;
			this.meshTorus.bindAll();

			this.canvasProg.use({
				tex: {tex2D: this.texBoard},
				shadowStr: 0.8,
				shadowCol: [0.0, 0.02, 0.03],
				backCol: [0.2, 0.2, 0.2],
				texScale: [this.boardW / this.texWidth, this.boardH / this.texHeight],
				matProj: matProjection,
				matMV: matView,
				matNorm: matView.invert().transpose().as3(),
			});

			this.canvasProg.vertexAttribPointer({
				vert: {size: 3, type: gl.FLOAT, stride: this.meshTorus.stride * 4, offset: 0 * 4},
				norm: {size: 3, type: gl.FLOAT, stride: this.meshTorus.stride * 4, offset: 3 * 4},
				uv:   {size: 2, type: gl.FLOAT, stride: this.meshTorus.stride * 4, offset: 6 * 4},
			});

			this.meshTorus.render(this.wireframe);
		}

		_renderMarks(matProjection, matView) {
			if(!this.markerStore || this.markerStore.marks.size === 0) {
				return;
			}

			const gl = this.context;
			const marks = this.markerStore.marks;
			const board = this.meshTorus;

			const usedClasses = new Set();
			marks.forEach((mark) => {
				if(mark.w === null || mark.h === null) {
					usedClasses.add(mark.className);
				}
			});

			const ref = (this.markerTypes) ? this.markerTypes.pointerTypes : {get: () => null};

			usedClasses.forEach((className) => {
				const config = ref.get(className) || {};

				const model = (config.model || this.defaultPointerModel);
				const prog = (config.prog || this.defaultPointerProg);
				const params = (config.params || this.defaultPointerParams);

				model.gl = gl;
				model.bindAll();
				prog.use(Object.assign({matProj: matProjection}, params));
				prog.vertexAttribPointer({
					vert: {size: 3, type: gl.FLOAT, stride: model.stride * 4, offset: 0 * 4},
					norm: {size: 3, type: gl.FLOAT, stride: model.stride * 4, offset: 3 * 4},
				});

				marks.forEach((mark, key) => {
					if(mark.className === className && (mark.w === null || mark.h === null)) {
						const locn = board.find(
							(mark.x + 0.5) / this.boardW,
							(mark.y + 0.5) / this.boardH
						);
						const matModelView = Mat4.lookObj(
							locn.p,
							locn.p.add(locn.n),
							new Mat4.Vec3(0, 0, -1),
						).mult(matView);
						prog.uniform({
							matMV: matModelView,
							matNorm: matModelView.invert().transpose().as3(),
						});
						model.render(this.wireframe);
					}
				});
			});
		}

		rerender() {
			this.nextRerender = Date.now() + 10;
			clearTimeout(this.rerenderTm);
			this.rerenderTm = null;

			const gl = this.context;

			gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

			if(!this.boardW) {
				return;
			}

			if(this.torusDirty) {
				this._buildTorus();
			}

			const dist2D = 5;

			const frac3D = this.frac3D;
			const lift = this.viewLift * frac3D * frac3D;
			const dist = blend(dist2D, this.viewDist, frac3D);
			const aspect = this.canvas.width / this.canvas.height;
			const fov = Math.atan(blend(1, 1.5, frac3D) / dist);
			const matProjection = Mat4.perspective(fov, aspect, blend(1, 0.1, frac3D), 10.0);
			let ang = this.viewAngle;
			if(frac3D < 1) {
				ang = (ang % (Math.PI * 2)) * frac3D;
			}

			const focusDist = this.meshTorus.rad1 - frac3D;
			const torusFocus = new Mat4.Vec3(
				focusDist * Math.sin(ang * frac3D),
				focusDist * Math.cos(ang * frac3D),
				0
			);

			const matView = Mat4.look(
				torusFocus.add(new Mat4.Vec3(
					dist * Math.sin(ang) * Math.cos(lift),
					dist * Math.cos(ang) * Math.cos(lift),
					dist * Math.sin(lift)
				)),
				torusFocus,
				new Mat4.Vec3(
					Math.sin(ang) * 0.1 * lift,
					Math.cos(ang) * 0.1 * lift,
					-1
				),
			);

			this._renderBoard(matProjection, matView);
			this._renderMarks(matProjection, matView);
		}

		repaint() {
			const gl = this.context;
			const data = this.renderer.getImageData();
			if(data) {
				gl.bindTexture(gl.TEXTURE_2D, this.texBoard);
				const ww = data.width;
				const hh = data.height;
				const PoTx = webgl_utils.nextPoT(ww);
				const PoTy = webgl_utils.nextPoT(hh);
				if(ww === PoTx && hh === PoTy) {
					gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, data);
				} else {
					if(this.texWidth !== PoTx || this.texHeight !== PoTy) {
						gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, PoTx, PoTy, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(PoTx * PoTy * 4));
						this.repXDat = new Uint8Array(hh * 4);
						this.repYDat = new Uint8Array((ww + 1) * 4);
					}
					gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
					for(let y = 0; y < hh; ++ y) {
						this.repXDat[y * 4    ] = data.data[y * ww * 4    ];
						this.repXDat[y * 4 + 1] = data.data[y * ww * 4 + 1];
						this.repXDat[y * 4 + 2] = data.data[y * ww * 4 + 2];
						this.repXDat[y * 4 + 3] = data.data[y * ww * 4 + 3];
					}
					gl.texSubImage2D(gl.TEXTURE_2D, 0, ww, 0, 1, hh, gl.RGBA, gl.UNSIGNED_BYTE, this.repXDat);
					for(let y = 0; y < hh; ++ y) {
						this.repXDat[y * 4    ] = data.data[(y * ww + ww - 1) * 4    ];
						this.repXDat[y * 4 + 1] = data.data[(y * ww + ww - 1) * 4 + 1];
						this.repXDat[y * 4 + 2] = data.data[(y * ww + ww - 1) * 4 + 2];
						this.repXDat[y * 4 + 3] = data.data[(y * ww + ww - 1) * 4 + 3];
					}
					gl.texSubImage2D(gl.TEXTURE_2D, 0, PoTx - 1, 0, 1, hh, gl.RGBA, gl.UNSIGNED_BYTE, this.repXDat);
					for(let x = 0; x < ww * 4; ++ x) {
						this.repYDat[x] = data.data[x];
					}
					this.repYDat[ww * 4    ] = data.data[0];
					this.repYDat[ww * 4 + 1] = data.data[1];
					this.repYDat[ww * 4 + 2] = data.data[2];
					this.repYDat[ww * 4 + 3] = data.data[3];
					gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, hh, ww + 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, this.repYDat);
					for(let x = 0; x < ww * 4; ++ x) {
						this.repYDat[x] = data.data[ww * (hh - 1) * 4 + x];
					}
					gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, PoTy - 1, ww + 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, this.repYDat);
				}
				this.boardW = ww;
				this.boardH = hh;
				this.texWidth = PoTx;
				this.texHeight = PoTy;
			}

			this.rerender();
		}

		dom() {
			return this.board;
		}
	}
});
