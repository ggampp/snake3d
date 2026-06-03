import * as THREE from 'three';
import {
  advance,
  turn,
  reorthonormalize,
  arcDistance,
  randomUnit,
  anyTangent,
  slerpUnit,
} from '../core/SphereMath.js';
import { TubeBody } from './TubeBody.js';

/**
 * Base class for anything that crawls along the planet surface as a continuous
 * body: a head (position + heading on the unit sphere) trailing a path that is
 * resampled at fixed arc spacing into body segments, rendered as a smooth tube.
 *
 * The head is an ellipsoidal mesh wider at the back than at the snout, giving a
 * proper snake silhouette. Subclasses add steering (player vs. AI) and extras.
 */
export class Crawler {
  constructor(radius, opts = {}) {
    this.radius = radius;
    this.speed = opts.speed ?? 0.6;
    this.turnRate = opts.turnRate ?? 1.9;
    this.segmentSpacing = opts.segmentSpacing ?? 0.045;
    this.segmentCount = opts.segmentCount ?? 12;
    this.thickness = opts.thickness ?? 0.55;
    this.taperTail = opts.taperTail ?? 0.25;
    // Lift above planet surface — must clear the tallest grass blade (~0.9 units)
    this.surfaceLift = opts.surfaceLift ?? Math.max(this.thickness * 0.85, 1.0);

    // Lateral slither wave
    this.waveAmp = opts.waveAmp ?? 0;
    this.waveFreq = opts.waveFreq ?? 0.5;
    this.waveSpeed = opts.waveSpeed ?? 6;
    this._wavePhase = Math.random() * Math.PI * 2;

    this.group = new THREE.Group();
    this.segments = [];

    this.bodyMat =
      opts.bodyMaterial ||
      new THREE.MeshStandardMaterial({
        color: 0x2fd6c4,
        emissive: 0x18b8a8,
        emissiveIntensity: 1.3,
        roughness: 0.3,
        metalness: 0.0,
      });

    this.body = new TubeBody(this.bodyMat, opts.radialSegments ?? 12);
    this.group.add(this.body.mesh);

    // Snake head: flattened ellipsoid — wider laterally, shorter vertically,
    // slightly elongated forward so it reads as a real head (not a bead).
    const headGeo = new THREE.SphereGeometry(1, 22, 16);
    this.headMat = opts.headMaterial || this.bodyMat.clone();
    this.headMesh = new THREE.Mesh(headGeo, this.headMat);
    // x=lateral, y=vertical(flat), z=forward length
    this.headMesh.scale.set(1.15, 0.72, 1.4);
    this.group.add(this.headMesh);

    this.resetPose();
  }

  resetPose(startUnit = null) {
    this.position = startUnit ? startUnit.clone().normalize() : randomUnit(new THREE.Vector3());
    this.heading = anyTangent(this.position, new THREE.Vector3());
    reorthonormalize(this.position, this.heading);

    this.path = [];
    const acc = this.position.clone();
    const accH = this.heading.clone();
    this.path.push(acc.clone());
    while (this.path.length < this.segmentCount + 20) {
      advance(acc, accH, -this.segmentSpacing);
      this.path.unshift(acc.clone());
    }
    this._layout();
    this._render();
  }

  step(dt, steer) {
    this._wavePhase += dt * this.waveSpeed;
    if (steer !== 0) turn(this.position, this.heading, steer * this.turnRate * dt);
    advance(this.position, this.heading, this.speed * dt);

    this.path.push(this.position.clone());
    const maxPath =
      (this.segmentCount + 30) *
        Math.ceil(this.segmentSpacing / (this.speed * dt + 1e-5)) +
      200;
    if (this.path.length > maxPath) this.path.splice(0, this.path.length - maxPath);

    this._layout();
    this._render();
  }

  _layout() {
    const segs = [this.position.clone()];
    let target = this.segmentSpacing;
    let traveled = 0;
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();

    for (let i = this.path.length - 1; i > 0 && segs.length < this.segmentCount; i--) {
      a.copy(this.path[i]);
      b.copy(this.path[i - 1]);
      const d = arcDistance(a, b);
      if (d < 1e-7) continue;
      while (traveled + d >= target && segs.length < this.segmentCount) {
        const t = (target - traveled) / d;
        segs.push(slerpUnit(a, b, t));
        target += this.segmentSpacing;
      }
      traveled += d;
    }
    while (segs.length < this.segmentCount) segs.push(this.path[0].clone());
    this.segments = segs;
  }

  _render() {
    const lift = this.radius + this.surfaceLift;
    const pts = this.segments.map((u) => u.clone().multiplyScalar(lift));

    // Lateral slither wave — skip if no amplitude
    if (this.waveAmp > 0 && pts.length > 2) {
      const n = pts.length;
      const dir = new THREE.Vector3();
      const side = new THREE.Vector3();
      for (let i = 1; i < n; i++) {
        dir.copy(pts[i - 1]).sub(pts[i]).normalize();
        side.crossVectors(this.segments[i], dir).normalize();
        const headFade = Math.min(1, i / 3);
        const wave = Math.sin(this._wavePhase - i * this.waveFreq);
        pts[i].addScaledVector(side, this.waveAmp * wave * headFade);
      }
    }

    this.body.update(pts, this.thickness, this.taperTail);

    // Orient head: right=lateral, up=surface-normal, forward=heading
    const headPos = this.position.clone().multiplyScalar(lift);
    this.headMesh.position.copy(headPos);
    // base scale set at construction; just set the uniform thickness multiplier
    const s = this.thickness;
    this.headMesh.scale.set(s * 1.15, s * 0.72, s * 1.4);
    const up = this.position;
    const fwd = this.heading;
    const right = new THREE.Vector3().crossVectors(up, fwd).normalize();
    const mtx = new THREE.Matrix4().makeBasis(right, up.clone(), fwd.clone());
    this.headMesh.quaternion.setFromRotationMatrix(mtx);
  }
}
