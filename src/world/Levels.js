/**
 * Campaign levels. Each level is a different planet: size + theme (surface
 * colours, atmosphere, sky, grass coverage) + a fruit goal to clear it.
 *
 * Everything here is data — the world classes (Planet, Sky, Grass) read these
 * fields, so adding or tweaking a level needs no engine changes. Names and
 * exact numbers are placeholders meant to be tuned later.
 */
export const LEVELS = [
  {
    id: 'meadow',
    name: 'Pradaria',
    radius: 16,
    goal: 8,
    surface: { grass: 0x5a8f2a, dirt: 0x6a4a24, patchScale: 3.0, brightness: 1.6 },
    atmosphere: 0x6ad6ff,
    sky: { top: 0x0a0f1f, bottom: 0x05060d, glow: 0x3a2a5a },
    grass: { color: 0x4b7a1e, coverage: 0.7, density: 1.0 },
    enemies: { base: 2, max: 4, speedMax: 0.7 },
  },
  {
    id: 'desert',
    name: 'Deserto',
    radius: 22,
    goal: 11,
    surface: { grass: 0xc9a24a, dirt: 0x9a6a2e, patchScale: 2.4, brightness: 1.7 },
    atmosphere: 0xffce7a,
    sky: { top: 0x1a1410, bottom: 0x0a0705, glow: 0x6a4a1a },
    grass: { color: 0x9c8a3c, coverage: 0.18, density: 0.6 },
    enemies: { base: 2, max: 5, speedMax: 0.8 },
  },
  {
    id: 'tundra',
    name: 'Mundo Gelado',
    radius: 28,
    goal: 14,
    surface: { grass: 0xdfeaf5, dirt: 0x9fb6c8, patchScale: 2.8, brightness: 1.5 },
    atmosphere: 0xbfe8ff,
    sky: { top: 0x0b1626, bottom: 0x05080f, glow: 0x274a6a },
    grass: { color: 0xbfe0e8, coverage: 0.3, density: 0.7 },
    enemies: { base: 3, max: 5, speedMax: 0.85 },
  },
  {
    id: 'volcano',
    name: 'Planeta Vulcânico',
    radius: 20,
    goal: 16,
    surface: { grass: 0x7a2a20, dirt: 0x301010, patchScale: 3.2, brightness: 1.7 },
    atmosphere: 0xff6a30,
    sky: { top: 0x1a0a08, bottom: 0x080302, glow: 0xff4015 },
    grass: { color: 0x8a3a1a, coverage: 0.25, density: 0.6 },
    enemies: { base: 3, max: 6, speedMax: 0.92 },
  },
  {
    id: 'alien',
    name: 'Mundo Alienígena',
    radius: 34,
    goal: 20,
    surface: { grass: 0x8a3ad6, dirt: 0x3a1a5a, patchScale: 2.6, brightness: 1.7 },
    atmosphere: 0xc06aff,
    sky: { top: 0x140a26, bottom: 0x07040f, glow: 0x7a2acc },
    grass: { color: 0x9a4ae0, coverage: 0.45, density: 0.9 },
    enemies: { base: 3, max: 6, speedMax: 0.95 },
  },
];

const UNLOCK_KEY = 'snake3d.unlocked';

/** Highest unlocked level index (0-based). Level 0 is always unlocked. */
export function getUnlocked() {
  const n = parseInt(localStorage.getItem(UNLOCK_KEY) || '0', 10);
  return Number.isFinite(n) ? Math.max(0, Math.min(LEVELS.length - 1, n)) : 0;
}

/** Record that `index` is reachable; never lowers the stored value. */
export function setUnlocked(index) {
  const cur = getUnlocked();
  const next = Math.max(cur, Math.min(LEVELS.length - 1, index));
  localStorage.setItem(UNLOCK_KEY, String(next));
  return next;
}
