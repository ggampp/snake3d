import * as THREE from 'three';

/**
 * Procedural equirectangular surface maps for the elemental planets
 * (water / fire / ice). Each element gets a coherent set of PBR maps:
 *
 *   map        — albedo (sRGB)
 *   bumpMap    — surface relief
 *   roughnessMap — gloss variation (wet water vs. matte crust, etc.)
 *   emissiveMap  — only for fire: the glowing lava cracks
 *
 * The noise is sampled in 3D along the sphere direction of each texel, so the
 * maps wrap seamlessly around the equator and show no pinching at the poles.
 * Generation runs once per element on a canvas and is cached; in headless
 * environments (no DOM) everything returns null and the Planet falls back to
 * plain colors.
 */

const W = 1024;
const H = 512;

const _cache = new Map();

/* ---------------------------------------------------------------- noise -- */

// Integer-lattice value hash → [0, 1). Classic Perlin-style integer mix.
function hash3(ix, iy, iz) {
  let n = (ix * 15731 + iy * 789221 + iz * 1376312589) | 0;
  n = ((n << 13) ^ n) | 0;
  n = (n * ((n * n * 15731 + 789221) | 0) + 1376312589) | 0;
  return (n & 0x7fffffff) / 0x7fffffff;
}

const sm = (t) => t * t * (3 - 2 * t);

// Trilinear 3D value noise → [0, 1).
function vnoise(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = sm(x - ix), fy = sm(y - iy), fz = sm(z - iz);
  const c000 = hash3(ix, iy, iz),       c100 = hash3(ix + 1, iy, iz);
  const c010 = hash3(ix, iy + 1, iz),   c110 = hash3(ix + 1, iy + 1, iz);
  const c001 = hash3(ix, iy, iz + 1),   c101 = hash3(ix + 1, iy, iz + 1);
  const c011 = hash3(ix, iy + 1, iz + 1), c111 = hash3(ix + 1, iy + 1, iz + 1);
  const x00 = c000 + (c100 - c000) * fx;
  const x10 = c010 + (c110 - c010) * fx;
  const x01 = c001 + (c101 - c001) * fx;
  const x11 = c011 + (c111 - c011) * fx;
  const y0 = x00 + (x10 - x00) * fy;
  const y1 = x01 + (x11 - x01) * fy;
  return y0 + (y1 - y0) * fz;
}

// Fractal Brownian motion, `oct` octaves → roughly [0, 1].
function fbm(x, y, z, oct = 4) {
  let v = 0, amp = 0.5, f = 1;
  for (let o = 0; o < oct; o++) {
    v += amp * vnoise(x * f, y * f, z * f);
    amp *= 0.5;
    f *= 2.07;
  }
  return v / (1 - Math.pow(0.5, oct));
}

// Ridged noise: 1 at crease lines, 0 in between — for cracks/crests/veins.
function ridged(x, y, z, oct = 4) {
  let v = 0, amp = 0.5, f = 1;
  for (let o = 0; o < oct; o++) {
    v += amp * (1 - Math.abs(2 * vnoise(x * f, y * f, z * f) - 1));
    amp *= 0.5;
    f *= 2.13;
  }
  return v / (1 - Math.pow(0.5, oct));
}

/* ------------------------------------------------------------- plumbing -- */

/**
 * Compute the two shared noise fields (smooth fBm + ridged) sampled on the
 * sphere for every texel of an equirectangular map.
 */
function noiseFields(seed, baseScale, ridgeScale) {
  const f = new Float32Array(W * H);
  const r = new Float32Array(W * H);
  for (let py = 0; py < H; py++) {
    const lat = ((py + 0.5) / H - 0.5) * Math.PI; // -π/2 … π/2
    const cl = Math.cos(lat), slat = Math.sin(lat);
    for (let px = 0; px < W; px++) {
      const lon = ((px + 0.5) / W) * Math.PI * 2;
      const dx = cl * Math.cos(lon), dy = slat, dz = cl * Math.sin(lon);
      const i = py * W + px;
      f[i] = fbm(dx * baseScale + seed, dy * baseScale + seed, dz * baseScale, 5);
      r[i] = ridged(dx * ridgeScale - seed, dy * ridgeScale, dz * ridgeScale + seed, 4);
    }
  }
  return { f, r };
}

