import * as THREE from 'three';
import { arcDistance } from '../core/SphereMath.js';
import { Crawler } from './Crawler.js';
import { makeSkinMaterials, getBandColor, SKINS } from './SnakeSkins.js';

/**
 * Player-controlled snake: continuous tube body + head, with:
 *   - Skin presets (cosmic, emerald, coral, blue, cobra)
 *   - Shield (translucent bubble — invincibility for N seconds)
 *   - Turbo (speed boost + hotter glow)
 *   - Jump (parabolic hop over hazards / self — Space)
 *   - Self-collision detection
 */
export class Snake extends Crawler {
  constructor(radius, skinKey = 'cosmic') {
    const { bodyMat, headMat } = makeSkinMaterials(skinKey);

    super(radius, {
      speed: 0.6,
      turnRate: 1.95,
      segmentSpacing: 0.045,
      segmentCount: 14,
      thickness: 0.42,   // slimmer body — smaller relative to the planet
      taperTail: 0.13,   // taper more aggressively — thinner tail vs head
      radialSegments: 16,
      waveAmp: 0.26,
      waveFreq: 0.55,
      waveSpeed: 7,
      headSway: 0.17,    // head yaws with the slither for a lifelike crawl
      bodyMaterial: bodyMat,
      headMaterial: headMat,
    });

    this.skinKey = skinKey;

    // Wire up vertex-color band function if the skin has bands
    const skin = SKINS[skinKey];
    if (skin && skin.bands) {
      this.body.getColor = (t, c) => {
        const bands = skin.bands;
        const phase = (t / skin.bandLength) % bands.length;
        const idx = Math.floor(phase) % bands.length;
        c.setHex(bands[idx]);
      };
    }

    this.baseSpeed = this.speed;
    this._baseLift = this.surfaceLift;
    this._bodyEmissiveBase = bodyMat.emissiveIntensity;
    this._headEmissiveBase = headMat.emissiveIntensity;

    this.alive = true;
    this.shield = false;
    this.turbo = false;
    this._jumpT = 0;
    this._jumpCooldown = 0;
    this.jumpDuration = 0.62;
    this.jumpHeight = 2.7;
    this._bulges = [];
    this._radiusScaleFn = null;

    this._addEyes();
    this._addTongue();
    this._addShield();
  }

