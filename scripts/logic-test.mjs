// Headless logic tests for the core game math/entities (no renderer needed).
import * as THREE from 'three';
import { advance, turn, arcDistance, reorthonormalize } from '../src/core/SphereMath.js';
import { Snake } from '../src/entities/Snake.js';
import { EnemyWorm } from '../src/entities/EnemyWorm.js';
import { EnergyField } from '../src/entities/EnergyField.js';
import { PowerUpField } from '../src/entities/PowerUpField.js';

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

// 2. Snake builds a continuous body with the right number of segments.
{
  const snake = new Snake(20);
  ok(snake.segments.length === snake.segmentCount, `body has ${snake.segmentCount} segments`);
  ok(snake.body.mesh.geometry.attributes.position.count > 0, 'continuous tube geometry built');
}

// 3. Fruit pickup: proportional growth on eat.
{
  const snake = new Snake(20);
  const field = new EnergyField(20);
  const before = snake.segmentCount;
  // Force an active orb sitting exactly on the head.
  const orb = field.orbs[0];
  orb.active = true;
  orb.unit.copy(snake.position);
  orb.energy = 3;
  orb.baseRadius = 0.9;
  orb.age = 1.0;
  orb.lifetime = 5.0;

  let grewBy = 0;
  let scored = 0;
  field.update(0.016, snake.position, snake.thickness * 1.05, (g, s) => {
    grewBy = g;
    scored = s;
    snake.grow(g);
  });
  ok(grewBy === orb.energy * 2, `growth is proportional to energy (energy=3 -> grow ${grewBy})`);
  ok(scored === 3, `score is proportional to energy (+${scored})`);
  ok(snake.segmentCount === before + grewBy, `snake grew (${before} -> ${snake.segmentCount})`);
}

// 4. Self-collision fires when the body folds back onto the head.
{
  const snake = new Snake(20);
  snake.segments[10] = snake.position.clone();
  ok(snake.checkSelfCollision(), 'self-collision detected when a far segment overlaps head');

  const snake2 = new Snake(20);
  ok(!snake2.checkSelfCollision(), 'no false self-collision on a fresh straight body');
}

// 5. Enemy worm reports a hit when the player head overlaps it.
{
  const worm = new EnemyWorm(20);
  worm.reset();
  const head = worm.segments[3].clone();
  ok(worm.hits(head, 0.02), 'enemy worm detects contact with player head');
  // A point on the far side of the planet should not register.
  const far = head.clone().negate();
  ok(!worm.hits(far, 0.02), 'enemy worm ignores far-away points');
}

// 6. Jump grants temporary invincibility and lifts the body.
{
  const snake = new Snake(20);
  snake.segments[10] = snake.position.clone(); // would normally be a collision
  ok(snake.checkSelfCollision(), 'collides when not jumping');
  snake.jump();
  ok(snake.isJumping && snake.invincible, 'jump makes the snake invincible');
  ok(!snake.checkSelfCollision(), 'no self-collision while jumping');
  snake.update(0.016, 0);
  ok(snake.surfaceLift > snake._baseLift, 'body lifts off the surface mid-jump');
}

// 7. Power-up pickup reports its type.
{
  const snake = new Snake(20);
  const field = new PowerUpField(20);
  const slot = field.slots[0];
  slot.active = true;
  slot.unit.copy(snake.position);
  slot.type = 'turbo';
  slot.age = 1.0;
  slot.lifetime = 6.0;
  let got = null;
  field.update(0.016, snake.position, snake.thickness * 1.05, (type) => (got = type));
  ok(got === 'turbo', `power-up pickup fires with its type (got ${got})`);
}

// 8. Shield blocks both enemy and self collisions.
{
  const snake = new Snake(20);
  snake.setShield(true);
  snake.segments[10] = snake.position.clone();
  ok(snake.invincible && !snake.checkSelfCollision(), 'shield blocks self-collision');
}

// 9. Hold-to-move: the snake only advances when `moving` is true.
{
  const snake = new Snake(20);
  const before = snake.position.clone();
  snake.update(0.05, 0, false); // not holding the move key
  ok(arcDistance(before, snake.position) < 1e-6, 'snake stays put when not moving');
  snake.update(0.05, 0, true); // holding it now
  ok(arcDistance(before, snake.position) > 1e-4, 'snake advances when moving');
}

// 10. Enemy "touches" detects body (middle) contact and honours the skip range.
{
  const worm = new EnemyWorm(20);
  worm.reset();
  // A point sitting on the worm's head; with skip=0 it's a hit, skip past it = miss.
  const onHead = worm.segments[0].clone();
  ok(worm.touches([onHead], 0.02, 0), 'touches() detects contact with a point');
  ok(!worm.touches([onHead], 0.02, 1), 'touches() honours the skip offset');
  const far = onHead.clone().negate();
  ok(!worm.touches([far], 0.02, 0), 'touches() ignores far-away points');
}

// 11. Destroyed worm → energy orbs can be force-spawned along its length.
{
  const snake = new Snake(20);
  const field = new EnergyField(20);
  const before = field.orbs.filter((o) => o.active).length;
  const ok1 = field.spawnAt(snake.position.clone(), 2);
  const after = field.orbs.filter((o) => o.active).length;
  ok(ok1 && after === before + 1, 'spawnAt activates a pooled orb at a point');
  ok(field.orbs.find((o) => o.active)?.lifetime === 20, 'spawned fruits remain for 20 seconds');
}

// 12. Swallow bulge fattens the body locally then clears out.
{
  const snake = new Snake(20);
  snake.swallow();
  snake.update(0.016, 0, true);
  ok(typeof snake._radiusScaleFn === 'function', 'swallow installs a radius-scale fn');
  ok(snake._radiusScaleFn(0) > 1, 'bulge widens the body near the head');
  for (let i = 0; i < 80; i++) snake.update(0.016, 0, true); // run it off the tail
  ok(snake._radiusScaleFn === null, 'bulge clears after travelling the body');
}

console.log(failures === 0 ? '\nALL TESTS PASSED' : `\n${failures} TEST(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