function makeCanvas() {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  return c.getContext('2d', { willReadFrequently: false });
}

function toTexture(ctx, srgb = false) {
  const tex = new THREE.CanvasTexture(ctx.canvas);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (a, b, v) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, t) => a + (b - a) * t;

/** mix three [r,g,b] stops at t ∈ [0,1] (stop positions 0 / 0.5 / 1). */
function gradient3(c0, c1, c2, t) {
  if (t < 0.5) {
    const u = t * 2;
    return [lerp(c0[0], c1[0], u), lerp(c0[1], c1[1], u), lerp(c0[2], c1[2], u)];
  }
  const u = (t - 0.5) * 2;
  return [lerp(c1[0], c2[0], u), lerp(c1[1], c2[1], u), lerp(c1[2], c2[2], u)];
}

/* ------------------------------------------------------------- elements -- */

function buildWater() {
  const { f, r } = noiseFields(7.3, 2.4, 7.0);
  const col = makeCanvas();
  const bump = makeCanvas();
  const rough = makeCanvas();
  const ic = col.createImageData(W, H);
  const ib = bump.createImageData(W, H);
  const ir = rough.createImageData(W, H);

  const deep = [4, 26, 58];      // abyss
  const mid = [10, 64, 118];     // open ocean
  const shallow = [28, 120, 168]; // banks / currents
  const foam = [205, 235, 248];

  for (let i = 0; i < W * H; i++) {
    const depth = f[i];
    const crest = smooth(0.78, 0.96, r[i]); // wave crests / foam streaks
    let [cr, cg, cb] = gradient3(deep, mid, shallow, depth);
    cr = lerp(cr, foam[0], crest * 0.65);
    cg = lerp(cg, foam[1], crest * 0.65);
    cb = lerp(cb, foam[2], crest * 0.65);

    const o = i * 4;
    ic.data[o] = cr; ic.data[o + 1] = cg; ic.data[o + 2] = cb; ic.data[o + 3] = 255;

    // Relief: gentle swell + sharper crests.
    const h = 118 + (depth - 0.5) * 56 + crest * 60;
    ib.data[o] = ib.data[o + 1] = ib.data[o + 2] = h; ib.data[o + 3] = 255;

    // Water is glossy; foam is matte.
    const rg = 52 + depth * 40 + crest * 140;
    ir.data[o] = ir.data[o + 1] = ir.data[o + 2] = rg; ir.data[o + 3] = 255;
  }
  col.putImageData(ic, 0, 0);
  bump.putImageData(ib, 0, 0);
  rough.putImageData(ir, 0, 0);

  return {
    map: toTexture(col, true),
    bumpMap: toTexture(bump),
    roughnessMap: toTexture(rough),
    emissiveMap: null,
  };
}

