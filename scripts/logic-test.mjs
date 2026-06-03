// Headless logic tests for the core game math/entities (no renderer needed).
import * as THREE from 'three';
import { advance, turn, arcDistance, reorthonormalize } from '../src/core/SphereMath.js';
import { Snake } from '../src/entities/Snake.js';
import { Food } from '../src/entities/Food.js';

let failures = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`);
  if (!cond) failures++;
};

// 1. advance/turn keep position on the unit sphere and heading tangent.
{
  const p = new THREE.Vector3(0, 1, 0);
  const h = new THREE.Vector3(1, 0, 0);
  reorthonormalize(p, h);
  for (let i = 0; i < 200; i++) {
    turn(p, h, 0.05);
    advance(p, h, 0.07);
  }
  ok(Math.abs(p.length() - 1) < 1e-4, `position stays unit length (len=${p.length().toFixed(5)})`);
  ok(Math.abs(p.dot(h)) < 1e-3, `heading stays tangent (dot=${p.dot(h).toExponential(2)})`);
}

// 2. Eating + growth.
{
  const radius = 20;
  const snake = new Snake(radius);
  const food = new Food(radius);
  // Place food exactly at the head.
  food.unit.copy(snake.position);
  const eatAngle = (snake.thickness * 1.1 + 0.5) / radius;
  const before = snake.segmentCount;
  ok(food.isEatenBy(snake.position, eatAngle), 'food at head is detected as eaten');
  snake.grow(2);
  ok(snake.segmentCount === before + 2, `grow increases length (${before} -> ${snake.segmentCount})`);
  // Respawn should move it away from the head.
  food.respawn(snake.position, 0.4);
  ok(arcDistance(food.unit, snake.position) > 0.4, 'respawn keeps food away from head');
}

// 3. Self-collision fires when the body folds back onto the head.
{
  const snake = new Snake(20);
  snake.update(0.016, 0); // build segments once
  // Forge a segment overlapping the head far down the body.
  snake.segments[10] = snake.position.clone();
  ok(snake.checkSelfCollision(), 'self-collision detected when a far segment overlaps head');

  // And does NOT fire for a normal straight body.
  const snake2 = new Snake(20);
  snake2.update(0.016, 0);
  ok(!snake2.checkSelfCollision(), 'no false self-collision on a fresh straight body');
}

console.log(failures === 0 ? '\nALL TESTS PASSED' : `\n${failures} TEST(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
