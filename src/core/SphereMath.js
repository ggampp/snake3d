import * as THREE from 'three';

/**
 * Helpers for moving along the surface of a unit sphere.
 *
 * Convention:
 *  - `position` is a unit vector (point on the sphere).
 *  - `heading` is a unit vector tangent to the sphere at `position`
 *    (i.e. perpendicular to `position`), pointing in the direction of travel.
 *  - The world radius is applied only when rendering; the simulation works
 *    on the unit sphere so angles map directly to arc length.
 */

const _axis = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _tmp = new THREE.Vector3();

/** Re-orthonormalize `heading` so it stays tangent to `position`. */
export function reorthonormalize(position, heading) {
  // Remove any component of heading along the normal, then normalize.
  const dot = heading.dot(position);
  heading.addScaledVector(position, -dot).normalize();
  return heading;
}

/**
 * Advance a point/heading along its geodesic (great circle) by `angle` radians.
 * Mutates both `position` and `heading` in place.
 */
export function advance(position, heading, angle) {
  // The rotation axis of a great-circle step is position × heading.
  _axis.crossVectors(position, heading).normalize();
  _q.setFromAxisAngle(_axis, angle);
  position.applyQuaternion(_q).normalize();
  heading.applyQuaternion(_q);
  reorthonormalize(position, heading);
  return position;
}

/**
 * Turn the heading left/right around the local surface normal (`position`)
 * by `angle` radians. Positive = one consistent direction (e.g. left).
 */
export function turn(position, heading, angle) {
  _q.setFromAxisAngle(position, angle);
  heading.applyQuaternion(_q);
  reorthonormalize(position, heading);
  return heading;
}

/** Great-circle (angular) distance between two unit vectors, in radians. */
export function arcDistance(a, b) {
  // Clamp to avoid NaN from float error just outside [-1, 1].
  return Math.acos(THREE.MathUtils.clamp(a.dot(b), -1, 1));
}

/**
 * Spherical linear interpolation between two unit vectors.
 * Returns a new unit vector at fraction `t` along the great circle from a→b.
 */
export function slerpUnit(a, b, t, out = new THREE.Vector3()) {
  const omega = arcDistance(a, b);
  if (omega < 1e-6) return out.copy(a);
  const sin = Math.sin(omega);
  const w1 = Math.sin((1 - t) * omega) / sin;
  const w2 = Math.sin(t * omega) / sin;
  out.copy(a).multiplyScalar(w1).addScaledVector(b, w2);
  return out.normalize();
}

/** A uniformly random unit vector (random point on the sphere). */
export function randomUnit(out = new THREE.Vector3()) {
  const u = Math.random() * 2 - 1; // cos(theta)
  const phi = Math.random() * Math.PI * 2;
  const r = Math.sqrt(1 - u * u);
  return out.set(r * Math.cos(phi), u, r * Math.sin(phi));
}

/** Pick an arbitrary unit tangent at `position`. */
export function anyTangent(position, out = new THREE.Vector3()) {
  // Cross with whichever world axis is least parallel to position.
  const ref = Math.abs(position.y) < 0.99 ? _tmp.set(0, 1, 0) : _tmp.set(1, 0, 0);
  return out.crossVectors(position, ref).normalize();
}

/**
 * Build a quaternion that orients an object sitting on the surface:
 * its local +Y points along the surface normal (`position`) and its local
 * +Z points along `heading`.
 */
const _m = new THREE.Matrix4();
const _right = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _up = new THREE.Vector3();
export function surfaceOrientation(position, heading, out = new THREE.Quaternion()) {
  _up.copy(position).normalize();
  _fwd.copy(heading);
  reorthonormalize(_up, _fwd);
  _right.crossVectors(_up, _fwd).normalize();
  // Columns: x=right, y=up, z=forward
  _m.makeBasis(_right, _up, _fwd);
  return out.setFromRotationMatrix(_m);
}
