import * as THREE from 'three';
import { randomUnit, arcDistance } from '../core/SphereMath.js';

/**
 * A field of fruit pickups scattered on the planet. Each fruit appears, stays
 * available for 20 seconds, then vanishes and later respawns elsewhere. Bigger
 * fruits carry more "energy": eating one grows the snake proportionally to its
 * size and awards proportional score.
 *
 * Uses a FIXED pool of meshes/lights so the light count never changes (avoids
 * MeshStandardMaterial shader recompiles when orbs come and go).
 */
const MAX_ORBS = 12;
const FRUIT_LIFETIME = 20;

const FRUITS = [
  { body: 0xe74336, shade: 0xaa1f1a, leaf: 0x3ba64b }, // apple
  { body: 0xffb22e, shade: 0xd97706, leaf: 0x2f9e44 }, // orange
  { body: 0x8fd34f, shade: 0x4f9a2a, leaf: 0x2f9e44 }, // pear
  { body: 0xd84b8e, shade: 0x9b1b5a, leaf: 0x4caf50 }, // berry
];

export class EnergyField {
  constructor(radius) {
    this.radius = radius;
    this.group = new THREE.Group();
    this.orbs = [];

    const bodyGeo = new THREE.SphereGeometry(1, 18, 18);
    const biteGeo = new THREE.SphereGeometry(0.34, 10, 10);
    const stemGeo = new THREE.CylinderGeometry(0.07, 0.09, 0.45, 8);
    const leafGeo = new THREE.SphereGeometry(0.2, 10, 8);
    for (let i = 0; i < MAX_ORBS; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: 0xe74336,
        emissive: 0x4a0805,
        emissiveIntensity: 0.18,
        roughness: 0.48,
        metalness: 0.0,
      });
      const shadeMat = new THREE.MeshStandardMaterial({
        color: 0xaa1f1a,
        roughness: 0.55,
        metalness: 0.0,
      });
      const stemMat = new THREE.MeshStandardMaterial({ color: 0x6d3f1d, roughness: 0.8 });
      const leafMat = new THREE.MeshStandardMaterial({ color: 0x3ba64b, roughness: 0.7 });
      const mesh = new THREE.Group();
      const body = new THREE.Mesh(bodyGeo, mat);
      const shade = new THREE.Mesh(biteGeo, shadeMat);
      const stem = new THREE.Mesh(stemGeo, stemMat);
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      body.scale.set(1, 0.92, 1);
      shade.position.set(-0.32, 0.2, 0.75);
      shade.scale.set(0.75, 0.5, 0.35);
      stem.position.set(0, 0.95, 0);
      stem.rotation.z = 0.35;
      leaf.position.set(0.28, 1.05, 0);
      leaf.scale.set(1.5, 0.55, 0.8);
      mesh.add(body, shade, stem, leaf);
      const light = new THREE.PointLight(0xff7043, 0, 10, 2);
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
        mat,
        shadeMat,
        leafMat,
      });
    }
    this.reset();
  }

  reset() {
    for (const o of this.orbs) {
      o.active = false;
      o.cooldown = Math.random() * 1.2;
      o.holder.scale.setScalar(0);
      o.light.intensity = 0;
    }
  }

  _applyFruitStyle(orb) {
    const fruit = FRUITS[Math.floor(Math.random() * FRUITS.length)];
    orb.mat.color.setHex(fruit.body);
    orb.mat.emissive.setHex(fruit.shade);
    orb.shadeMat.color.setHex(fruit.shade);
    orb.leafMat.color.setHex(fruit.leaf);
    orb.light.color.setHex(fruit.body);
  }

  _spawn(orb, avoidUnit) {
    for (let i = 0; i < 16; i++) {
      randomUnit(orb.unit);
      if (!avoidUnit || arcDistance(orb.unit, avoidUnit) > 0.45) break;
    }
    this._applyFruitStyle(orb);
    orb.energy = 1 + Math.floor(Math.random() * 3); // 1, 2 or 3
    orb.baseRadius = 0.42 + orb.energy * 0.16;
    orb.age = 0;
    orb.lifetime = FRUIT_LIFETIME;
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
    this._applyFruitStyle(orb);
    orb.energy = Math.max(1, Math.min(3, Math.round(energy)));
    orb.baseRadius = 0.42 + orb.energy * 0.16;
    orb.age = 0;
    orb.lifetime = FRUIT_LIFETIME;
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
          o.holder.scale.setScalar(0);
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

      o.holder.scale.setScalar(r);
      o.mesh.rotation.y += dt * 1.5;
      o.mesh.rotation.x = Math.sin(o.age * 2) * 0.08;
      o.light.intensity = 1.8 * life;
      o.mat.emissiveIntensity = 0.18 + Math.sin(o.age * 5) * 0.04;

      // Expired?
      if (o.age >= o.lifetime) {
        o.active = false;
        o.cooldown = 0.4 + Math.random() * 1.6;
        o.holder.scale.setScalar(0);
        o.light.intensity = 0;
        continue;
      }

      // Eaten? (only while reasonably visible)
      if (life > 0.25 && headUnit && arcDistance(headUnit, o.unit) < this._eatAngle(o, headRadius)) {
        onEat(o.energy * 2, o.energy); // grow proportionally; score = energy
        o.active = false;
        o.cooldown = 0.3 + Math.random() * 1.2;
        o.holder.scale.setScalar(0);
        o.light.intensity = 0;
      }
    }
  }
}
