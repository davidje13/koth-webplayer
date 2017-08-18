define(['core/webgl_utils', 'math/Mat4'], (webgl_utils, Mat4) => {
	'use strict';

	return class ModelPoint extends webgl_utils.ModelData {
		constructor({
			surfaceNormal = true,
			uv = true,
			stride = 8,
			radius = 1,
			height = 1
		} = {}) {
			super(stride);
			this.surfaceNormal = surfaceNormal;
			this.uv = uv;

			this.radius = radius;
			this.height = height;

			this.dirtyIndices = true;
			this.dirtyVertices = true;
		}

		setSize(radius, height) {
			if(this.radius !== radius || this.height !== height) {
				this.radius = radius;
				this.height = height;
				this.dirtyVertices = true;
			}
		}

		rebuildIndices() {
			const indices = new Uint16Array(4 * 3);
			for(let i = 0; i < indices.length; ++ i) {
				indices[i] = i;
			}
			this.setIndices(indices);
		}

		rebuildVertices() {
			const surfaceNormal = this.surfaceNormal;
			const uv = this.uv;
			const stride = this.stride;

			const data = new Float32Array(12 * stride);
			let dataP = 0;
			const uv0 = surfaceNormal ? 6 : 3;

			const addPt = (p, n, u, v) => {
				data[dataP    ] = p.x;
				data[dataP + 1] = p.y;
				data[dataP + 2] = p.z;
				if(surfaceNormal) {
					data[dataP + 3] = n.x;
					data[dataP + 4] = n.y;
					data[dataP + 5] = n.z;
				}
				if(uv) {
					data[dataP + uv0    ] = u;
					data[dataP + uv0 + 1] = v;
				}
				dataP += stride;
			};

			const addTri = (p1, p2, p3) => {
				const n = p2.sub(p3).cross(p2.sub(p1));
				addPt(p1, n, 0, 0);
				addPt(p2, n, 0, 1);
				addPt(p3, n, 1, 1);
			};

			const ptAt = (t, r, z) => {
				return new Mat4.Vec3(Math.sin(t) * r, Math.cos(t) * r, z);
			};

			addTri(
				ptAt(0, 0, 0),
				ptAt(Math.PI * 2 / 3, this.radius, this.height),
				ptAt(-Math.PI * 2 / 3, this.radius, this.height)
			);
			addTri(
				ptAt(0, 0, 0),
				ptAt(-Math.PI * 2 / 3, this.radius, this.height),
				ptAt(0, this.radius, this.height)
			);
			addTri(
				ptAt(0, 0, 0),
				ptAt(0, this.radius, this.height),
				ptAt(Math.PI * 2 / 3, this.radius, this.height)
			);
			addTri(
				ptAt(0, this.radius, this.height),
				ptAt(-Math.PI * 2 / 3, this.radius, this.height),
				ptAt(Math.PI * 2 / 3, this.radius, this.height)
			);

			this.setData(data);
		}
	};
});
