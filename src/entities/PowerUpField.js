import * as THREE from 'three';
import { randomUnit, arcDistance } from '../core/SphereMath.js';

/**
 * Rare, temporary power-up pickups: a shield (brief invincibility) and a turbo
 * (brief speed boost). Each is a glowing orb wrapped in a spinning ring so the
 * two types read at a glance (blue = shield, orange = turbo). Uses a small
 * fixed pool with constant light count to avoid shader recompiles.
 */
const SLOTS = 2;
const TYPES = {
  shield: { color: 0x66ccff, emissive: 0x2b9cff },
  turbo: { color: 0xff9a3c, emissive: 0xff5a00 },
};

export class PowerUpField {
  constructor(radius) {
    this.radius = radius;
    this.group = new THREE.Group();
    this.slots = [];

    const orbGeo = new THREE.SphereGeometry(0.6, 18, 18);
    const ringGeo = new THREE.TorusGeometry(1.05, 0.13, 10, 30);

    for (let i = 0; i < SLOTS; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: 0x66ccff,
        emissive: 0x2b9cff,
        emissiveIntensity: 2.2,
        roughness: 0.3,
      });
      const ringMat = new THREE.MeshStandardMaterial({
        color: 0x66ccff,
        emissive: 0x2b9cff,
        emissiveIntensity: 2.6,
        roughness: 0.4,
      });
      const mesh = new THREE.Mesh(orbGeo, mat);
      const ring = new THREE.Mesh(ringGeo, ringMat);
      const light = new THREE.PointLight(0x66ccff, 0, 18, 2);
      const holder = new THREE.Group();
      holder.add(mesh, ring, light);
      this.group.add(holder);

      this.slots.push({
        type: 'shield',
        unit: new THREE.Vector3(0, 1, 0),
        age: 0,
        lifetime: 0,
        active: false,
        cooldown: 6 + Math.random() * 8,
        mesh,
        ring,
        light,
        holder,
        mat,
        ringMat,
      });
    }
    this.reset();
  }

  reset() {
    for (const s of this.slots) {
      s.active = false;
      s.cooldown = 5 + Math.random() * 9;
      s.mesh.scale.setScalar(0);
      s.ring.scale.setScalar(0);
      s.light.intensity = 0;
    }
  }

  _spawn(s, avoid) {
    for (let i = 0; i < 16; i++) {
      randomUnit(s.unit);
      if (!avoid || arcDistance(s.unit, avoid) > 0.6) break;
    }
    s.type = Math.random() < 0.5 ? 'shield' : 'turbo';
    const c = TYPES[s.type];
    s.mat.color.setHex(c.color);
    s.mat.emissive.setHex(c.emissive);
    s.ringMat.color.setHex(c.color);
    s.ringMat.emissive.setHex(c.emissive);
    s.light.color.setHex(c.color);
    s.age = 0;
    s.lifetime = 11.0 + Math.random() * 4.0; // stay available longer
    s.active = true;
    s.holder.position.copy(s.unit).multiplyScalar(this.radius * 1.05);
  }

  /**
   * @param {(type:'shield'|'turbo')=>void} onEat
   */
  update(dt, headUnit, headRadius, onEat) {
    for (const s of this.slots) {
      if (!s.active) {
        s.cooldown -= dt;
        if (s.cooldown <= 0) this._spawn(s, headUnit);
        else continue;
      }

      s.age += dt;
      const fadeIn = Math.min(1, s.age / 0.5);
      const fadeOut = Math.min(1, (s.lifetime - s.age) / 1.0);
      const life = Math.max(0, Math.min(fadeIn, fadeOut));
      const pulse = 1 + Math.sin(s.age * 4) * 0.1;

      s.mesh.scale.setScalar(0.6 * life * pulse);
      s.ring.scale.setScalar(1.1 * life);
      s.ring.rotation.x += dt * 1.4;
      s.ring.rotation.y += dt * 2.0;
      s.light.intensity = 6 * life;

      if (s.age >= s.lifetime) {
        s.active = false;
        s.cooldown = 7 + Math.random() * 10;
        s.mesh.scale.setScalar(0);
        s.ring.scale.setScalar(0);
        s.light.intensity = 0;
        continue;
      }

      if (life > 0.3 && headUnit && arcDistance(headUnit, s.unit) < (0.85 + headRadius) / this.radius) {
        onEat(s.type);
        s.active = false;
        s.cooldown = 8 + Math.random() * 10;
        s.mesh.scale.setScalar(0);
        s.ring.scale.setScalar(0);
        s.light.intensity = 0;
      }
    }
  }
}
