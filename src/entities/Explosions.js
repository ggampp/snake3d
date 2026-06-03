import * as THREE from 'three';

/**
 * A small pool of particle bursts used when an enemy worm is destroyed. Each
 * burst is a THREE.Points cloud whose particles fly outward and fade. Uses a
 * fixed pool so there are no per-frame allocations once warmed up.
 */
const POOL = 6;
const PARTICLES = 30;

export class Explosions {
  constructor() {
    this.group = new THREE.Group();
    this.bursts = [];

    for (let i = 0; i < POOL; i++) {
      const positions = new Float32Array(PARTICLES * 3);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

      const mat = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.9,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
      });

      const points = new THREE.Points(geo, mat);
      points.frustumCulled = false;
      points.visible = false;
      this.group.add(points);

      this.bursts.push({
        points,
        geo,
        mat,
        positions,
        velocities: new Float32Array(PARTICLES * 3),
        age: 0,
        life: 0,
        active: false,
      });
    }
  }

  /** Fire a burst at a world position, tinted to `colorHex`. */
  trigger(worldPos, colorHex = 0xff5a7a) {
    const b = this.bursts.find((x) => !x.active) || this.bursts[0];
    b.active = true;
    b.age = 0;
    b.life = 0.7 + Math.random() * 0.2;
    b.mat.color.setHex(colorHex);
    b.mat.opacity = 1;
    b.points.visible = true;

    for (let i = 0; i < PARTICLES; i++) {
      const i3 = i * 3;
      b.positions[i3] = worldPos.x;
      b.positions[i3 + 1] = worldPos.y;
      b.positions[i3 + 2] = worldPos.z;
      // Random outward direction
      const dir = new THREE.Vector3(
        Math.random() * 2 - 1,
        Math.random() * 2 - 1,
        Math.random() * 2 - 1
      ).normalize();
      const speed = 6 + Math.random() * 10;
      b.velocities[i3] = dir.x * speed;
      b.velocities[i3 + 1] = dir.y * speed;
      b.velocities[i3 + 2] = dir.z * speed;
    }
    b.geo.attributes.position.needsUpdate = true;
  }

  update(dt) {
    for (const b of this.bursts) {
      if (!b.active) continue;
      b.age += dt;
      const k = b.age / b.life;
      if (k >= 1) {
        b.active = false;
        b.points.visible = false;
        b.mat.opacity = 0;
        continue;
      }
      // Move + decelerate, shrink and fade
      const drag = Math.max(0, 1 - dt * 2.5);
      for (let i = 0; i < PARTICLES; i++) {
        const i3 = i * 3;
        b.velocities[i3] *= drag;
        b.velocities[i3 + 1] *= drag;
        b.velocities[i3 + 2] *= drag;
        b.positions[i3] += b.velocities[i3] * dt;
        b.positions[i3 + 1] += b.velocities[i3 + 1] * dt;
        b.positions[i3 + 2] += b.velocities[i3 + 2] * dt;
      }
      b.geo.attributes.position.needsUpdate = true;
      b.mat.opacity = 1 - k;
      b.mat.size = 0.9 * (1 - k * 0.6);
    }
  }
}
