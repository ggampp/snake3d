import puppeteer from 'puppeteer';

const URL = process.env.URL || 'http://localhost:4173/';

const browser = await puppeteer.launch({
  headless: 'new',
  args: [
    '--no-sandbox',
    '--use-gl=swiftshader',
    '--enable-webgl',
    '--ignore-gpu-blocklist',
    '--enable-unsafe-swiftshader',
  ],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });

const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('CONSOLE: ' + m.text());
});
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
await new Promise((r) => setTimeout(r, 1500));
await page.screenshot({ path: '/tmp/shot_menu.png' });

// Start the game and let it run a bit so the snake moves + eats.
await page.evaluate(() => document.getElementById('overlay-btn').click());
await new Promise((r) => setTimeout(r, 3500));
await page.screenshot({ path: '/tmp/shot_play.png' });

const score = await page.evaluate(() => document.getElementById('hud-score').textContent);
console.log('SCORE after run:', score);
console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');

await browser.close();
