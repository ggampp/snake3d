import * as THREE from 'three';
import { randomUnit, surfaceOrientation, anyTangent } from '../core/SphereMath.js';

/**
 * Instanced grass tufts scattered across the planet surface using a Fibonacci
 * sphere distribution for even coverage. Each tuft is a small cross of blades.
 */
export class Grass {
  constructor(radius, count = 1400) {
    this.radius = radius;

    // A single blade-ish cone, cheap and reads fine at distance.
    const blade = new THREE.ConeGeometry(0.06, 0.55, 4, 1, true);
    blade.translate(0, 0.27, 0); // base at origin

    const mat = new THREE.MeshStandardMaterial({
      color: 0x4f7a24,
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

    for (let i = 0; i < count; i++) {
      // Fibonacci sphere + jitter.
      const y = 1 - (i / (count - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const theta = golden * i;
      pos.set(Math.cos(theta) * r, y, Math.sin(theta) * r);
      pos.x += (Math.random() - 0.5) * 0.05;
      pos.y += (Math.random() - 0.5) * 0.05;
      pos.z += (Math.random() - 0.5) * 0.05;
      pos.normalize();

      anyTangent(pos, heading);
      // random spin around the normal
      heading.applyAxisAngle(pos, Math.random() * Math.PI * 2).normalize();
      surfaceOrientation(pos, heading, quat);

      const s = 0.7 + Math.random() * 0.8;
      scale.set(s, s * (0.8 + Math.random() * 0.6), s);

      pos.multiplyScalar(radius);
      m.compose(pos, quat, scale);
      this.mesh.setMatrixAt(i, m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.frustumCulled = false;
  }
}
