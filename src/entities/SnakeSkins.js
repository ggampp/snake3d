import * as THREE from 'three';

/**
 * Preset snake skins. Each defines body/head colors and an optional `bands`
 * array for striped patterns rendered via vertex colors in TubeBody.
 *
 * bands: array of hex colors cycled every `bandLength` tube-t units.
 */
export const SKINS = {
  cosmic: {
    name: 'Serpente Cósmica',
    emoji: '🔵',
    bodyColor: 0x2fd6c4,
    bodyEmissive: 0x17c4b2,
    headColor: 0x6cffe9,
    headEmissive: 0x2fe6d2,
    emissiveIntensity: 1.05,
    metalness: 0.0,
    roughness: 0.22,
  },
  emerald: {
    name: 'Jiboia Esmeralda',
    emoji: '🟢',
    bodyColor: 0x2a8a3e,
    bodyEmissive: 0x0e4f1c,
    headColor: 0x52d46e,
    headEmissive: 0x1c7a34,
    emissiveIntensity: 0.9,
    metalness: 0.1,
    roughness: 0.3,
  },
  coral: {
    name: 'Cobra Coral',
    emoji: '🔴',
    bodyColor: 0xcc2222,
    bodyEmissive: 0x6a0808,
    headColor: 0xee3333,
    headEmissive: 0x880000,
    emissiveIntensity: 0.8,
    metalness: 0.05,
    roughness: 0.38,
    // alternating bands: red, black, yellow — classic coral snake
    bands: [0xcc2222, 0xcc2222, 0x111111, 0xf0c030, 0x111111],
    bandLength: 0.07,
  },
  blue: {
    name: 'Serpente Azul',
    emoji: '💙',
    bodyColor: 0x1a4db8,
    bodyEmissive: 0x091e60,
    headColor: 0x3d7ae8,
    headEmissive: 0x1a3a90,
    emissiveIntensity: 1.2,
    metalness: 0.35,
    roughness: 0.15,
  },
  cobra: {
    name: 'Cobra Real',
    emoji: '👑',
    bodyColor: 0x8b6820,
    bodyEmissive: 0x3d2e08,
    headColor: 0xc09030,
    headEmissive: 0x6a4810,
    emissiveIntensity: 0.85,
    metalness: 0.25,
    roughness: 0.4,
    // golden-brown bands like a king cobra hood pattern
    bands: [0x8b6820, 0x8b6820, 0x8b6820, 0xe8c050],
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
