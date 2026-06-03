import * as THREE from 'three';
import { randomUnit, arcDistance } from '../core/SphereMath.js';

/**
 * A single glowing food orb that sits on the planet surface, pulses, and
 * respawns elsewhere when eaten. Carries a small point light for local glow.
 */
export class Food {
  constructor(radius) {
    this.radius = radius;
    this.group = new THREE.Group();

    const geo = new THREE.SphereGeometry(0.5, 20, 20);
    this.mat = new THREE.MeshStandardMaterial({
      color: 0xffc14d,
      emissive: 0xffa01e,
      emissiveIntensity: 2.2,
      roughness: 0.3,
      metalness: 0.0,
    });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.group.add(this.mesh);

    this.light = new THREE.PointLight(0xffb347, 6, 12, 2);
    this.group.add(this.light);

    this.unit = new THREE.Vector3();
    this._t = 0;
    this.respawn();
  }

  respawn(avoid = null, minAngle = 0.4) {
    // Find a spot not too close to `avoid` (the snake head) if provided.
    for (let i = 0; i < 12; i++) {
      randomUnit(this.unit);
      if (!avoid || arcDistance(this.unit, avoid) > minAngle) break;
    }
    const p = this.unit.clone().multiplyScalar(this.radius * 1.02);
    this.group.position.copy(p);
  }

  update(dt) {
    this._t += dt;
    const pulse = 1 + Math.sin(this._t * 4) * 0.12;
    this.mesh.scale.setScalar(pulse);
    this.mesh.rotation.y += dt * 1.5;
    this.mat.emissiveIntensity = 2.0 + Math.sin(this._t * 4) * 0.5;
    this.light.intensity = 5 + Math.sin(this._t * 4) * 2;
  }

  /** True if the head (unit vector) is close enough to eat this orb. */
  isEatenBy(headUnit, eatAngle) {
    return arcDistance(headUnit, this.unit) < eatAngle;
  }
}
