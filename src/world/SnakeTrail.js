import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { arcDistance } from '../core/SphereMath.js';

const _Z = new THREE.Vector3(0, 0, 1);

/**
 * Surface marks left where the snake passes — a per-planet "trail":
 *
 *   style 'press'  — flattened/disturbed ground decals that darken the surface
 *                    (multiply blending) and slowly fade: dust tracks on rocky
 *                    worlds, a cooled-crust line on lava, a carved groove on ice.
 *   style 'ripple' — expanding additive rings, for the water planet's wake.
 *
 * Implemented as a ring buffer of instanced flat decals hugging the sphere.
 * Multiply decals fade by lerping the instance color back to white; additive
 * ones by lerping to black — no custom shaders needed, and the whole trail is
 * a single draw call.
 */
export class SnakeTrail {
  constructor(radius, cfg = {}, count = 768) {
    this.radius = radius;
    this.style = cfg.style || 'press';
    this.color = new THREE.Color(cfg.color ?? 0x8a7a5a);
    this.life = cfg.life ?? 6;
    this.count = count;

    const ripple = this.style === 'ripple';
    // Decals lie in the XY plane facing +Z, later oriented along the normal.
    const geo = ripple
      ? new THREE.RingGeometry(0.55, 0.9, 24)
      : new THREE.CircleGeometry(0.9, 18);

    // Node-based basic material so the trail participates in the bloom MRT
    // pass on the emissive channel (soft glow when ripples are additive).
    const mat = new MeshBasicNodeMaterial({
      color: 0xffffff,
      blending: ripple ? THREE.AdditiveBlending : THREE.MultiplyBlending,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    if (ripple) {
      // Ripples get a small emissive contribution so the bloom pass picks them up.
      mat.emissive = new THREE.Color(cfg.color ?? 0x88ddff);
      mat.emissiveIntensity = 0.6;
    }

    this.mesh = new THREE.InstancedMesh(geo, mat, count);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1; // after the planet surface

    this._neutral = new THREE.Color(ripple ? 0x000000 : 0xffffff);
    this._ages = new Float32Array(count);
    this._sizes = new Float32Array(count);
    this._units = new Float32Array(count * 3); // surface point of each decal
    this._head = 0;
    this._lastSpawn = null;

    this._tmp = {
      m: new THREE.Matrix4(),
      p: new THREE.Vector3(),
      n: new THREE.Vector3(),
      q: new THREE.Quaternion(),
      spin: new THREE.Quaternion(),
      s: new THREE.Vector3(),
      c: new THREE.Color(),
    };

    this.reset();
  }

  /** Clear every decal (new run / world rebuild). */
  reset() {
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < this.count; i++) {
      this._ages[i] = Infinity;
      this.mesh.setMatrixAt(i, zero);
      this.mesh.setColorAt(i, this._neutral);
    }
    this._head = 0;
    this._lastSpawn = null;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  /**
   * Age/fade existing marks and stamp a new one when the head has moved far
   * enough. `grounded` should be false mid-jump so airborne stretches leave
   * no marks.
   */
  update(dt, headUnit, thickness, grounded = true) {
    const { m, p, n, q, spin, s, c } = this._tmp;
    let dirty = false;

    // Fade pass.
    for (let i = 0; i < this.count; i++) {
      const age = this._ages[i];
      if (age === Infinity) continue;
      const next = age + dt;
      this._ages[i] = next;
      const t = next / this.life;
      if (t >= 1) {
        this._ages[i] = Infinity;
        m.makeScale(0, 0, 0);
        this.mesh.setMatrixAt(i, m);
        this.mesh.setColorAt(i, this._neutral);
        dirty = true;
        continue;
      }

      if (this.style === 'ripple') {
        // Ring expands as it fades out.
        const k = this._sizes[i] * (0.7 + t * 2.6);
        this._composeAt(i, k, m, p, n, q, spin, s);
        this.mesh.setMatrixAt(i, m);
        const str = Math.pow(1 - t, 1.6) * 0.85;
        c.copy(this.color).multiplyScalar(str);
        this.mesh.setColorAt(i, c);
      } else {
        // Quick stamp-in, then a slow fade back to the untouched surface.
        const str = Math.min(1, next / 0.12) * (1 - t);
        c.copy(this._neutral).lerp(this.color, str);
        this.mesh.setColorAt(i, c);
      }
      dirty = true;
    }

    // Spawn pass. Pressed tracks overlap heavily so they read as one
    // continuous line; ripples stay spaced-out rings.
    if (grounded && headUnit) {
      const gap = this.style === 'ripple' ? 0.9 : 0.4;
      const spacing = (thickness * gap) / this.radius; // radians between stamps
      if (!this._lastSpawn) {
        this._lastSpawn = headUnit.clone();
      } else if (arcDistance(this._lastSpawn, headUnit) > spacing) {
        this._lastSpawn.copy(headUnit);
        this._stamp(headUnit, thickness);
        dirty = true;
      }
    }

    if (dirty) {
      this.mesh.instanceMatrix.needsUpdate = true;
      if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    }
  }

  _stamp(unit, thickness) {
    const i = this._head;
    this._head = (this._head + 1) % this.count;

    this._units[i * 3] = unit.x;
    this._units[i * 3 + 1] = unit.y;
    this._units[i * 3 + 2] = unit.z;
    this._ages[i] = 0;
    // Slightly wider than the body so the track peeks out as the snake passes.
    this._sizes[i] = thickness * (1.25 + Math.random() * 0.25);

    const { m, p, n, q, spin, s } = this._tmp;
    this._composeAt(i, this._sizes[i], m, p, n, q, spin, s, true);
    this.mesh.setMatrixAt(i, m);
    this.mesh.setColorAt(i, this.style === 'ripple' ? this._tmp.c.copy(this.color) : this._neutral);
  }

  _composeAt(i, size, m, p, n, q, spin, s, randomSpin = false) {
    n.set(this._units[i * 3], this._units[i * 3 + 1], this._units[i * 3 + 2]);
    // Sit just above the surface; polygonOffset removes any residual z-fight.
    p.copy(n).multiplyScalar(this.radius + 0.06);
    q.setFromUnitVectors(_Z, n);
    if (randomSpin) {
      spin.setFromAxisAngle(n, Math.random() * Math.PI * 2);
      q.premultiply(spin);
      this._spinCache = this._spinCache || new Float32Array(this.count * 4);
      this._spinCache[i * 4] = q.x;
      this._spinCache[i * 4 + 1] = q.y;
      this._spinCache[i * 4 + 2] = q.z;
      this._spinCache[i * 4 + 3] = q.w;
    } else if (this._spinCache) {
      q.set(
        this._spinCache[i * 4], this._spinCache[i * 4 + 1],
        this._spinCache[i * 4 + 2], this._spinCache[i * 4 + 3]
      );
    }
    s.setScalar(size);
    m.compose(p, q, s);
  }
}
