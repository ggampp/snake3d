import * as THREE from 'three';
import { arcDistance } from '../core/SphereMath.js';
import { Crawler } from './Crawler.js';

/**
 * The player snake: a continuous tube body crawling on the planet, with a
 * brighter head, eyes, growth on eating, and self-collision detection.
 */
export class Snake extends Crawler {
  constructor(radius) {
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x2fd6c4,
      emissive: 0x17c4b2,
      emissiveIntensity: 1.05,
      roughness: 0.22,
      metalness: 0.0,
    });
    const headMat = bodyMat.clone();
    headMat.color = new THREE.Color(0x6cffe9);
    headMat.emissive = new THREE.Color(0x2fe6d2);
    headMat.emissiveIntensity = 1.35;

    super(radius, {
      speed: 0.6,
      turnRate: 1.95,
      segmentSpacing: 0.045,
      segmentCount: 14,
      thickness: 0.6,
      taperTail: 0.18,
      radialSegments: 14,
      bodyMaterial: bodyMat,
      headMaterial: headMat,
    });

    this.baseSpeed = this.speed;
    this.alive = true;
    this._addEyes();
  }

  _addEyes() {
    const eyeGeo = new THREE.SphereGeometry(0.16, 12, 12);
    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0x041414,
      roughness: 0.35,
    });
    this.eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    this.eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    this.eyeL.position.set(-0.42, 0.34, 0.72);
    this.eyeR.position.set(0.42, 0.34, 0.72);
    this.headMesh.add(this.eyeL, this.eyeR);
  }

  reset() {
    this.alive = true;
    this.speed = this.baseSpeed;
    this.segmentCount = 14;
    this.resetPose();
  }

  update(dt, steer) {
    if (!this.alive) return;
    this.step(dt, steer);
  }

  setDifficulty(score) {
    this.speed = this.baseSpeed + Math.min(score * 0.006, 0.6);
  }

  grow(amount = 2) {
    this.segmentCount += Math.max(1, Math.round(amount));
  }

  /** Self-collision: head overlapping a non-adjacent body segment. */
  checkSelfCollision() {
    if (!this.segments || this.segments.length < 9) return false;
    const head = this.position;
    const hitAngle = (this.thickness * 0.8) / this.radius;
    for (let i = 7; i < this.segments.length; i++) {
      if (arcDistance(head, this.segments[i]) < hitAngle) return true;
    }
    return false;
  }

  die() {
    this.alive = false;
  }
}
