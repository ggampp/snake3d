// End-to-end test: drive the snake toward the food and assert the real game
// loop awards score and grows the body.
import puppeteer from 'puppeteer';

const URL = 'http://localhost:4173/';
const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1000, height: 600 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await new Promise((r) => setTimeout(r, 800));
await page.evaluate(() => document.getElementById('overlay-btn').click());

// Run an autopilot inside the page that steers the heading toward the food.
const result = await page.evaluate(async () => {
  const g = window.__game;
  const startLen = g.snake.segmentCount;

  return await new Promise((resolve) => {
    let frames = 0;
    const id = setInterval(() => {
      frames++;
      const head = g.snake.position;
      const heading = g.snake.heading;
      // Steer toward the nearest active energy orb.
      let food = null;
      let bestD = Infinity;
      for (const o of g.energy.orbs) {
        if (!o.active) continue;
        const d = Math.acos(Math.max(-1, Math.min(1, o.unit.dot(head))));
        if (d < bestD) { bestD = d; food = o.unit; }
      }
      if (!food) { g.input.left = g.input.right = false; return; }

      // Desired tangent direction from head toward food along the sphere.
      const toFood = food.clone().addScaledVector(head, -food.dot(head)).normalize();
      // Signed angle between current heading and desired, around the normal.
      const cross = heading.clone().cross(toFood);
      const sign = Math.sign(cross.dot(head)) || 1;
      const ang = Math.acos(Math.max(-1, Math.min(1, heading.dot(toFood))));
      // Translate into a steer key state.
      g.input.left = sign > 0 && ang > 0.05;
      g.input.right = sign < 0 && ang > 0.05;
      g.input.up = true; // hold "move forward" (snake no longer auto-advances)

      if (g.score >= 8 || frames > 1600) {
        clearInterval(id);
        g.input.left = g.input.right = g.input.up = false;
        resolve({ score: g.score, startLen, len: g.snake.segmentCount, frames });
      }
    }, 16);
  });
});

await new Promise((r) => setTimeout(r, 400));
await page.screenshot({ path: '/tmp/shot_energy.png' });
console.log('autopilot result:', JSON.stringify(result));
console.log('grew:', result.len > result.startLen, '| scored:', result.score >= 1);
console.log('ERRORS:', errors.length ? errors.join(' | ') : 'none');
await browser.close();
process.exit(result.score >= 1 && result.len > result.startLen ? 0 : 1);
