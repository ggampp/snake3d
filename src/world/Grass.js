import * as THREE from 'three';
import { surfaceOrientation, anyTangent } from '../core/SphereMath.js';

/**
 * Instanced grass tufts on the planet. Coverage is patchy — driven by a low-
 * frequency hash so continents of grass alternate with bare dirt/rock.
 *
 * Blades dynamically tilt and yellow when the snake passes over them, then
 * slowly rise back up — leaving a visible crop-circle trail for ~5 seconds.
 */
export class Grass {
  constructor(radius, count = 1800, opts = {}) {
    this.radius = radius;
    const grassColorHex = opts.color ?? 0x4b7a1e;
    const coverage = opts.coverage ?? 0.65;

    // Taller blades so the flattening effect is clearly visible
    const blade = new THREE.ConeGeometry(0.06, 0.55, 4, 1, true);
    blade.translate(0, 0.275, 0); // pivot at base so rotation tilts tip, not base

    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff, // per-instance color multiplies this
      roughness: 1.0,
      metalness: 0.0,
      side: THREE.DoubleSide,
      flatShading: true,
    });

    this.mesh = new THREE.InstancedMesh(blade, mat, count);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    // Per-blade state
    this._count = 0;
    this._bladeUnit  = new Float32Array(count * 3); // surface normal (unit sphere pos)
    this._bladePos   = new Float32Array(count * 3); // world base position
    this._bladeQuat  = new Float32Array(count * 4); // upright orientation
    this._bladeScale = new Float32Array(count * 3); // per-blade scale
    this._flatness   = new Float32Array(count);     // 0=upright … 1=flat
    this._stayTime   = new Float32Array(count);     // hold-flat timer (seconds)
    this._tiltDir    = new Float32Array(count * 3); // world tangent: which way to tilt

    this._baseColor    = new THREE.Color(grassColorHex);
    this._crushedColor = new THREE.Color(0x8f7e2a); // dried / yellowed

    const pos     = new THREE.Vector3();
    const heading = new THREE.Vector3();
    const quat    = new THREE.Quaternion();
    const scale   = new THREE.Vector3();
    const m       = new THREE.Matrix4();
    const golden  = Math.PI * (3 - Math.sqrt(5));

    let placed = 0;
    const attempts = count * 4;

    for (let i = 0; i < attempts && placed < count; i++) {
      const y = 1 - (i / (attempts - 1)) * 2;
      const r = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = golden * i;
      pos.set(Math.cos(theta) * r, y, Math.sin(theta) * r);
      pos.x += (Math.random() - 0.5) * 0.04;
      pos.y += (Math.random() - 0.5) * 0.04;
      pos.z += (Math.random() - 0.5) * 0.04;
      pos.normalize();

      if (!_grassCoverage(pos, coverage)) continue;

      // Store unit normal before scaling to world space
      this._bladeUnit[placed * 3]     = pos.x;
      this._bladeUnit[placed * 3 + 1] = pos.y;
      this._bladeUnit[placed * 3 + 2] = pos.z;

      anyTangent(pos, heading);
      heading.applyAxisAngle(pos, Math.random() * Math.PI * 2).normalize();
      surfaceOrientation(pos, heading, quat);

      const s = 0.65 + Math.random() * 0.7;
      scale.set(s, s * (0.75 + Math.random() * 0.5), s);

      this._bladeQuat[placed * 4]     = quat.x;
      this._bladeQuat[placed * 4 + 1] = quat.y;
      this._bladeQuat[placed * 4 + 2] = quat.z;
      this._bladeQuat[placed * 4 + 3] = quat.w;
      this._bladeScale[placed * 3]     = scale.x;
      this._bladeScale[placed * 3 + 1] = scale.y;
      this._bladeScale[placed * 3 + 2] = scale.z;

      pos.multiplyScalar(radius);

      this._bladePos[placed * 3]     = pos.x;
      this._bladePos[placed * 3 + 1] = pos.y;
      this._bladePos[placed * 3 + 2] = pos.z;

      m.compose(pos, quat, scale);
      this.mesh.setMatrixAt(placed, m);
      this.mesh.setColorAt(placed, this._baseColor);

      placed++;
    }

    this._count = placed;

    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = placed; i < count; i++) this.mesh.setMatrixAt(i, zero);

    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.mesh.frustumCulled = false;

    // Reusable temp objects — avoids per-frame allocations
    this._tmp = {
      m:   new THREE.Matrix4(),
      pos: new THREE.Vector3(),
      q:   new THREE.Quaternion(),
      sc:  new THREE.Vector3(),
      ta:  new THREE.Vector3(),
      tq:  new THREE.Quaternion(),
      fq:  new THREE.Quaternion(),
      col: new THREE.Color(),
    };
  }

  /**
   * Call every frame while playing. Flattens blades under the snake body and
   * lets them slowly recover, leaving a crop-circle trail in the grass.
   *
   * @param {number}           dt            - Delta time (seconds)
   * @param {THREE.Vector3[]}  segments      - Snake body segments (unit vectors)
   * @param {THREE.Vector3}    heading       - Snake head direction (unit tangent)
   * @param {number}           snakeThickness - World-space radius of snake body
   */
  update(dt, segments, heading, snakeThickness) {
    if (!segments || segments.length === 0) return;

    const STAY_FLAT = 4.0;   // seconds blade stays flat before recovery begins
    const RISE_RATE = 0.35;  // flatness units per second during recovery (~3 s)
    const dotMin    = Math.cos((snakeThickness * 1.3) / this.radius);
    const maxSeg    = Math.min(segments.length, 25);

    const { m, pos, q, sc, ta, tq, fq, col } = this._tmp;
    let anyChanged = false;

    for (let i = 0; i < this._count; i++) {
      const wasCrushed = this._flatness[i] > 0.001;

      // --- Recovery ---
      if (this._stayTime[i] > 0) {
        this._stayTime[i] -= dt;
      } else if (this._flatness[i] > 0) {
        this._flatness[i] = Math.max(0, this._flatness[i] - RISE_RATE * dt);
        anyChanged = true;
      }

      // --- Crush check: dot-product arc test against each segment ---
      const ux = this._bladeUnit[i * 3];
      const uy = this._bladeUnit[i * 3 + 1];
      const uz = this._bladeUnit[i * 3 + 2];

      let justCrushed = false;
      for (let j = 0; j < maxSeg; j++) {
        const seg = segments[j];
        if (ux * seg.x + uy * seg.y + uz * seg.z > dotMin) {
          // First crush: record the tilt direction (heading projected to tangent plane)
          if (this._flatness[i] < 0.5) {
            const hd = heading.x * ux + heading.y * uy + heading.z * uz;
            const hx = heading.x - hd * ux;
            const hy = heading.y - hd * uy;
            const hz = heading.z - hd * uz;
            const hl = Math.sqrt(hx * hx + hy * hy + hz * hz);
            if (hl > 0.001) {
              this._tiltDir[i * 3]     = hx / hl;
              this._tiltDir[i * 3 + 1] = hy / hl;
              this._tiltDir[i * 3 + 2] = hz / hl;
            }
          }
          this._flatness[i] = 1.0;
          this._stayTime[i] = STAY_FLAT;
          justCrushed = true;
          anyChanged = true;
          break;
        }
      }

      // --- Recompose matrix & color whenever flatness is non-zero ---
      if (wasCrushed || justCrushed || this._flatness[i] > 0.001) {
        const f = this._flatness[i];

        pos.set(this._bladePos[i * 3], this._bladePos[i * 3 + 1], this._bladePos[i * 3 + 2]);
        q.set(
          this._bladeQuat[i * 4], this._bladeQuat[i * 4 + 1],
          this._bladeQuat[i * 4 + 2], this._bladeQuat[i * 4 + 3]
        );
        sc.set(this._bladeScale[i * 3], this._bladeScale[i * 3 + 1], this._bladeScale[i * 3 + 2]);

        if (f > 0.001) {
          const tx = this._tiltDir[i * 3];
          const ty = this._tiltDir[i * 3 + 1];
          const tz = this._tiltDir[i * 3 + 2];
          // tiltAxis = surfaceNormal × tiltDir (right-hand rule → correct tilt sense)
          ta.set(uy * tz - uz * ty, uz * tx - ux * tz, ux * ty - uy * tx);
          const tal = ta.length();
          if (tal > 0.01) {
            ta.divideScalar(tal);
            tq.setFromAxisAngle(ta, f * Math.PI * 0.489); // up to ~88° at f=1
            fq.multiplyQuaternions(tq, q);
          } else {
            fq.copy(q);
          }
        } else {
          fq.copy(q);
        }

        m.compose(pos, fq, sc);
        this.mesh.setMatrixAt(i, m);

        // Blade yellows as it flattens, greens again as it recovers
        col.lerpColors(this._baseColor, this._crushedColor, f);
        this.mesh.setColorAt(i, col);
      }
    }

    if (anyChanged) {
      this.mesh.instanceMatrix.needsUpdate = true;
      if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    }
  }
}

function _grassCoverage(unit, coverage = 0.65) {
  const scale = 2.8;
  const x = unit.x * scale;
  const y = unit.y * scale;
  const z = unit.z * scale;
  const v =
    0.5 +
    0.3 * Math.sin(x * 1.7 + z * 0.9) * Math.cos(y * 1.3) +
    0.2 * Math.sin(x * 0.8 - y * 1.6 + z * 1.1);
  const threshold = 1 - Math.max(0, Math.min(1, coverage));
  return v > threshold;
}
