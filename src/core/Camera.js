import * as THREE from 'three';

/**
 * Third-person chase camera. Sits behind and above the snake head, smoothly
 * trailing its position and heading so the planet curves away ahead.
 *
 * `zoom` scales how far back/up the camera sits, letting the player pull out to
 * see more of the planet. Persisted to localStorage so it survives refreshes.
 */
export class ChaseCamera {
  constructor(camera, radius) {
    this.camera = camera;
    this.radius = radius;

    this.baseDistance = 4.5;
    this.baseHeight = 3.8;
    this.baseLookAhead = 2.5;
    this.smooth = 4.0;

    this.minZoom = 0.7;
    this.maxZoom = 5.5;   // far enough to see most of the hemisphere
    this.zoom = this._loadZoom();

    this._pos = new THREE.Vector3();
    this._look = new THREE.Vector3();
    this._initialized = false;
  }

  _loadZoom() {
    const z = parseFloat(localStorage.getItem('snake3d.zoom'));
    // Default to 3.5 (nicely far out) on first play
    const def = 3.5;
    return Number.isFinite(z) ? Math.min(this.maxZoom, Math.max(this.minZoom, z)) : def;
  }

  setZoom(z) {
    this.zoom = Math.min(this.maxZoom, Math.max(this.minZoom, z));
    localStorage.setItem('snake3d.zoom', this.zoom.toFixed(2));
    return this.zoom;
  }

  addZoom(delta) {
    return this.setZoom(this.zoom + delta);
  }

  update(dt, headUnit, headingUnit) {
    const surface = headUnit.clone().multiplyScalar(this.radius);
    const normal = headUnit;

    const distance = this.baseDistance * this.zoom;
    const height = this.baseHeight * Math.pow(this.zoom, 1.2);

    const desired = surface
      .clone()
      .addScaledVector(headingUnit, -distance)
      .addScaledVector(normal, height);

    const lookTarget = surface
      .clone()
      .addScaledVector(headingUnit, this.baseLookAhead)
      .addScaledVector(normal, 0.4);

    if (!this._initialized) {
      this._pos.copy(desired);
      this._look.copy(lookTarget);
      this._initialized = true;
    } else {
      const k = 1 - Math.exp(-this.smooth * dt);
      this._pos.lerp(desired, k);
      this._look.lerp(lookTarget, k);
    }

    this.camera.position.copy(this._pos);
    this.camera.up.copy(normal);
    this.camera.lookAt(this._look);
  }

  reset() {
    this._initialized = false;
  }
}
