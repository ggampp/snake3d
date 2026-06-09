import * as THREE from 'three';
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
  },
};

/** Build a body MeshStandardMaterial for the given skin key. */
export function makeSkinMaterials(skinKey) {
  const s = SKINS[skinKey] || SKINS.cosmic;
  const vertexColors = !!s.bands;

  const bodyMat = new THREE.MeshStandardMaterial({
    color: vertexColors ? 0xffffff : s.bodyColor,
    emissive: new THREE.Color(s.bodyEmissive),
    emissiveIntensity: s.emissiveIntensity,
    roughness: s.roughness,
    metalness: s.metalness,
    vertexColors,
  });

  const headMat = new THREE.MeshStandardMaterial({
    color: s.headColor,
    emissive: new THREE.Color(s.headEmissive),
    emissiveIntensity: s.emissiveIntensity * 1.3,
    roughness: s.roughness,
    metalness: s.metalness,
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
