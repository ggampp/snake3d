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

/**
 * The snake lives on a unit sphere. The head has a position (unit vector) and
 * heading (unit tangent). A path history of recent head positions is sampled
 * at fixed arc-length spacing to place body segments behind the head, giving
 * smooth following + growth.
 */
export class Snake {
  constructor(radius) {
    this.radius = radius;

    // Tunables (all angular, on the unit sphere).
    this.speed = 0.6; // radians / second of head travel
    this.baseSpeed = 0.6;
    this.turnRate = 1.9; // radians / second of heading change
    this.segmentSpacing = 0.045; // arc-length between segments (unit sphere)
    this.segmentCount = 12; // grows as you eat
    this.thickness = 0.55; // world-space radius of body spheres

    this.group = new THREE.Group();
    this._buildMaterials();
    this._buildHead();

    this.alive = true;
    this.reset();
  }

  _buildMaterials() {
    this.bodyMat = new THREE.MeshStandardMaterial({
      color: 0x2fd6c4,
      emissive: 0x18b8a8,
      emissiveIntensity: 1.4,
      roughness: 0.25,
      metalness: 0.0,
      transparent: true,
      opacity: 0.92,
    });
    this.headMat = this.bodyMat.clone();
    this.headMat.emissiveIntensity = 1.9;
    this.headMat.color = new THREE.Color(0x6cffe9);
  }

  _buildHead() {
    // Body rendered as an InstancedMesh of spheres for cheap, soft tube look.
    this.maxInstances = 600;
    const geo = new THREE.SphereGeometry(1, 16, 16);
    this.bodyMesh = new THREE.InstancedMesh(geo, this.bodyMat, this.maxInstances);
    this.bodyMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.bodyMesh.count = 0;
    this.bodyMesh.frustumCulled = false;
    this.group.add(this.bodyMesh);

    // Distinct head.
    const headGeo = new THREE.SphereGeometry(1, 24, 24);
    this.headMesh = new THREE.Mesh(headGeo, this.headMat);
    this.group.add(this.headMesh);

    // Two glowing eyes.
    const eyeGeo = new THREE.SphereGeometry(0.18, 12, 12);
    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0x041414,
      emissive: 0x000000,
      roughness: 0.4,
    });
    this.eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    this.eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    this.headMesh.add(this.eyeL, this.eyeR);
  }

  reset() {
    this.alive = true;
    this.speed = this.baseSpeed;
    this.segmentCount = 12;

    // Start somewhere random on the sphere.
    this.position = randomUnit(new THREE.Vector3());
    this.heading = anyTangent(this.position, new THREE.Vector3());
    reorthonormalize(this.position, this.heading);

    // Seed the path with the starting point so segments don't snap.
    this.path = [];
    const p = this.position.clone();
    const h = this.heading.clone();
    // Lay an initial straight tail behind the head.
    const needed = this.segmentCount + 20;
    let acc = this.position.clone();
    let accH = this.heading.clone();
    this.path.push(acc.clone());
    let dist = 0;
    while (this.path.length < needed) {
      advance(acc, accH, -this.segmentSpacing); // step backwards
      this.path.unshift(acc.clone());
    }
    void p;
    void h;
    void dist;
  }

  /** Head world position (scaled to planet radius). */
  get worldHead() {
    return this.position.clone().multiplyScalar(this.radius);
  }

  setDifficulty(score) {
    // Speed ramps gently with score.
    this.speed = this.baseSpeed + Math.min(score * 0.008, 0.7);
  }

  grow(amount = 3) {
    this.segmentCount += amount;
  }

  update(dt, steer) {
    if (!this.alive) return;

    // Steer then advance the head along its geodesic.
    if (steer !== 0) turn(this.position, this.heading, steer * this.turnRate * dt);
    advance(this.position, this.heading, this.speed * dt);

    // Append to path; keep it dense enough but bounded.
    this.path.push(this.position.clone());
    const maxPath = (this.segmentCount + 30) * Math.ceil(this.segmentSpacing / (this.speed * dt + 1e-5)) + 200;
    if (this.path.length > maxPath) this.path.splice(0, this.path.length - maxPath);

    this._layoutBody();
    this._orientHead();
  }

  /** Resample the path backward from the head at fixed arc spacing. */
  _layoutBody() {
    const segs = [];
    segs.push(this.position.clone());

    let target = this.segmentSpacing;
    let traveled = 0;
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();

    // Walk the path from newest to oldest accumulating arc length.
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
    // If path too short, pad with the oldest point.
    while (segs.length < this.segmentCount) {
      segs.push(this.path[0].clone());
    }

    this.segments = segs; // unit vectors, [0]=head

    // Render instanced body spheres (skip index 0 = the head mesh).
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    let count = 0;
    for (let i = 1; i < segs.length; i++) {
      p.copy(segs[i]).multiplyScalar(this.radius);
      // Taper the tail.
      const taper = 1 - (i / segs.length) * 0.45;
      s.setScalar(this.thickness * taper);
      m.compose(p, q, s);
      this.bodyMesh.setMatrixAt(count++, m);
    }
    this.bodyMesh.count = Math.min(count, this.maxInstances);
    this.bodyMesh.instanceMatrix.needsUpdate = true;
  }

  _orientHead() {
    const headPos = this.position.clone().multiplyScalar(this.radius);
    this.headMesh.position.copy(headPos);
    this.headMesh.scale.setScalar(this.thickness * 1.15);

    // Orient head: look along heading, up along normal.
    const up = this.position.clone();
    const fwd = this.heading.clone();
    const right = new THREE.Vector3().crossVectors(up, fwd).normalize();
    const mtx = new THREE.Matrix4().makeBasis(right, up, fwd);
    this.headMesh.quaternion.setFromRotationMatrix(mtx);

    // Place eyes (local space of head sphere).
    this.eyeL.position.set(-0.45, 0.35, 0.7);
    this.eyeR.position.set(0.45, 0.35, 0.7);
  }

  /**
   * Self-collision: head overlapping a non-adjacent body segment.
   * Returns true on collision.
   */
  checkSelfCollision() {
    if (!this.segments || this.segments.length < 8) return false;
    const head = this.position;
    // Hit radius in angular terms (~ body thickness over planet radius).
    const hitAngle = (this.thickness * 0.8) / this.radius;
    // Skip the first few segments (they're always near the head).
    for (let i = 6; i < this.segments.length; i++) {
      if (arcDistance(head, this.segments[i]) < hitAngle) return true;
    }
    return false;
  }

  die() {
    this.alive = false;
  }
}
