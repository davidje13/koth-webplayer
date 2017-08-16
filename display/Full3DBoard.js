define(['core/document_utils', 'core/webgl_utils', 'core/EventObject', 'math/Mat4', 'math/Ellipse'], (docutil, webgl_utils, EventObject, Mat4, Ellipse) => {
	'use strict';

	// TODO:
	// * move more low-level logic into webgl_utils
	// * is mip-mapping enabled on the texture? occasionally tries to read
	//   beyond provided data, causing a black mark at the wrap point
	//   (and can't use non-PoT texture)
	// * provide rendering of marks (2D div overlay or 3D geometry?)

	function nextPoT(v) {
		-- v;
		v |= v >>> 1;
		v |= v >>> 2;
		v |= v >>> 4;
		v |= v >>> 8;
		v |= v >>> 16;
		v |= v >>> 32;
		return v + 1;
	}

	class Torus {
		constructor(segsX, segsY) {
			this.segsX = segsX;
			this.segsY = segsY;
			this.vertNormUV = new Float32Array((segsX + 1) * (segsY + 1) * 8);
			this.indices = new Uint16Array(segsX * segsY * 6);

			for(let x = 0; x < segsX; ++ x) {
				for(let y = 0; y < segsY; ++ y) {
					const o = (x * segsY + y) * 6;
					this.indices[o    ] =  x      * (segsY + 1) + y;
					this.indices[o + 1] =  x      * (segsY + 1) + y + 1;
					this.indices[o + 2] = (x + 1) * (segsY + 1) + y + 1;
					this.indices[o + 3] = (x + 1) * (segsY + 1) + y + 1;
					this.indices[o + 4] = (x + 1) * (segsY + 1) + y;
					this.indices[o + 5] =  x      * (segsY + 1) + y;
				}
			}
		}

		faces() {
			return this.indices.length / 3;
		}

		generateShape(rad1, rad2A, rad2B, loopX = 1, loopY = 1) {
			const normFactorA = (rad2A === 0) ? 1 : (rad2B / rad2A);
			const normFactorB = (rad2B === 0) ? 1 : (rad2A / rad2B);

			const crossSection = new Ellipse(rad2A, rad2B);

			const yStartFrac = -0.5 * loopY;
			const yEndFrac = 0.5 * loopY;
			const yStartTheta = crossSection.thetaFromFrac(yStartFrac);
			const yEndTheta = crossSection.thetaFromFrac(yEndFrac);

			const ySin = [];
			const yCos = [];
			const yFrac = [];
			for(let y = 0; y <= this.segsY; ++ y) {
				const a = (
					yStartTheta +
					(yEndTheta - yStartTheta) * (y / this.segsY)
				);
				ySin.push(Math.sin(a));
				yCos.push(Math.cos(a));
				yFrac.push(
					(crossSection.fracFromTheta(a) - yStartFrac) /
					(yEndFrac - yStartFrac)
				);
			}

			const target = this.vertNormUV;

			for(let x = 0; x <= this.segsX; ++ x) {
				const a0 = Math.PI * 2 * (x / this.segsX - 0.5) * loopX;
				const dx = -Math.sin(a0);
				const dy = -Math.cos(a0);
				const xf = x / this.segsX;

				for(let y = 0; y <= this.segsY; ++ y) {
					const dr = yCos[y];
					const dz = ySin[y];
					const yf = yFrac[y];

					const p = x * (this.segsY + 1) + y;
					// Vertex
					target[p * 8    ] = dx * (rad1 + dr * rad2A);
					target[p * 8 + 1] = dy * (rad1 + dr * rad2A);
					target[p * 8 + 2] = dz * rad2B;
					// Normal
					target[p * 8 + 3] = dx * dr * normFactorA;
					target[p * 8 + 4] = dy * dr * normFactorA;
					target[p * 8 + 5] = dz * normFactorB;
					// UV
					target[p * 8 + 6] = xf;
					target[p * 8 + 7] = yf;
				}
			}

			return target;
		}
	}

	return class Full3DBoard extends EventObject {
		constructor(renderer, width, height) {
			super();

			this.renderer = renderer;
			this.wireframe = false;
			this.viewAngle = 0;
			this.viewLift = Math.PI * 0.25;
			this.viewDist = 3.5;
			this.frac3D = 1;

			this.marks = new Map();

			window.devicePixelRatio = 1;
			this.canvas = docutil.make('canvas');
			this.canvas.width = width * 2;
			this.canvas.height = height * 2;
			this.canvas.style.width = width + 'px';
			this.canvas.style.height = height + 'px';
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

			this.bufTorus = gl.createBuffer();
			this.bufTorusTris = gl.createBuffer();

			const vertShader = webgl_utils.makeShader(gl, gl.VERTEX_SHADER, (
				'uniform mat4 matProj;\n' +
				'uniform mat4 matMV;\n' +
				'uniform mat4 matNorm;\n' +
				'attribute vec3 vert;\n' +
				'attribute vec3 norm;\n' +
				'attribute vec2 uv;\n' +
				'varying mediump vec2 texp;\n' +
				'varying mediump float light;\n' +
				'void main(void) {\n' +
				'  gl_Position = matProj * matMV * vec4(vert.xyz, 1);\n' +
				'  vec3 n = normalize((matNorm * vec4(norm, 1)).xyz);\n' +
				'  light = dot(n, vec3(0, 0, 1));\n' +
				'  texp = uv;\n' +
				'}\n'
			));

			const fragShader = webgl_utils.makeShader(gl, gl.FRAGMENT_SHADER, (
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
			));

			this.prog = webgl_utils.makeProgram(gl, [vertShader, fragShader]);

			this.progParams = webgl_utils.getProgParams(gl, this.prog, [
				'matProj', 'matMV', 'matNorm',
				'tex', 'texScale',
				'shadowStr', 'shadowCol',
				'backCol',
			], [
				'vert', 'norm', 'uv'
			]);

			gl.enableVertexAttribArray(this.progParams.vert);
			gl.enableVertexAttribArray(this.progParams.norm);
			gl.enableVertexAttribArray(this.progParams.uv);

			this.hasTex = false;
			this.nextRerender = 0;
			this.rerenderTm = null;
			this.torus = new Torus(128, 128);
			this.torusLow = new Torus(64, 64);
			this.torusFaces = 0;
			this.torusFocus = new Mat4.Vec3(0, 0, 0);

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

			this.genSegX = 0;
			this.genSegY = 0;
			this.texWidth = 0;
			this.texHeight = 0;
			this.texScaleX = 1;
			this.texScaleY = 1;
			this.torusDirty = true;

			this._buildTorus(false);
		}

		resize(width, height) {
			if(this.canvas.width !== width * 2 || this.canvas.height !== height * 2) {
				this.canvas.width = width * 2;
				this.canvas.height = height * 2;
				this.canvas.style.width = width + 'px';
				this.canvas.style.height = height + 'px';
			}
		}

		_buildTorus() {
			const gl = this.context;

			const fullRad2A = 0.2;
			const fullRad2B = 0.7;

			const depth = this.frac3D;
			const easeIn = depth * depth;
			const easeOut = 1 - (1 - depth) * (1 - depth);
			const animating = (depth > 0 && depth < 1);
			const torus = animating ? this.torusLow : this.torus;

			const rad1 = 1 / Math.max(depth, 0.00001);
			const loopX = 1 / ((rad1 * Math.PI) * (1 - depth) + depth);
			const loopY = 0.5 + 0.5 * easeIn;
			const rad2A = fullRad2A * easeOut;
			const rad2B = (1 - depth) + fullRad2B * depth;
			const verts = torus.generateShape(rad1, rad2A, rad2B, loopX, loopY);
			this.torusFocus.y = rad1 - depth;

			gl.bindBuffer(gl.ARRAY_BUFFER, this.bufTorus);
			gl.bufferData(gl.ARRAY_BUFFER, verts, animating ? gl.STREAM_DRAW : gl.STATIC_DRAW);

			if(this.torusFaces !== torus.faces()) {
				gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.bufTorusTris);
				gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, torus.indices, gl.STATIC_DRAW);
				this.torusFaces = torus.faces();
			}

			if(depth >= 1) {
				gl.enable(gl.CULL_FACE);
			} else {
				gl.disable(gl.CULL_FACE);
			}

			this.torusDirty = false;
		}

		updateTorus(frac3D) {
			if(this.frac3D !== frac3D) {
				this.frac3D = frac3D;
				this.torusDirty = true;
			}
		}

		rerender() {
			this.nextRerender = Date.now() + 10;
			clearTimeout(this.rerenderTm);
			this.rerenderTm = null;

			const gl = this.context;

			gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

			if(!this.hasTex) {
				return;
			}

			if(this.torusDirty) {
				this._buildTorus(true);
			}

			const depth = this.frac3D;
			const aspect = this.canvas.width / this.canvas.height;
			const fov = Math.PI * (0.125 * depth + 0.25 * (1 - depth));
			const matProjection = Mat4.perspective(fov, aspect * depth + (1 - depth), 0.1, 10.0);
			let ang = this.viewAngle;
			if(depth < 1) {
				ang = (ang % (Math.PI * 2)) * depth * depth * depth * depth;
			}
			const lift = this.viewLift * depth;
			const dist = this.viewDist * depth + 1 * (1 - depth);
			const matModelView = Mat4.look(
				this.torusFocus.add(new Mat4.Vec3(
					dist * Math.sin(ang) * Math.cos(lift),
					dist * Math.cos(ang) * Math.cos(lift),
					dist * Math.sin(lift)
				)),
				this.torusFocus,
				new Mat4.Vec3(
					Math.sin(ang) * 0.1 * lift,
					Math.cos(ang) * 0.1 * lift,
					-1
				),
			);

			gl.useProgram(this.prog);
			gl.uniformMatrix4fv(this.progParams.matProj, false, matProjection.data);
			gl.uniformMatrix4fv(this.progParams.matMV, false, matModelView.data);
			gl.uniformMatrix4fv(this.progParams.matNorm, false, matModelView.noTranslate().invert().transpose().data);

			gl.bindBuffer(gl.ARRAY_BUFFER, this.bufTorus);
			gl.vertexAttribPointer(this.progParams.vert, 3, gl.FLOAT, false, 8 * 4, 0);
			gl.vertexAttribPointer(this.progParams.norm, 3, gl.FLOAT, false, 8 * 4, 3 * 4);
			gl.vertexAttribPointer(this.progParams.uv,   2, gl.FLOAT, false, 8 * 4, 6 * 4);

			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, this.texBoard);
			gl.uniform1i(this.progParams.tex, 0);

			gl.uniform1f(this.progParams.shadowStr, 0.8);
			gl.uniform3f(this.progParams.shadowCol, 0.0, 0.02, 0.03);
			gl.uniform3f(this.progParams.backCol, 0.2, 0.2, 0.2);
			gl.uniform2f(this.progParams.texScale, this.texScaleX, this.texScaleY);

			gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.bufTorusTris);
			gl.drawElements(
				this.wireframe ? gl.LINES : gl.TRIANGLES,
				this.torusFaces * 3,
				gl.UNSIGNED_SHORT,
				0
			);
		}

		setWireframe(on) {
			this.wireframe = on;
		}

		repaint() {
			const gl = this.context;
			const data = this.renderer.getImageData();
			if(data) {
				gl.bindTexture(gl.TEXTURE_2D, this.texBoard);
				const ww = data.width;
				const hh = data.height;
				const PoTx = nextPoT(ww);
				const PoTy = nextPoT(hh);
				if(ww === PoTx && hh === PoTy) {
					gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, data);
				} else {
					if(this.texWidth !== PoTx || this.texHeight !== PoTy) {
						this.texWidth = PoTx;
						this.texHeight = PoTy;
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
				this.texScaleX = ww / PoTx;
				this.texScaleY = hh / PoTy;
				this.hasTex = true;
			}

			this.rerender();
		}

		_repaintMark(mark) {
			// TODO
		}

		mark(key, {x, y, w, h, className}) {
			if(x === undefined || y === undefined) {
				this.removeMark(key);
				return;
			}
			let o = this.marks.get(key);
			if(!o) {
				this.marks.set(key, o = {
					x: null,
					y: null,
					w: null,
					h: null,
					className: null,
				});
			}
			o.x = x;
			o.y = y;
			o.w = w;
			o.h = h;
			o.className = className;
			this._repaintMark(o);
		}

		removeMark(key) {
			const mark = this.marks.get(key);
			if(mark) {
				docutil.set_parent(mark.element, null)
				this.marks.delete(key);
			}
		}

		removeAllMarks() {
			this.marks.forEach((mark, key) => this.removeMark(key));
		}

		dom() {
			return this.board;
		}
	}
});
