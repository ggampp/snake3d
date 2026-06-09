import * as THREE from 'three';

// Cached so every snake/world rebuild reuses the same GPU textures.
// `false` is the "tried but no DOM" sentinel (headless tests).
let _maps = null;

const SIZE = 512;
const COLS = 12;
const ROWS = 16; // even → the half-scale row offset wraps seamlessly

/**
 * Trace one scale as a rounded diamond (wide at the shoulders, pointed at the
 * tail end — the classic dorsal scale silhouette) into `ctx`.
 */
function scalePath(ctx, cx, cy, w, h) {
  const top = cy - h * 0.5;
  const bot = cy + h * 0.62; // slightly longer rear tip → overlapping shingles
  ctx.beginPath();
  ctx.moveTo(cx, top);
  ctx.bezierCurveTo(cx + w * 0.62, top + h * 0.12, cx + w * 0.62, cy + h * 0.18, cx, bot);
  ctx.bezierCurveTo(cx - w * 0.62, cy + h * 0.18, cx - w * 0.62, top + h * 0.12, cx, top);
  ctx.closePath();
}

/**
 * Procedural snake-skin maps shared by every skin:
 *
 *   map       — albedo detail (near-white, multiplies the skin color):
 *               per-scale luminance jitter + darker interstitial skin
 *   bump      — overlapping keeled scales in relief
 *   rough     — glossy scale centres, matte edges/skin between scales
 *
 * Scales are drawn row by row, top to bottom, so each row overlaps the one
 * above like real shingled snake scales; odd rows are offset half a scale.
 * Returns null where there is no DOM (headless tests).
 */
export function getScaleMaps() {
  if (_maps !== null) return _maps || null;
  if (typeof document === 'undefined') {
    _maps = false;
    return null;
  }

  const mk = () => {
    const c = document.createElement('canvas');
    c.width = c.height = SIZE;
    return c.getContext('2d');
  };
  const col = mk();
  const bmp = mk();
  const rgh = mk();

  // Backgrounds = the skin between scales: darker, flat and matte.
  col.fillStyle = '#8f897c';
  col.fillRect(0, 0, SIZE, SIZE);
  bmp.fillStyle = '#5a5a5a';
  bmp.fillRect(0, 0, SIZE, SIZE);
  rgh.fillStyle = '#e0e0e0';
  rgh.fillRect(0, 0, SIZE, SIZE);

  const cw = SIZE / COLS;
  const ch = SIZE / ROWS;

  for (let r = -1; r <= ROWS; r++) {
    const offset = ((r % 2) + 2) % 2 ? cw * 0.5 : 0;
    for (let c = -1; c <= COLS; c++) {
      const cx = c * cw + offset + cw * 0.5;
      const cy = r * ch + ch * 0.5;
      // Deterministic per-scale jitter, on wrapped indices so the texture tiles.
      const wc = ((c % COLS) + COLS) % COLS;
      const wr = ((r % ROWS) + ROWS) % ROWS;
      const jitter = Math.abs(Math.sin((wc * 7 + wr * 13 + 3) * 12.9898) * 43758.5453) % 1;
      const w = cw * 1.08;
      const h = ch * 1.1;

      // --- Albedo: subtle per-scale tone variation + darker rim ---
      const lum = 232 + Math.round(jitter * 23); // 0.91 … 1.0 of the skin color
      scalePath(col, cx, cy, w, h);
      const cg = col.createRadialGradient(cx, cy - ch * 0.1, w * 0.08, cx, cy, w * 0.75);
      cg.addColorStop(0, `rgb(${lum + 8},${lum + 6},${lum + 2})`);
      cg.addColorStop(0.62, `rgb(${lum - 6},${lum - 8},${lum - 12})`);
      cg.addColorStop(1, `rgb(${lum - 95},${lum - 97},${lum - 102})`);
      col.fillStyle = cg;
      col.fill();

      // --- Bump: raised dome, recessed rim ---
      scalePath(bmp, cx, cy, w, h);
      const bg = bmp.createRadialGradient(cx, cy - ch * 0.12, w * 0.06, cx, cy, w * 0.78);
      bg.addColorStop(0, '#e8e8e8');
      bg.addColorStop(0.6, '#9a9a9a');
      bg.addColorStop(1, '#3c3c3c');
      bmp.fillStyle = bg;
      bmp.fill();
      // Keel: the thin raised ridge running down the centre of each scale.
      bmp.strokeStyle = 'rgba(255,255,255,0.5)';
      bmp.lineWidth = Math.max(1, cw * 0.06);
      bmp.beginPath();
      bmp.moveTo(cx, cy - h * 0.34);
      bmp.lineTo(cx, cy + h * 0.42);
      bmp.stroke();

      // --- Roughness: smooth glossy centre, matte rim ---
      scalePath(rgh, cx, cy, w, h);
      const rg = rgh.createRadialGradient(cx, cy - ch * 0.1, w * 0.08, cx, cy, w * 0.75);
      rg.addColorStop(0, '#8a8a8a');
      rg.addColorStop(0.65, '#b4b4b4');
      rg.addColorStop(1, '#dadada');
      rgh.fillStyle = rg;
      rgh.fill();
    }
  }

  // Fine speckle so large areas don't look computer-clean.
  col.globalAlpha = 0.05;
  for (let i = 0; i < 1600; i++) {
    col.fillStyle = i % 2 ? '#000000' : '#ffffff';
    col.fillRect(Math.random() * SIZE, Math.random() * SIZE, 1.5, 1.5);
  }
  col.globalAlpha = 1;

  const tex = (ctx, srgb) => {
    const t = new THREE.CanvasTexture(ctx.canvas);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4;
    return t;
  };

  _maps = {
    map: tex(col, true),
    bump: tex(bmp, false),
    rough: tex(rgh, false),
  };
  return _maps;
}

/**
 * Back-compat helper: the scale bump map alone (kept for older callers).
 */
export function getScaleTexture() {
  const maps = getScaleMaps();
  return maps ? maps.bump : null;
}
