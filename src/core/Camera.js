import * as THREE from 'three';

/**
 * Third-person chase camera. Sits behind and above the snake head, smoothly
 * trailing its position and heading so the planet curves away ahead — the
 * look from the reference video.
 *
 * `zoom` scales how far back/up the camera sits, letting the player pull out to
 * see more of the planet. It is clamped and persisted to localStorage.
 */
export class ChaseCamera {
  constructor(camera, radius) {
    this.camera = camera;
    this.radius = radius;

    this.baseDistance = 4.0;
    this.baseHeight = 3.2;
    this.baseLookAhead = 2.5;
    this.smooth = 4.0;

    this.minZoom = 0.7;
    this.maxZoom = 3.2;
    this.zoom = this._loadZoom();

    this._pos = new THREE.Vector3();
    this._look = new THREE.Vector3();
    this._initialized = false;
  }

  _loadZoom() {
    const z = parseFloat(localStorage.getItem('snake3d.zoom'));
    return Number.isFinite(z) ? Math.min(this.maxZoom, Math.max(this.minZoom, z)) : 1.0;
  }

  setZoom(z) {
    this.zoom = Math.min(this.maxZoom, Math.max(this.minZoom, z));
    localStorage.setItem('snake3d.zoom', this.zoom.toFixed(2));
    return this.zoom;
  }

  addZoom(delta) {
    return this.setZoom(this.zoom + delta);
  }

  /**
   * @param {THREE.Vector3} headUnit  unit position of head
   * @param {THREE.Vector3} headingUnit  unit tangent heading
   */
  update(dt, headUnit, headingUnit) {
    const surface = headUnit.clone().multiplyScalar(this.radius);
    const normal = headUnit;

    // Distance/height grow with zoom; height a touch faster so you look down
    // on more of the planet as you pull out.
    const distance = this.baseDistance * this.zoom;
    const height = this.baseHeight * Math.pow(this.zoom, 1.15);

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
