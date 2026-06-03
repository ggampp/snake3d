import * as THREE from 'three';
import { randomUnit, surfaceOrientation, anyTangent } from '../core/SphereMath.js';

/**
 * Instanced grass tufts on the planet. Coverage is patchy — driven by a low-
 * frequency hash so continents of grass alternate with bare dirt/rock, matching
 * the look of the reference image. Blade height is kept short (≤ 0.6 units)
 * so the snake body (surfaceLift ≈ 1 unit) always sits cleanly above.
 */
export class Grass {
  constructor(radius, count = 1800) {
    this.radius = radius;

    // Short, slightly wider blade for better readability at distance
    const blade = new THREE.ConeGeometry(0.055, 0.46, 4, 1, true);
    blade.translate(0, 0.23, 0); // pivot at base

    const mat = new THREE.MeshStandardMaterial({
      color: 0x4b7a1e,
      roughness: 1.0,
      metalness: 0.0,
      side: THREE.DoubleSide,
      flatShading: true,
    });

    this.mesh = new THREE.InstancedMesh(blade, mat, count);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const pos = new THREE.Vector3();
    const heading = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const m = new THREE.Matrix4();
    const golden = Math.PI * (3 - Math.sqrt(5));

    let placed = 0;
    const attempts = count * 4;

    for (let i = 0; i < attempts && placed < count; i++) {
      // Fibonacci sphere point
      const y = 1 - (i / (attempts - 1)) * 2;
      const r = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = golden * i;
      pos.set(Math.cos(theta) * r, y, Math.sin(theta) * r);
      // small jitter
      pos.x += (Math.random() - 0.5) * 0.04;
      pos.y += (Math.random() - 0.5) * 0.04;
      pos.z += (Math.random() - 0.5) * 0.04;
      pos.normalize();

      // Patchy coverage: skip positions where a low-freq hash says "bare"
      if (!_grassCoverage(pos)) continue;

      anyTangent(pos, heading);
      heading.applyAxisAngle(pos, Math.random() * Math.PI * 2).normalize();
      surfaceOrientation(pos, heading, quat);

      const s = 0.65 + Math.random() * 0.7;
      scale.set(s, s * (0.75 + Math.random() * 0.5), s);

      pos.multiplyScalar(radius);
      m.compose(pos, quat, scale);
      this.mesh.setMatrixAt(placed, m);
      placed++;
    }

    // Zero-scale unused slots so they don't render
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = placed; i < count; i++) this.mesh.setMatrixAt(i, zero);

    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.frustumCulled = false;
  }
}

/** Simple hash-based noise: returns true if this surface point should have grass. */
function _grassCoverage(unit) {
  // Low-frequency smooth noise by hashing grid cells of the unit sphere
  const scale = 2.8;
  const x = unit.x * scale;
  const y = unit.y * scale;
  const z = unit.z * scale;

  // Two overlapping sine waves give organic-looking continents
  const v =
    0.5 +
    0.3 * Math.sin(x * 1.7 + z * 0.9) * Math.cos(y * 1.3) +
    0.2 * Math.sin(x * 0.8 - y * 1.6 + z * 1.1);

  // ~65% of the planet has grass
  return v > 0.35;
}