  _addEyes() {
    const skin = SKINS[this.skinKey] || SKINS.cosmic;
    // Pale reptile iris with a vertical slit pupil (slither-charts style).
    const eyeGeo = new THREE.SphereGeometry(0.15, 12, 12);
    const eyeMat = new THREE.MeshStandardMaterial({
      color: skin.eye ?? 0xf6e7a2,
      emissive: skin.eye ?? 0xf6e7a2,
      emissiveIntensity: 0.35,
      roughness: 0.25,
      metalness: 0.0,
    });
    const pupilGeo = new THREE.SphereGeometry(0.09, 10, 10);
    const pupilMat = new THREE.MeshStandardMaterial({
      color: skin.pupil ?? 0x120b04,
      roughness: 0.15,
      metalness: 0.1,
    });
    // small glossy catchlight
    const glintGeo = new THREE.SphereGeometry(0.035, 6, 6);
    const glintMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.6 });

    this.eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    this.eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    // position in head-local space (x=lateral, y=up, z=forward)
    this.eyeL.position.set(-0.55, 0.28, 0.75);
    this.eyeR.position.set(0.55, 0.28, 0.75);

    for (const [eye, sideX] of [[this.eyeL, 1], [this.eyeR, -1]]) {
      const pupil = new THREE.Mesh(pupilGeo, pupilMat);
      // flattened into a vertical slit, pushed to the front of the iris
      pupil.scale.set(0.3, 1.0, 0.55);
      pupil.position.set(sideX * 0.05, 0, 0.085);
      eye.add(pupil);
      const glint = new THREE.Mesh(glintGeo, glintMat);
      glint.position.set(sideX * 0.02, 0.07, 0.13);
      eye.add(glint);
    }

    this.headMesh.add(this.eyeL, this.eyeR);
    this._blinkSeed = Math.random() * 10;
  }

  /** Forked tongue that flicks out of the snout every couple of seconds. */
  _addTongue() {
    const skin = SKINS[this.skinKey] || SKINS.cosmic;
    const mat = new THREE.MeshStandardMaterial({
      color: skin.tongue ?? 0xe4573d,
      emissive: skin.tongue ?? 0xe4573d,
      emissiveIntensity: 0.7,
      roughness: 0.4,
    });

    const stemGeo = new THREE.CylinderGeometry(0.05, 0.065, 0.95, 6);
    stemGeo.rotateX(Math.PI / 2);
    stemGeo.translate(0, 0, 0.475); // grows forward from the mouth
    const stem = new THREE.Mesh(stemGeo, mat);

    const forkGeo = new THREE.CylinderGeometry(0.028, 0.045, 0.42, 5);
    forkGeo.rotateX(Math.PI / 2);
    forkGeo.translate(0, 0, 0.21);
    const forkL = new THREE.Mesh(forkGeo, mat);
    const forkR = new THREE.Mesh(forkGeo, mat);
    forkL.position.set(0, 0, 0.95);
    forkR.position.set(0, 0, 0.95);
    forkL.rotation.y = 0.45;
    forkR.rotation.y = -0.45;

    this.tongue = new THREE.Group();
    this.tongue.add(stem, forkL, forkR);
    // snout in head-local space (z = forward, slightly below the eyes)
    this.tongue.position.set(0, -0.1, 1.05);
    this.tongue.visible = false;
    this._tongueSeed = Math.random() * 10;
    this.headMesh.add(this.tongue);
  }

  /** Tongue flick + blink cycles, driven by wall-clock time like the shield. */
  _updateFace() {
    const t = performance.now() * 0.001;

    // Flick: short sin burst every ~2.1–3.7 s (per-snake rhythm).
    const cycle = 2.1 + (this._tongueSeed % 1) * 1.6;
    const ph = ((t + this._tongueSeed * 13.7) % cycle) / cycle;
    const flick = ph < 0.16 ? Math.sin((ph / 0.16) * Math.PI) : 0;
    if (flick > 0.05) {
      this.tongue.visible = true;
      this.tongue.scale.set(1, 1, 0.35 + 0.65 * flick);
    } else {
      this.tongue.visible = false;
    }

    // Blink: quick vertical squash of both eyes every few seconds.
    const blinkPh = ((t * 0.45 + this._blinkSeed * 3.1) % 3.7) / 3.7;
    const squash = blinkPh > 0.97 ? 0.15 : 1;
    this.eyeL.scale.y = squash;
    this.eyeR.scale.y = squash;
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
    this._bulges = [];
    this._radiusScaleFn = null;
    this.setTurbo(false);
    this.setShield(false);
    this.resetPose();
  }

  /** Spawn a travelling "swallow" bulge at the head (called when eating). */
  swallow() {
    if (!this._bulges) this._bulges = [];
    this._bulges.push({ t: 0 });
  }

  get isJumping() {
    return this._jumpT > 0;
  }

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
    this.bodyMat.emissiveIntensity = on ? this._bodyEmissiveBase * 1.8 : this._bodyEmissiveBase;
    this.headMat.emissiveIntensity = on ? this._headEmissiveBase * 1.6 : this._headEmissiveBase;
  }

  update(dt, steer, moving = true) {
    if (!this.alive) return;

    if (this._jumpCooldown > 0) this._jumpCooldown -= dt;

    if (this._jumpT > 0) {
      this._jumpT = Math.max(0, this._jumpT - dt);
      const progress = 1 - this._jumpT / this.jumpDuration;
      this.surfaceLift = this._baseLift + this.jumpHeight * Math.sin(Math.PI * progress);
    } else {
      this.surfaceLift = this._baseLift;
    }

    this._updateBulges(dt);
    this.step(dt, steer, moving);
    this._placeShield();
    this._updateFace();
  }

  /** Advance swallow bulges head→tail and build the radius-scale function. */
  _updateBulges(dt) {
    if (!this._bulges || this._bulges.length === 0) {
      this._radiusScaleFn = null;
      return;
    }
    const TRAVEL = 0.9; // seconds head→tail
    for (const b of this._bulges) b.t += dt / TRAVEL;
    this._bulges = this._bulges.filter((b) => b.t <= 1.05);
    if (this._bulges.length === 0) {
      this._radiusScaleFn = null;
      return;
    }
    const bulges = this._bulges;
    const AMP = 0.55;
    const WIDTH = 0.07;
    this._radiusScaleFn = (t) => {
      let s = 1;
      for (const b of bulges) {
        const d = (t - b.t) / WIDTH;
        s += AMP * Math.exp(-d * d);
      }
      return s;
    };
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
