import * as THREE from 'three';
import { randomUnit, arcDistance } from '../core/SphereMath.js';

/**
 * A field of glowing yellow energy orbs scattered on the planet. Each orb
 * appears, lives for a few seconds (fading in/out), then vanishes and later
 * respawns elsewhere. Bigger orbs carry more "energy": eating one grows the
 * snake proportionally to its size and awards proportional score.
 *
 * Uses a FIXED pool of meshes/lights so the light count never changes (avoids
 * MeshStandardMaterial shader recompiles when orbs come and go).
 */
const MAX_ORBS = 12;

export class EnergyField {
  constructor(radius) {
    this.radius = radius;
    this.group = new THREE.Group();
    this.orbs = [];

    const geo = new THREE.SphereGeometry(1, 18, 18);
    for (let i = 0; i < MAX_ORBS; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: 0xffe35c,
        emissive: 0xffc21e,
        emissiveIntensity: 2.2,
        roughness: 0.3,
        metalness: 0.0,
      });
      const mesh = new THREE.Mesh(geo, mat);
      const light = new THREE.PointLight(0xffd24d, 0, 14, 2);
      const holder = new THREE.Group();
      holder.add(mesh, light);
      this.group.add(holder);

      this.orbs.push({
        unit: new THREE.Vector3(0, 1, 0),
        energy: 1, // 1..3
        baseRadius: 0.5,
        age: 0,
        lifetime: 0,
        active: false,
        cooldown: Math.random() * 1.5,
        mesh,
        light,
        holder,
      });
    }
    this.reset();
  }

  reset() {
    for (const o of this.orbs) {
      o.active = false;
      o.cooldown = Math.random() * 1.2;
      o.mesh.scale.setScalar(0);
      o.light.intensity = 0;
    }
  }

  _spawn(orb, avoidUnit) {
    for (let i = 0; i < 16; i++) {
      randomUnit(orb.unit);
      if (!avoidUnit || arcDistance(orb.unit, avoidUnit) > 0.45) break;
    }
    orb.energy = 1 + Math.floor(Math.random() * 3); // 1, 2 or 3
    orb.baseRadius = 0.42 + orb.energy * 0.16;
    orb.age = 0;
    orb.lifetime = 7.0 + Math.random() * 5.0; // stay available longer
    orb.active = true;
    orb.holder.position.copy(orb.unit).multiplyScalar(this.radius * 1.02);
  }

  /**
   * Force-spawn an orb at a specific surface point with a given energy. Used to
   * turn a destroyed worm's body into a trail of collectible energy. Reuses an
   * inactive pool slot; returns true if one was available.
   */
  spawnAt(unit, energy = 1) {
    const orb = this.orbs.find((o) => !o.active);
    if (!orb) return false;
    orb.unit.copy(unit).normalize();
    orb.energy = Math.max(1, Math.min(3, Math.round(energy)));
    orb.baseRadius = 0.42 + orb.energy * 0.16;
    orb.age = 0;
    orb.lifetime = 8.0 + Math.random() * 4.0;
    orb.active = true;
    orb.holder.position.copy(orb.unit).multiplyScalar(this.radius * 1.02);
    return true;
  }

  /** Eating radius (angular) for an orb, scaled by its size + snake head. */
  _eatAngle(orb, headRadius) {
    return (orb.baseRadius + headRadius) / this.radius;
  }

  /**
   * @param {number} dt
   * @param {THREE.Vector3} headUnit  player's head (unit vector)
   * @param {number} headRadius       player's head world radius
   * @param {(growth:number, score:number)=>void} onEat
   */
  update(dt, headUnit, headRadius, onEat) {
    for (const o of this.orbs) {
      if (!o.active) {
        o.cooldown -= dt;
        if (o.cooldown <= 0) this._spawn(o, headUnit);
        else {
          o.mesh.scale.setScalar(0);
          o.light.intensity = 0;
          continue;
        }
      }

      o.age += dt;

      // Lifetime fade: ease in over 0.4s, ease out over the final 0.8s.
      const fadeIn = Math.min(1, o.age / 0.4);
      const fadeOut = Math.min(1, (o.lifetime - o.age) / 0.8);
      const life = Math.max(0, Math.min(fadeIn, fadeOut));
      const pulse = 1 + Math.sin(o.age * 5) * 0.12;
      const r = o.baseRadius * life * pulse;

      o.mesh.scale.setScalar(r);
      o.mesh.rotation.y += dt * 1.5;
      o.light.intensity = 5 * life;
      o.mesh.material.emissiveIntensity = 2.0 + Math.sin(o.age * 5) * 0.5;

      // Expired?
      if (o.age >= o.lifetime) {
        o.active = false;
        o.cooldown = 0.4 + Math.random() * 1.6;
        continue;
      }

      // Eaten? (only while reasonably visible)
      if (life > 0.25 && headUnit && arcDistance(headUnit, o.unit) < this._eatAngle(o, headRadius)) {
        onEat(o.energy * 2, o.energy); // grow proportionally; score = energy
        o.active = false;
        o.cooldown = 0.3 + Math.random() * 1.2;
        o.mesh.scale.setScalar(0);
        o.light.intensity = 0;
      }
    }
  }
}
