import * as THREE from 'three';

// Cached so every snake/world rebuild reuses the same GPU texture.
// `false` is the "tried but no DOM" sentinel (headless tests).
let _scaleTex = null;

/**
 * Procedural snake-scale texture, used as a bump map so the body and head read
 * as overlapping scales under the lighting instead of a flat glossy tube.
 *
 * Mid-grey (0x808080) is "flat"; each scale is a rounded shape with a raised
 * (lighter) centre and a recessed (darker) rim. Rows are offset half a scale so
 * they interlock like real snake scales. Returns null where there is no DOM.
 */
export function getScaleTexture() {
  if (_scaleTex !== null) return _scaleTex || null;
  if (typeof document === 'undefined') {
    _scaleTex = false;
    return null;
  }

  const size = 256;
  const cols = 16;
  const rows = 16;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#808080'; // neutral = no bump
  ctx.fillRect(0, 0, size, size);

  const cw = size / cols;
  const ch = size / rows;
  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * cw * 0.5;
    for (let c = -1; c <= cols; c++) {
      const cx = c * cw + offset + cw * 0.5;
      const cy = r * ch + ch * 0.5;
      const rad = cw * 0.65;
      const g = ctx.createRadialGradient(cx, cy - ch * 0.12, rad * 0.1, cx, cy, rad);
      g.addColorStop(0.0, '#f0f0f0'); // raised centre
      g.addColorStop(0.65, '#909090');
      g.addColorStop(1.0, '#565656'); // recessed rim
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(cx, cy, cw * 0.56, ch * 0.64, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  _scaleTex = tex;
  return tex;
}
