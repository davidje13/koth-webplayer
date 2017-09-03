define(() => {
	'use strict';

	function nextPoT(v) {
		/* jshint -W016 */ // bit operations used for speed
		-- v;
		v |= v >>> 1;
		v |= v >>> 2;
		v |= v >>> 4;
		v |= v >>> 8;
		v |= v >>> 16;
		v |= v >>> 32;
		return v + 1;
	}

	function makeTexture(gl, type, params) {
		const tex = gl.createTexture();
		gl.bindTexture(type, tex);
		for(let pname in params) {
			if(params.hasOwnProperty(pname)) {
				gl.texParameteri(type, pname, params[pname]);
			}
		}
		return tex;
	}

	function makeShader(gl, type, src) {
		const shader = gl.createShader(type);
		gl.shaderSource(shader, src);
		gl.compileShader(shader);
		if(!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
			throw new Error('Failed to compile shader: ' + gl.getShaderInfoLog(shader));
		}
		return shader;
	}

	function makeProgram(gl, shaders) {
		const prog = gl.createProgram();
		shaders.forEach((shader) => gl.attachShader(prog, shader));
		gl.linkProgram(prog);
		if(!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
			throw new Error('Failed to link program: ' + gl.getProgramInfoLog(prog));
		}
		gl.validateProgram(prog);
		if(!gl.getProgramParameter(prog, gl.VALIDATE_STATUS)) {
			throw new Error('Failed to validate program: ' + gl.getProgramInfoLog(prog));
		}
		return prog;
	}

	function getProgParams(gl, prog, uniforms, attributes) {
		const o = {};
		uniforms.forEach((uniform) =>
			o[uniform] = gl.getUniformLocation(prog, uniform));
		attributes.forEach((attr) =>
			o[attr] = gl.getAttribLocation(prog, attr));
		return o;
	}

	function setUniformI(gl, locn, v) {
		if(typeof v === 'number') {
			gl.uniform1i(locn, v);
		} else if(v.length === 1) {
			gl.uniform1iv(locn, v);
		} else if(v.length === 2) {
			gl.uniform2iv(locn, v);
		} else if(v.length === 3) {
			gl.uniform3iv(locn, v);
		} else if(v.length === 4) {
			gl.uniform4iv(locn, v);
		} else {
			throw new Error('Bad vector size ' + v.length);
		}
	}

	function setUniformF(gl, locn, v) {
		if(typeof v === 'number') {
			gl.uniform1f(locn, v);
		} else if(v.length === 1) {
			gl.uniform1fv(locn, v);
		} else if(v.length === 2) {
			gl.uniform2fv(locn, v);
		} else if(v.length === 3) {
			gl.uniform3fv(locn, v);
		} else if(v.length === 4) {
			gl.uniform4fv(locn, v);
		} else {
			throw new Error('Bad vector size ' + v.length);
		}
	}

	function setUniformM(gl, locn, v) {
		if(!v.length && v.data) {
			v = v.data;
		}
		if(v.length === 2 * 2) {
			gl.uniformMatrix2fv(locn, false, v);
		} else if(v.length === 3 * 3) {
			gl.uniformMatrix3fv(locn, false, v);
		} else if(v.length === 4 * 4) {
			gl.uniformMatrix4fv(locn, false, v);
		} else {
			throw new Error('Bad matrix size ' + v.length);
		}
	}

	function setUniform(gl, locn, v, state) {
		if(typeof v === 'number') {
			setUniformF(gl, locn, v);
		} else if(v.tex2D !== undefined) {
			let ind = v.i;
			if(ind === undefined) {
				ind = state.texIndex ++;
			}
			gl.activeTexture(gl.TEXTURE0 + ind);
			gl.bindTexture(gl.TEXTURE_2D, v.tex2D);
			gl.uniform1i(locn, ind);
		} else if(v.i !== undefined) {
			setUniformI(gl, locn, v.i);
		} else if(v.m !== undefined) {
			setUniformM(gl, locn, v.m);
		} else if(v.f !== undefined) {
			setUniformF(gl, locn, v.f);
		} else if(v.data !== undefined || v.length > 4) {
			setUniformM(gl, locn, v);
		} else if(v.length) {
			setUniformF(gl, locn, v);
		} else {
			throw new Error('Unknown value for uniform: ' + v);
		}
	}

	class Program {
		constructor(gl, shaders) {
			this.gl = gl;
			this.prog = makeProgram(gl, shaders);
			this.params = {};
		}

		program() {
			return this.prog;
		}

		findUniform(name) {
			return (
				this.params[name] ||
				(this.params[name] = this.gl.getUniformLocation(this.prog, name))
			);
		}

		findAttribute(name) {
			return (
				this.params[name] ||
				(this.params[name] = this.gl.getAttribLocation(this.prog, name))
			);
		}

		uniform(map) {
			const state = {texIndex: 0};
			for(let attr in map) {
				if(map.hasOwnProperty(attr)) {
					setUniform(this.gl, this.findUniform(attr), map[attr], state);
				}
			}
		}

		uniformi(map) {
			for(let attr in map) {
				if(map.hasOwnProperty(attr)) {
					setUniformI(this.gl, this.findUniform(attr), map[attr]);
				}
			}
		}

		uniformf(map) {
			for(let attr in map) {
				if(map.hasOwnProperty(attr)) {
					setUniformF(this.gl, this.findUniform(attr), map[attr]);
				}
			}
		}

		uniformMatrix(map) {
			for(let attr in map) {
				if(map.hasOwnProperty(attr)) {
					setUniformM(this.gl, this.findUniform(attr), map[attr]);
				}
			}
		}

		use(uniforms = {}) {
			this.gl.useProgram(this.prog);
			this.uniform(uniforms);
		}

		vertexAttribPointer(map) {
			for(let attr in map) {
				if(map.hasOwnProperty(attr)) {
					const locn = this.findAttribute(attr);
					const v = map[attr];
					this.gl.enableVertexAttribArray(locn);
					this.gl.vertexAttribPointer(
						locn,
						v.size,
						v.type,
						v.normalized || false,
						v.stride || 0,
						v.offset || 0
					);
				}
			}
		}
	}

	class ModelData {
		constructor(stride = 3) {
			this.gl = null;
			this.stride = stride;
			this.bufData = null;
			this.bufTris = null;
			this.indexCount = 0;
			this.dirtyVertices = false;
			this.dirtyIndices = false;
			this.animatingVertices = false;
			this.animatingIndices = false;
		}

		rebuildVertices() {
		}

		rebuildIndices() {
		}

		setAnimating(animating) {
			this.animatingVertices = animating;
			this.animatingIndices = animating;
		}

		setAnimatingVertices(animating) {
			this.animatingVertices = animating;
		}

		setAnimatingIndices(animating) {
			this.animatingIndices = animating;
		}

		setData(data, mode = null) {
			const gl = this.gl;
			if(mode === null) {
				mode = this.animatingVertices ? gl.STREAM_DRAW : gl.STATIC_DRAW;
			}
			if(!this.bufData) {
				this.bufData = gl.createBuffer();
			}
			gl.bindBuffer(gl.ARRAY_BUFFER, this.bufData);
			gl.bufferData(gl.ARRAY_BUFFER, data, mode);
		}

		setIndices(tris, mode = null) {
			const gl = this.gl;
			if(mode === null) {
				mode = this.animatingIndices ? gl.STREAM_DRAW : gl.STATIC_DRAW;
			}
			if(!this.bufTris) {
				this.bufTris = gl.createBuffer();
			}
			gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.bufTris);
			gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, tris, mode);
			this.indexCount = tris.length;
		}

		bindAll() {
			const gl = this.gl;
			if(this.dirtyVertices) {
				this.rebuildVertices();
				this.dirtyVertices = false;
			}
			gl.bindBuffer(gl.ARRAY_BUFFER, this.bufData);
			gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.bufTris);
		}

		render(wireframe = false) {
			const gl = this.gl;
			if(this.dirtyIndices) {
				this.rebuildIndices();
				this.dirtyIndices = false;
			}
			if(!this.indexCount) {
				return;
			}
			gl.drawElements(
				wireframe ? gl.LINES : gl.TRIANGLES,
				this.indexCount,
				gl.UNSIGNED_SHORT,
				0
			);
		}
	}

	return {
		nextPoT,

		makeTexture,
		makeShader,
		makeProgram,
		getProgParams,

		Program,
		ModelData,
	};
});
