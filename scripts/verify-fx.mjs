// Visual verification of shield bubble, power-up badges, enemy worm and zoom.
import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1000, height: 600 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://localhost:4173/', { waitUntil: 'domcontentloaded' });
await new Promise((r) => setTimeout(r, 700));
await page.evaluate(() => document.getElementById('overlay-btn').click());
await new Promise((r) => setTimeout(r, 600));

const info = await page.evaluate(async () => {
  const g = window.__game;
  const now = g.clock.elapsedTime;
  // Force both power-ups active so the bubble + badges show.
  g.shieldUntil = now + 99;
  g.turboUntil = now + 99;
  // Pull the camera out a bit to frame more of the planet.
  g.chase.setZoom(1.6);
  // Park an enemy right in front of the player's heading.
  const worm = g.enemies[0];
  worm.group.visible = true;
  const head = g.snake.position.clone();
  const heading = g.snake.heading.clone();
  // place ~4 segments ahead along the heading (still invincible via shield)
  const ahead = head.clone().addScaledVector(heading, 0.18).normalize();
  worm.resetPose(ahead);
  await new Promise((r) => setTimeout(r, 400));
  return {
    badges: document.getElementById('hud-powerups').innerHTML,
    shieldVisible: g.snake.shieldMesh.visible,
    turbo: g.snake.turbo,
    zoom: g.chase.zoom,
  };
});

await new Promise((r) => setTimeout(r, 300));
await page.screenshot({ path: '/tmp/shot_fx.png' });
console.log('badges:', info.badges.replace(/\s+/g, ' ').trim());
console.log('shieldVisible:', info.shieldVisible, '| turbo:', info.turbo, '| zoom:', info.zoom);
console.log('ERRORS:', errors.length ? errors.join(' | ') : 'none');
await browser.close();
