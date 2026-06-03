import * as THREE from 'three';

/**
 * Third-person chase camera. Sits behind and above the snake head, smoothly
 * trailing its position and heading so the planet curves away ahead — the
 * look from the reference video.
 */
export class ChaseCamera {
  constructor(camera, radius) {
    this.camera = camera;
    this.radius = radius;

    this.distance = 4.0; // how far behind the head (world units)
    this.height = 3.2; // how far above the surface
    this.lookAhead = 2.5; // aim point ahead of the head
    this.smooth = 4.0; // follow stiffness

    this._pos = new THREE.Vector3();
    this._look = new THREE.Vector3();
    this._initialized = false;
  }

  /**
   * @param {THREE.Vector3} headUnit  unit position of head
   * @param {THREE.Vector3} headingUnit  unit tangent heading
   */
  update(dt, headUnit, headingUnit) {
    const surface = headUnit.clone().multiplyScalar(this.radius);
    const normal = headUnit; // outward

    // Desired camera position: behind the head along -heading, lifted by normal.
    const desired = surface
      .clone()
      .addScaledVector(headingUnit, -this.distance)
      .addScaledVector(normal, this.height);

    // Aim a bit ahead of the head, near the surface.
    const lookTarget = surface
      .clone()
      .addScaledVector(headingUnit, this.lookAhead)
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
    this.camera.up.copy(normal); // keep "up" aligned to the surface
    this.camera.lookAt(this._look);
  }

  reset() {
    this._initialized = false;
  }
}
