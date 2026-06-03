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

// Steer in a tight constant circle so the snake eventually crosses itself.
await page.keyboard.down('ArrowLeft');

let died = false;
let maxScore = 0;
for (let i = 0; i < 40; i++) {
  await new Promise((r) => setTimeout(r, 500));
  const { score, dead } = await page.evaluate(() => ({
    score: Number(document.getElementById('hud-score').textContent),
    dead: !document.getElementById('overlay').classList.contains('hidden'),
  }));
  maxScore = Math.max(maxScore, score);
  if (dead) { died = true; break; }
}
await page.keyboard.up('ArrowLeft');
await page.screenshot({ path: '/tmp/shot_gameover.png' });

const overlayTitle = await page.evaluate(() => document.getElementById('overlay-title').textContent);
console.log('maxScore:', maxScore, '| diedShown:', died, '| overlayTitle:', overlayTitle);
console.log('ERRORS:', errors.length ? errors.join(' | ') : 'none');
await browser.close();
