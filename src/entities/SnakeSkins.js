import * as THREE from 'three';
import { MeshPhysicalNodeMaterial } from 'three/webgpu';
import { getScaleMaps } from './SnakeTexture.js';

/**
 * Preset snake skins. Each defines body/head colors and an optional `bands`
 * array for striped patterns rendered via vertex colors in TubeBody.
 *
 * bands: array of hex colors cycled every `bandLength` tube-t units.
 *
 * Emissive is kept low so the snake reads as real, lit skin (a procedural
 * scale bump map does the rest) rather than a neon tube — except the "cosmic"
 * skin, which stays a bit glowy on purpose.
 */
export const SKINS = {
  cosmic: {
    name: 'Serpente Cósmica',
    emoji: '🔵',
    bodyColor: 0x2fd6c4,
    bodyEmissive: 0x17c4b2,
    headColor: 0x6cffe9,
    headEmissive: 0x2fe6d2,
    emissiveIntensity: 0.35,
    metalness: 0.0,
    roughness: 0.35,
    eye: 0xd8fff6,
    pupil: 0x04211c,
    tongue: 0xe4573d,
  },
  emerald: {
    name: 'Jiboia Esmeralda',
    emoji: '🟢',
    bodyColor: 0x2e7a3c,
    bodyEmissive: 0x0a3814,
    headColor: 0x46b05e,
    headEmissive: 0x14572a,
    emissiveIntensity: 0.16,
    metalness: 0.05,
    roughness: 0.5,
    // emerald tree boa: green broken by pale dorsal blotches
    bands: [0x2e7a3c, 0x2e7a3c, 0x2e7a3c, 0x57994a, 0x2e7a3c, 0x256a33],
    bandLength: 0.09,
    eye: 0xf2e9be,
    pupil: 0x0e1a15,
    tongue: 0xe4573d,
  },
  coral: {
    name: 'Cobra Coral',
    emoji: '🔴',
    bodyColor: 0xb82020,
    bodyEmissive: 0x4a0606,
    headColor: 0xd22a2a,
    headEmissive: 0x600000,
    emissiveIntensity: 0.14,
    metalness: 0.0,
    roughness: 0.5,
    // alternating bands: red, black, yellow — classic coral snake
    bands: [0xb82020, 0xb82020, 0x141210, 0xe0b22a, 0x141210],
    bandLength: 0.07,
    eye: 0xf7e9c4,
    pupil: 0x160d08,
    tongue: 0xffb4a0,
  },
  blue: {
    name: 'Serpente Azul',
    emoji: '💙',
    bodyColor: 0x1c4aa8,
    bodyEmissive: 0x081a4a,
    headColor: 0x3a6ed4,
    headEmissive: 0x162e74,
    emissiveIntensity: 0.25,
    metalness: 0.3,
    roughness: 0.35,
    eye: 0xdbe6ff,
    pupil: 0x050a18,
    tongue: 0xe4573d,
  },
  cobra: {
    name: 'Cobra Real',
    emoji: '👑',
    bodyColor: 0x84621e,
    bodyEmissive: 0x2e2206,
    headColor: 0xb08428,
    headEmissive: 0x523808,
    emissiveIntensity: 0.16,
    metalness: 0.1,
    roughness: 0.55,
    // golden-brown bands like a king cobra hood pattern
    bands: [0x84621e, 0x84621e, 0x84621e, 0xd8b448, 0x5e4412],
    bandLength: 0.12,
    eye: 0xefe3ac,
    pupil: 0x181405,
    tongue: 0xe4573d,
  },

  // --- Species ported from slither-charts (slither-charts.amanv.dev) ---
  python: {
    name: 'Píton Dourada',
    emoji: '🐍',
    bodyColor: 0xd9a441,
    bodyEmissive: 0x3a2808,
    headColor: 0xe0b055,
    headEmissive: 0x4a3410,
    emissiveIntensity: 0.14,
    metalness: 0.05,
    roughness: 0.55,
    // diamond-back markings approximated as dark saddles over gold
    bands: [0xd9a441, 0xd9a441, 0x5c3d14, 0xd9a441, 0xf4e3b2, 0x5c3d14],
    bandLength: 0.08,
    eye: 0xf6e7a2,
    pupil: 0x241505,
    tongue: 0xe4573d,
  },
  mamba: {
    name: 'Mamba Cinzenta',
    emoji: '🌿',
    bodyColor: 0x8fa69b,
    bodyEmissive: 0x1e2622,
    headColor: 0xa8bdb1,
    headEmissive: 0x2c3a33,
    emissiveIntensity: 0.12,
    metalness: 0.1,
    roughness: 0.45,
    eye: 0xefe9d4,
    pupil: 0x10150f,
    tongue: 0x3b4a42,
  },
  krait: {
    name: 'Krait Azul',
    emoji: '⚡',
    bodyColor: 0x3671f0,
    bodyEmissive: 0x0c1e52,
    headColor: 0x5a8cff,
    headEmissive: 0x16307e,
    emissiveIntensity: 0.28,
    metalness: 0.25,
    roughness: 0.35,
    // deployment-blue with darker dorsal banding
    bands: [0x3671f0, 0x3671f0, 0x1e3f9e, 0x3671f0, 0x9db9ff, 0x1e3f9e],
    bandLength: 0.09,
    eye: 0xdbe6ff,
    pupil: 0x050a18,
    tongue: 0xe4573d,
  },
  rattler: {
    name: 'Cascavel',
    emoji: '🪇',
    bodyColor: 0xb99c6b,
    bodyEmissive: 0x2e2410,
    headColor: 0xc9ac78,
    headEmissive: 0x3a2e14,
    emissiveIntensity: 0.12,
    metalness: 0.0,
    roughness: 0.6,
    // desert diamonds: tan broken by dark brown saddles
    bands: [0xb99c6b, 0xb99c6b, 0x57402a, 0xb99c6b, 0xebdcb8, 0x57402a],
    bandLength: 0.1,
    eye: 0xf2e3b4,
    pupil: 0x1c1206,
    tongue: 0xe4573d,
  },
  ghost: {
    name: 'Serpente Fantasma',
    emoji: '👻',
    bodyColor: 0xe8e0da,
    bodyEmissive: 0x3a3236,
    headColor: 0xfdfbf7,
    headEmissive: 0x4a4046,
    emissiveIntensity: 0.2,
    metalness: 0.0,
    roughness: 0.4,
    // albino: faint mauve blotches over bone-white
    bands: [0xe8e0da, 0xe8e0da, 0xe8e0da, 0xc9b8c4, 0xe8e0da, 0xfdfbf7],
    bandLength: 0.11,
    eye: 0xe4573d,
    pupil: 0x7a1e14,
    tongue: 0xe4a0a0,
  },
};

