define(['core/document_utils', 'core/webgl_utils', 'core/EventObject', 'math/Mat4', 'math/Ellipse'], (docutil, webgl_utils, EventObject, Mat4, Ellipse) => {
	'use strict';

	// TODO:
	// * move more low-level logic into webgl_utils
	// * provide transition parameter (animate from 2D to 3D)
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

	return class Full3DBoard extends EventObject {
		constructor(renderer, width, height) {
			super();

			this.renderer = renderer;
			this.wireframe = false;
			this.viewAngle = 0;
			this.viewLift = Math.PI * 0.25;
			this.viewDist = 3.5;

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
			this.torus = null;

			docutil.addDragHandler(this.board, (dx, dy) => {
				this.viewAngle -= dx * Math.PI / this.canvas.width;
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

			this.buildTorus();
		}

		buildTorus() {
			const segsX = 128;
			const segsY = 128;
			const rad1 = 1;
			const rad2A = 0.2;
			const rad2B = 0.7;
			const loopX = 1;
			const loopY = 1;

			const normFactorA = (rad2A === 0) ? 1 : (rad2B / rad2A);
			const normFactorB = (rad2B === 0) ? 1 : (rad2A / rad2B);

			const gl = this.context;

			if(loopX >= 1 && loopY >= 1) {
				gl.enable(gl.CULL_FACE);
			} else {
				gl.disable(gl.CULL_FACE);
			}

			if(this.genSegX !== segsX || this.genSegY !== segsY) {
				this.genSegX = segsX;
				this.genSegY = segsY;
				this.torus = new Float32Array((this.genSegX + 1) * (this.genSegY + 1) * 8);
				this.torusTris = new Uint16Array(this.genSegX * this.genSegY * 6);

				for(let x = 0; x < this.genSegX; ++ x) {
					for(let y = 0; y < this.genSegY; ++ y) {
						const o = (x * this.genSegY + y) * 6;
						this.torusTris[o    ] =  x      * (this.genSegY + 1) + y;
						this.torusTris[o + 1] =  x      * (this.genSegY + 1) + y + 1;
						this.torusTris[o + 2] = (x + 1) * (this.genSegY + 1) + y + 1;
						this.torusTris[o + 3] = (x + 1) * (this.genSegY + 1) + y + 1;
						this.torusTris[o + 4] = (x + 1) * (this.genSegY + 1) + y;
						this.torusTris[o + 5] =  x      * (this.genSegY + 1) + y;
					}
				}
				gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.bufTorusTris);
				gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.torusTris, gl.STATIC_DRAW);
				this.torusTriCount = this.torusTris.length / 3;
			}

			const crossSection = new Ellipse(rad2A, rad2B);

			const yStartFrac = -0.5 * loopY;
			const yEndFrac = 0.5 * loopY;
			const yStartTheta = crossSection.thetaFromFrac(yStartFrac);
			const yEndTheta = crossSection.thetaFromFrac(yEndFrac);

			const ySin = [];
			const yCos = [];
			const yFrac = [];
			for(let y = 0; y <= this.genSegY; ++ y) {
				const a = (
					yStartTheta +
					(yEndTheta - yStartTheta) * (y / this.genSegY)
				);
				ySin.push(Math.sin(a));
				yCos.push(Math.cos(a));
				yFrac.push(
					(crossSection.fracFromTheta(a) - yStartFrac) /
					(yEndFrac - yStartFrac)
				);
			}

			const torus = this.torus;
			for(let x = 0; x <= this.genSegX; ++ x) {
				const a0 = Math.PI * 2 * (x / this.genSegX - 0.5) * loopX;
				const dx = -Math.sin(a0);
				const dy = -Math.cos(a0);
				const xf = x / this.genSegX;

				for(let y = 0; y <= this.genSegY; ++ y) {
					const dr = yCos[y];
					const dz = ySin[y];
					const yf = yFrac[y];

					const p = x * (this.genSegY + 1) + y;
					// Vertex
					this.torus[p * 8    ] = dx * (rad1 + dr * rad2A);
					this.torus[p * 8 + 1] = dy * (rad1 + dr * rad2A);
					this.torus[p * 8 + 2] = dz * rad2B;
					// Normal
					this.torus[p * 8 + 3] = dx * dr * normFactorA;
					this.torus[p * 8 + 4] = dy * dr * normFactorA;
					this.torus[p * 8 + 5] = dz * normFactorB;
					// UV
					this.torus[p * 8 + 6] = xf;
					this.torus[p * 8 + 7] = yf;
				}
			}

			gl.bindBuffer(gl.ARRAY_BUFFER, this.bufTorus);
			gl.bufferData(gl.ARRAY_BUFFER, this.torus, gl.STATIC_DRAW);
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

			const aspect = this.canvas.width / this.canvas.height;
			const matProjection = Mat4.perspective(Math.PI * 0.125, aspect, 0.1, 10.0);
			const matModelView = Mat4.look(
				new Mat4.Vec3(
					this.viewDist * Math.sin(this.viewAngle) * Math.cos(this.viewLift),
					this.viewDist * Math.cos(this.viewAngle) * Math.cos(this.viewLift),
					this.viewDist * Math.sin(this.viewLift)
				),
				new Mat4.Vec3(0, 0, 0),
				new Mat4.Vec3(
					Math.sin(this.viewAngle) * 0.1 * this.viewLift,
					Math.cos(this.viewAngle) * 0.1 * this.viewLift,
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
				this.torusTriCount * 3,
				gl.UNSIGNED_SHORT,
				0
			);
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
