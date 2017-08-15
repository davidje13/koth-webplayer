define(() => {
	'use strict';

	return {
		makeTexture: (gl, type, params) => {
			const tex = gl.createTexture();
			gl.bindTexture(type, tex);
			for(let pname in params) {
				if(params.hasOwnProperty(pname)) {
					gl.texParameteri(type, pname, params[pname]);
				}
			}
			return tex;
		},

		makeShader: (gl, type, src) => {
			const shader = gl.createShader(type);
			gl.shaderSource(shader, src);
			gl.compileShader(shader);
			if(!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
				throw 'Failed to compile shader: ' + gl.getShaderInfoLog(shader);
			}
			return shader;
		},

		makeProgram: (gl, shaders) => {
			const prog = gl.createProgram();
			shaders.forEach((shader) => gl.attachShader(prog, shader));
			gl.linkProgram(prog);
			if(!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
				throw 'Failed to link program: ' + gl.getProgramInfoLog(prog);
			}
			gl.validateProgram(prog);
			if(!gl.getProgramParameter(prog, gl.VALIDATE_STATUS)) {
				throw 'Failed to validate program: ' + gl.getProgramInfoLog(prog);
			}
			return prog;
		},

		getProgParams: (gl, prog, uniforms, attributes) => {
			const o = {};
			uniforms.forEach((uniform) =>
				o[uniform] = gl.getUniformLocation(prog, uniform));
			attributes.forEach((attr) =>
				o[attr] = gl.getAttribLocation(prog, attr));
			return o;
		},
	};
});
