define([
	'./webglUtils',
	'math/vector',
	'math/Ellipse',
], (
	webglUtils,
	vector,
	Ellipse
) => {
	'use strict';

	function buildYCaches(crossSection, loopY, segsY) {
		const yStartFrac = -0.5 * loopY;
		const yEndFrac = 0.5 * loopY;
		const yStartTheta = crossSection.thetaFromFrac(yStartFrac);
		const yEndTheta = crossSection.thetaFromFrac(yEndFrac);

		const ySin = [];
		const yCos = [];
		const yFrac = [];
		for(let y = 0; y <= segsY; ++ y) {
			const a = (
				yStartTheta +
				(yEndTheta - yStartTheta) * (y / segsY)
			);
			ySin.push(Math.sin(a));
			yCos.push(Math.cos(a));
			yFrac.push(
				(crossSection.fracFromTheta(a) - yStartFrac) /
				(yEndFrac - yStartFrac)
			);
		}

		return {ySin, yCos, yFrac};
	}

	return class ModelTorus extends webglUtils.ModelData {
		constructor({
			surfaceNormal = true,
			uv = true,
			stride = 8,
			segsX = 0,
			segsY = 0,
			rad1 = 0,
			rad2A = 0,
			rad2B = 0,
			loopX = 1,
			loopY = 1
		} = {}) {
			super(stride);
			this.surfaceNormal = surfaceNormal;
			this.uv = uv;

			this.shape = {
				segsX,
				segsY,
				rad1,
				rad2A,
				rad2B,
				loopX,
				loopY,
			};

			this.cacheVertBuffer = null;
			this.cacheCrossSection = null;

			this.dirtyIndices = true;
			this.dirtyVertices = true;
		}

		setResolution(segsX, segsY) {
			if(this.shape.segsX !== segsX || this.shape.segsY !== segsY) {
				this.shape.segsX = segsX;
				this.shape.segsY = segsY;
				this.cacheVertBuffer = null;
				this.dirtyVertices = true;
				this.dirtyIndices = true;
			}
		}

		setRadii(rad1, rad2A, rad2B) {
			if(this.shape.rad1 !== rad1) {
				this.shape.rad1 = rad1;
				this.dirtyVertices = true;
			}
			if(this.shape.rad2A !== rad2A || this.shape.rad2B !== rad2B) {
				this.shape.rad2A = rad2A;
				this.shape.rad2B = rad2B;
				this.cacheCrossSection = null;
				this.dirtyVertices = true;
			}
		}

		setFractions(loopX, loopY) {
			if(this.shape.loopX !== loopX || this.shape.loopY !== loopY) {
				this.shape.loopX = loopX;
				this.shape.loopY = loopY;
				this.dirtyVertices = true;
			}
		}

		getCrossSection() {
			const {rad2A, rad2B} = this.shape;
			return (
				this.cacheCrossSection ||
				(this.cacheCrossSection = new Ellipse(rad2A, rad2B))
			);
		}

		rebuildIndices() {
			const {segsX, segsY} = this.shape;
			const indices = new Uint16Array(segsX * segsY * 6);

			for(let x = 0; x < segsX; ++ x) {
				for(let y = 0; y < segsY; ++ y) {
					const o = (x * segsY + y) * 6;
					indices[o    ] =  x      * (segsY + 1) + y;
					indices[o + 1] =  x      * (segsY + 1) + y + 1;
					indices[o + 2] = (x + 1) * (segsY + 1) + y + 1;
					indices[o + 3] = (x + 1) * (segsY + 1) + y + 1;
					indices[o + 4] = (x + 1) * (segsY + 1) + y;
					indices[o + 5] =  x      * (segsY + 1) + y;
				}
			}
			this.setIndices(indices);
		}

		rebuildVertices() {
			const {segsX, segsY, rad1, rad2A, rad2B, loopX, loopY} = this.shape;
			const surfaceNormal = this.surfaceNormal;
			const uv = this.uv;
			const stride = this.stride;

			const vertNormUV = (
				this.cacheVertBuffer ||
				(this.cacheVertBuffer = new Float32Array((segsX + 1) * (segsY + 1) * stride))
			);

			const {ySin, yCos, yFrac} = buildYCaches(
				this.getCrossSection(),
				loopY,
				segsY
			);

			const uv0 = surfaceNormal ? 6 : 3;

			for(let x = 0; x <= segsX; ++ x) {
				const a0 = Math.PI * 2 * (x / segsX - 0.5) * loopX;
				const dx = -Math.sin(a0);
				const dy = -Math.cos(a0);
				const xf = x / segsX;

				for(let y = 0; y <= segsY; ++ y) {
					const dr = yCos[y];
					const dz = ySin[y];
					const yf = yFrac[y];

					const p = x * (segsY + 1) + y;
					vertNormUV[p * stride    ] = dx * (rad1 + dr * rad2A);
					vertNormUV[p * stride + 1] = dy * (rad1 + dr * rad2A);
					vertNormUV[p * stride + 2] = dz * rad2B;

					if(surfaceNormal) {
						vertNormUV[p * stride + 3] = dx * (dr * rad2B);
						vertNormUV[p * stride + 4] = dy * (dr * rad2B);
						vertNormUV[p * stride + 5] = dz * rad2A;
					}

					if(uv) {
						vertNormUV[p * stride + uv0    ] = xf;
						vertNormUV[p * stride + uv0 + 1] = yf;
					}
				}
			}

			this.setData(vertNormUV);
		}

		find(x, y) {
			const {rad1, rad2A, rad2B, loopX, loopY} = this.shape;

			const yStartFrac = -0.5 * loopY;
			const yEndFrac = 0.5 * loopY;
			const crossSection = this.getCrossSection();
			const a1 = crossSection.thetaFromFrac(y * (yEndFrac - yStartFrac) + yStartFrac);

			const a0 = Math.PI * 2 * ((((x % 1) + 1) % 1) - 0.5) * loopX;
			const dx = -Math.sin(a0);
			const dy = -Math.cos(a0);
			const dr = Math.cos(a1);
			const dz = Math.sin(a1);

			return {
				p: new vector.V3(
					dx * (rad1 + dr * rad2A),
					dy * (rad1 + dr * rad2A),
					dz * rad2B
				),
				n: new vector.V3(
					dx * dr * rad2B,
					dy * dr * rad2B,
					dz * rad2A
				),
			};
		}
	};
});
