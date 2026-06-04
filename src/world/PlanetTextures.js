import * as THREE from 'three';

/**
 * Real solar-system surface maps used to texture the campaign planets.
 *
 * The images are equirectangular (2:1) maps that wrap straight onto a
 * SphereGeometry's default UVs. They ship in `public/textures/planets/`.
 *
 * Source: Solar System Scope — https://www.solarsystemscope.com/textures/
 * (via Wikimedia Commons), licensed CC BY 4.0. See CREDITS.md.
 */
export const PLANET_TEXTURES = {
  earth:   { file: 'earth.jpg',   name: 'Terra' },
  mars:    { file: 'mars.jpg',    name: 'Marte' },
  moon:    { file: 'moon.jpg',    name: 'Lua' },
  venus:   { file: 'venus.jpg',   name: 'Vênus' },
  jupiter: { file: 'jupiter.jpg', name: 'Júpiter' },
  mercury: { file: 'mercury.jpg', name: 'Mercúrio' },
};

/** Short credit line shown in the menu and required by the CC BY 4.0 licence. */
export const TEXTURE_ATTRIBUTION = 'Texturas dos planetas: Solar System Scope · CC BY 4.0';
export const TEXTURE_ATTRIBUTION_URL = 'https://www.solarsystemscope.com/textures/';

// Vite injects import.meta.env.BASE_URL; fall back to './' outside the bundler
// (e.g. headless Node tests) so importing this module never throws.
function basePath() {
  try {
    return (import.meta && import.meta.env && import.meta.env.BASE_URL) || './';
  } catch {
    return './';
  }
}

let _loader = null;
const _cache = new Map();

/**
 * Load (and cache) the texture for a planet key, or return null for an unknown
 * key. Safe to call repeatedly — the same THREE.Texture is reused.
 */
export function loadPlanetTexture(key) {
  const meta = PLANET_TEXTURES[key];
  if (!meta) return null;
  if (_cache.has(key)) return _cache.get(key);

  if (!_loader) _loader = new THREE.TextureLoader();
  const tex = _loader.load(`${basePath()}textures/planets/${meta.file}`);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.wrapS = THREE.RepeatWrapping; // equirectangular maps tile around the equator
  _cache.set(key, tex);
  return tex;
}
