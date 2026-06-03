import * as THREE from 'three';
import { arcDistance } from '../core/SphereMath.js';
import { Crawler } from './Crawler.js';

/**
 * The player snake: a continuous, slithering tube crawling on the planet, with
 * a brighter head, eyes, growth on eating, self-collision, and three abilities:
 *   - shield  : brief invincibility (blue bubble)
 *   - turbo   : brief speed boost (hotter glow)
 *   - jump    : hop off the surface, passing over hazards (Space)
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
      waveAmp: 0.32,
      waveFreq: 0.55,
      waveSpeed: 7,
      bodyMaterial: bodyMat,
      headMaterial: headMat,
    });

    this.baseSpeed = this.speed;
    this._baseLift = this.surfaceLift;
    this._bodyEmissive = bodyMat.emissiveIntensity;
    this._headEmissive = headMat.emissiveIntensity;

    this.alive = true;
    this.shield = false;
    this.turbo = false;
    this._jumpT = 0;
    this._jumpCooldown = 0;
    this.jumpDuration = 0.62;
    this.jumpHeight = 2.7;

    this._addEyes();
    this._addShield();
  }

  _addEyes() {
    const eyeGeo = new THREE.SphereGeometry(0.16, 12, 12);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x041414, roughness: 0.35 });
    this.eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    this.eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    this.eyeL.position.set(-0.42, 0.34, 0.72);
    this.eyeR.position.set(0.42, 0.34, 0.72);
    this.headMesh.add(this.eyeL, this.eyeR);
  }

  _addShield() {
    const geo = new THREE.SphereGeometry(1, 20, 20);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x66ccff,
      emissive: 0x3aa0ff,
      emissiveIntensity: 1.2,
      transparent: true,
      opacity: 0.28,
      roughness: 0.1,
      metalness: 0.0,
      depthWrite: false,
    });
    this.shieldMesh = new THREE.Mesh(geo, mat);
    this.shieldMesh.visible = false;
    this.group.add(this.shieldMesh);
  }

  reset() {
    this.alive = true;
    this.speed = this.baseSpeed;
    this.segmentCount = 14;
    this.shield = false;
    this.turbo = false;
    this._jumpT = 0;
    this._jumpCooldown = 0;
    this.surfaceLift = this._baseLift;
    this.setTurbo(false);
    this.setShield(false);
    this.resetPose();
  }

  get isJumping() {
    return this._jumpT > 0;
  }

  /** Invincible to enemies + self while shielded or mid-jump. */
  get invincible() {
    return this.shield || this.isJumping;
  }

  jump(onJump) {
    if (!this.alive || this.isJumping || this._jumpCooldown > 0) return;
    this._jumpT = this.jumpDuration;
    this._jumpCooldown = this.jumpDuration + 0.25;
    if (onJump) onJump();
  }

  setShield(on) {
    this.shield = on;
    if (this.shieldMesh) this.shieldMesh.visible = on;
  }

  setTurbo(on) {
    this.turbo = on;
    this.bodyMat.emissiveIntensity = on ? this._bodyEmissive * 1.8 : this._bodyEmissive;
    this.headMat.emissiveIntensity = on ? this._headEmissive * 1.6 : this._headEmissive;
  }

  update(dt, steer) {
    if (!this.alive) return;

    if (this._jumpCooldown > 0) this._jumpCooldown -= dt;

    // Parabolic hop: lift the whole body off the surface and back down.
    if (this._jumpT > 0) {
      this._jumpT = Math.max(0, this._jumpT - dt);
      const progress = 1 - this._jumpT / this.jumpDuration;
      this.surfaceLift = this._baseLift + this.jumpHeight * Math.sin(Math.PI * progress);
    } else {
      this.surfaceLift = this._baseLift;
    }

    this.step(dt, steer);
    this._placeShield();
  }

  _placeShield() {
    if (!this.shieldMesh || !this.shieldMesh.visible) return;
    const lift = this.radius + this.surfaceLift;
    this.shieldMesh.position.copy(this.position).multiplyScalar(lift);
    const t = performance.now() * 0.005;
    this.shieldMesh.scale.setScalar(this.thickness * 2.1 * (1 + Math.sin(t) * 0.06));
  }

  setDifficulty(score) {
    const base = this.baseSpeed + Math.min(score * 0.006, 0.6);
    this.speed = base * (this.turbo ? 1.85 : 1);
  }

  grow(amount = 2) {
    this.segmentCount += Math.max(1, Math.round(amount));
  }

  /** Self-collision: head overlapping a non-adjacent body segment. */
  checkSelfCollision() {
    if (this.invincible) return false;
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
    this.setShield(false);
    this.setTurbo(false);
  }
}
