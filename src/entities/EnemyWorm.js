import * as THREE from 'three';
import { arcDistance, randomUnit } from '../core/SphereMath.js';
import { Crawler } from './Crawler.js';

/**
 * An AI "worm" that wanders the planet on geodesics, changing direction at
 * random intervals. Touching it ends the player's run. Rendered as a smaller,
 * menacing magenta/red tube to read clearly against the teal player snake.
 */
export class EnemyWorm extends Crawler {
  constructor(radius) {
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xff3b6b,
      emissive: 0xd81e54,
      emissiveIntensity: 1.25,
      roughness: 0.35,
      metalness: 0.0,
    });
    const headMat = bodyMat.clone();
    headMat.color = new THREE.Color(0xff7a9c);
    headMat.emissiveIntensity = 1.7;

    super(radius, {
      speed: 0.42 + Math.random() * 0.12,
      turnRate: 1.6,
      segmentSpacing: 0.05,
      segmentCount: 12 + Math.floor(Math.random() * 6),
      thickness: 0.42,
      taperTail: 0.2,
      radialSegments: 10,
      waveAmp: 0.26,
      waveFreq: 0.6,
      waveSpeed: 8,
      bodyMaterial: bodyMat,
      headMaterial: headMat,
    });

    this._addEyes();
    this._turnTimer = 0;
    this._turnDir = 0;
  }

  _addEyes() {
    const eyeGeo = new THREE.SphereGeometry(0.13, 10, 10);
    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0xffe08a,
      emissive: 0xffb020,
      emissiveIntensity: 1.5,
      roughness: 0.4,
    });
    const l = new THREE.Mesh(eyeGeo, eyeMat);
    const r = new THREE.Mesh(eyeGeo, eyeMat);
    l.position.set(-0.4, 0.32, 0.7);
    r.position.set(0.4, 0.32, 0.7);
    this.headMesh.add(l, r);
  }

  /** Respawn far from `avoidUnit` (the player) so it isn't an instant death. */
  reset(avoidUnit = null, minAngle = 1.0) {
    let p = randomUnit(new THREE.Vector3());
    for (let i = 0; i < 16 && avoidUnit; i++) {
      if (arcDistance(p, avoidUnit) > minAngle) break;
      randomUnit(p);
    }
    this.resetPose(p);
    this._turnTimer = 0.5 + Math.random();
    this._turnDir = Math.random() < 0.5 ? -1 : 1;
  }

  update(dt) {
    // Wander: occasionally pick a new gentle turn direction.
    this._turnTimer -= dt;
    if (this._turnTimer <= 0) {
      this._turnDir = (Math.random() - 0.5) * 2;
      this._turnTimer = 0.6 + Math.random() * 1.8;
    }
    this.step(dt, this._turnDir);
  }

  /** True if `headUnit` is close enough to any of this worm's segments. */
  hits(headUnit, extraAngle) {
    const hitAngle = this.thickness / this.radius + extraAngle;
    for (let i = 0; i < this.segments.length; i++) {
      if (arcDistance(headUnit, this.segments[i]) < hitAngle) return true;
    }
    return false;
  }

  /**
   * True if any of this worm's segments touches any of the given unit points.
   * `skip` ignores the first `skip` points (e.g. the player's head region so
   * only body/"middle" hits count). `extraAngle` adds the other body's radius.
   */
  touches(points, extraAngle, skip = 0) {
    const hitAngle = this.thickness / this.radius + extraAngle;
    for (let i = 0; i < this.segments.length; i++) {
      const seg = this.segments[i];
      for (let j = skip; j < points.length; j++) {
        if (arcDistance(seg, points[j]) < hitAngle) return true;
      }
    }
    return false;
  }
}
