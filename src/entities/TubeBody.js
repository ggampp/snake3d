import * as THREE from 'three';

/**
 * Builds a smooth, tapered tube geometry through a list of world-space points
 * using parallel-transport (Frenet) frames. Radius goes from `radiusBase` at
 * the head (t=0) down to `radiusBase * taperTail` at the tail (t=1), giving a
 * continuous snake body instead of discrete beads.
 */
export function buildTaperedTube(pointsWorld, radiusBase, radialSegments = 12, taperTail = 0.25) {
  const curve = new THREE.CatmullRomCurve3(pointsWorld, false, 'catmullrom', 0.5);
  const tubularSegments = Math.max(8, (pointsWorld.length - 1) * 3);
  const frames = curve.computeFrenetFrames(tubularSegments, false);

  const positions = [];
  const normals = [];
  const indices = [];
  const P = new THREE.Vector3();
  const N = new THREE.Vector3();

  for (let i = 0; i <= tubularSegments; i++) {
    const t = i / tubularSegments;
    curve.getPointAt(t, P);
    const nrm = frames.normals[i];
    const bin = frames.binormals[i];
    // Smooth taper, slightly rounded toward the tail.
    const r = radiusBase * (1 - (1 - taperTail) * t * t);

    for (let j = 0; j <= radialSegments; j++) {
      const v = (j / radialSegments) * Math.PI * 2;
      const cx = -Math.cos(v);
      const sy = Math.sin(v);
      N.set(
        cx * nrm.x + sy * bin.x,
        cx * nrm.y + sy * bin.y,
        cx * nrm.z + sy * bin.z
      ).normalize();
      positions.push(P.x + N.x * r, P.y + N.y * r, P.z + N.z * r);
      normals.push(N.x, N.y, N.z);
    }
  }

  const stride = radialSegments + 1;
  for (let i = 1; i <= tubularSegments; i++) {
    for (let j = 1; j <= radialSegments; j++) {
      const a = stride * (i - 1) + (j - 1);
      const b = stride * i + (j - 1);
      const c = stride * i + j;
      const d = stride * (i - 1) + j;
      indices.push(a, b, d, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setIndex(indices);
  return geo;
}

/** A mesh whose tube geometry is rebuilt each frame from a moving body path. */
export class TubeBody {
  constructor(material, radialSegments = 12) {
    this.radialSegments = radialSegments;
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
    this.mesh.frustumCulled = false;
  }

  update(pointsWorld, radiusBase, taperTail = 0.25) {
    if (pointsWorld.length < 2) return;
    const geo = buildTaperedTube(pointsWorld, radiusBase, this.radialSegments, taperTail);
    this.mesh.geometry.dispose();
    this.mesh.geometry = geo;
  }
}