/** Build a body MeshStandardMaterial for the given skin key. */
export function makeSkinMaterials(skinKey) {
  const s = SKINS[skinKey] || SKINS.cosmic;
  const vertexColors = !!s.bands;

  // ghost gets a pearly iridescent sheen like an opal
  const iridescent = skinKey === 'cosmic' || skinKey === 'blue' || skinKey === 'ghost';
  const sheenColor = new THREE.Color(s.headColor).lerp(new THREE.Color(0xffffff), 0.4);

  const bodyMat = new MeshPhysicalNodeMaterial({
    color: vertexColors ? 0xffffff : s.bodyColor,
    emissive: new THREE.Color(s.bodyEmissive),
    emissiveIntensity: s.emissiveIntensity,
    roughness: s.roughness,
    metalness: s.metalness,
    vertexColors,
    clearcoat: 0.6,
    clearcoatRoughness: 0.25,
    sheen: 0.5,
    sheenColor,
    sheenRoughness: 0.6,
    iridescence: iridescent ? 0.8 : 0.0,
    iridescenceIOR: 1.3,
  });

  const headMat = new MeshPhysicalNodeMaterial({
    color: s.headColor,
    emissive: new THREE.Color(s.headEmissive),
    emissiveIntensity: s.emissiveIntensity * 1.3,
    roughness: s.roughness,
    metalness: s.metalness,
    clearcoat: 0.6,
    clearcoatRoughness: 0.25,
    sheen: 0.5,
    sheenColor,
    sheenRoughness: 0.6,
    iridescence: iridescent ? 0.8 : 0.0,
    iridescenceIOR: 1.3,
  });

  // Procedural scale maps: albedo detail (multiplies the skin color), keeled
  // scale relief and per-scale gloss. No-op in headless tests (no DOM).
  const maps = getScaleMaps();
  if (maps) {
    bodyMat.map = maps.map;
    bodyMat.bumpMap = maps.bump;
    bodyMat.bumpScale = 0.12;
    bodyMat.roughnessMap = maps.rough;
    bodyMat.roughness = Math.min(1, s.roughness + 0.25); // the map modulates down

    // Head scales: separate clones repeated to fit the small sphere UVs.
    const rep = (t) => {
      const c = t.clone();
      c.needsUpdate = true;
      c.repeat.set(4, 3);
      return c;
    };
    headMat.map = rep(maps.map);
    headMat.bumpMap = rep(maps.bump);
    headMat.bumpScale = 0.09;
    headMat.roughnessMap = rep(maps.rough);
    headMat.roughness = Math.min(1, s.roughness + 0.25);
  }

  return { bodyMat, headMat };
}

/** Return the band color (THREE.Color) at tube parameter t ∈ [0,1]. */
export function getBandColor(skinKey, t) {
  const s = SKINS[skinKey];
  if (!s || !s.bands) return null;
  const bands = s.bands;
  const phase = (t / s.bandLength) % bands.length;
  const idx = Math.floor(phase) % bands.length;
  return new THREE.Color(bands[idx]);
}