function buildFire() {
  const { f, r } = noiseFields(3.1, 2.0, 4.6);
  const col = makeCanvas();
  const bump = makeCanvas();
  const rough = makeCanvas();
  const emis = makeCanvas();
  const ic = col.createImageData(W, H);
  const ib = bump.createImageData(W, H);
  const ir = rough.createImageData(W, H);
  const ie = emis.createImageData(W, H);

  const crustDark = [22, 12, 10];   // cooled basalt
  const crustWarm = [56, 30, 22];   // warm rock
  const lavaDeep = [148, 28, 0];
  const lavaHot = [255, 96, 8];
  const lavaWhite = [255, 214, 92];

  for (let i = 0; i < W * H; i++) {
    const heat = f[i];                       // large molten regions
    const crack = smooth(0.74, 0.93, r[i]);  // thin glowing fissures
    const melt = smooth(0.62, 0.85, heat);   // open lava lakes
    const glow = clamp01(crack * 0.85 + melt);

    const [kr, kg, kb] = gradient3(crustDark, crustWarm, crustWarm, heat);
    const t = clamp01(0.25 + heat * 0.75);
    const [lr, lg, lb] = gradient3(lavaDeep, lavaHot, lavaWhite, t * glow);

    const o = i * 4;
    ic.data[o]     = lerp(kr, lr, glow);
    ic.data[o + 1] = lerp(kg, lg, glow);
    ic.data[o + 2] = lerp(kb, lb, glow);
    ic.data[o + 3] = 255;

    // Only molten areas emit light (bloom picks this up).
    ie.data[o]     = lr * glow;
    ie.data[o + 1] = lg * glow;
    ie.data[o + 2] = lb * glow;
    ie.data[o + 3] = 255;

    // Crust is craggy and high; cracks/lakes are recessed.
    const h = 150 + (heat - 0.5) * 70 - glow * 90;
    ib.data[o] = ib.data[o + 1] = ib.data[o + 2] = h; ib.data[o + 3] = 255;

    // Rock is matte, liquid lava is glassier.
    const rg = 225 - glow * 130;
    ir.data[o] = ir.data[o + 1] = ir.data[o + 2] = rg; ir.data[o + 3] = 255;
  }
  col.putImageData(ic, 0, 0);
  bump.putImageData(ib, 0, 0);
  rough.putImageData(ir, 0, 0);
  emis.putImageData(ie, 0, 0);

  return {
    map: toTexture(col, true),
    bumpMap: toTexture(bump),
    roughnessMap: toTexture(rough),
    emissiveMap: toTexture(emis, true),
  };
}

function buildIce() {
  const { f, r } = noiseFields(11.7, 2.8, 6.2);
  const col = makeCanvas();
  const bump = makeCanvas();
  const rough = makeCanvas();
  const ic = col.createImageData(W, H);
  const ib = bump.createImageData(W, H);
  const ir = rough.createImageData(W, H);

  const snow = [238, 247, 252];
  const ice = [188, 218, 238];
  const glacial = [142, 186, 220]; // compacted blue ice
  const veinBlue = [54, 110, 165]; // deep crevasses

  for (let i = 0; i < W * H; i++) {
    const pack = f[i];                      // snow ↔ blue-ice fields
    const vein = smooth(0.80, 0.95, r[i]);  // crevasse lines
    let [cr, cg, cb] = gradient3(snow, ice, glacial, pack);
    cr = lerp(cr, veinBlue[0], vein * 0.8);
    cg = lerp(cg, veinBlue[1], vein * 0.8);
    cb = lerp(cb, veinBlue[2], vein * 0.8);

    const o = i * 4;
    ic.data[o] = cr; ic.data[o + 1] = cg; ic.data[o + 2] = cb; ic.data[o + 3] = 255;

    // Drifts and ridges; crevasses cut deep.
    const h = 140 + (pack - 0.5) * 60 - vein * 95;
    ib.data[o] = ib.data[o + 1] = ib.data[o + 2] = h; ib.data[o + 3] = 255;

    // Blue ice is polished; snow and crevasse rims are matte.
    const rg = 200 - pack * 130 + vein * 60;
    ir.data[o] = ir.data[o + 1] = ir.data[o + 2] = rg; ir.data[o + 3] = 255;
  }
  col.putImageData(ic, 0, 0);
  bump.putImageData(ib, 0, 0);
  rough.putImageData(ir, 0, 0);

  return {
    map: toTexture(col, true),
    bumpMap: toTexture(bump),
    roughnessMap: toTexture(rough),
    emissiveMap: null,
  };
}

const BUILDERS = { water: buildWater, fire: buildFire, ice: buildIce };

/**
 * Get (and cache) the generated map set for an element key
 * ('water' | 'fire' | 'ice'). Returns null when unknown or headless.
 */
export function getElementalMaps(kind) {
  if (_cache.has(kind)) return _cache.get(kind);
  const build = BUILDERS[kind];
  if (!build || typeof document === 'undefined') {
    _cache.set(kind, null);
    return null;
  }
  const maps = build();
  _cache.set(kind, maps);
  return maps;
}
