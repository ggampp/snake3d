/**
 * Campaign levels. Each level is a different real planet: size + theme (surface
 * texture, atmosphere, sky, grass) + a fruit goal to clear it.
 *
 * The surface art comes from real solar-system maps (see PlanetTextures.js).
 * It's a *hybrid* look: habitable worlds (Terra) keep the patchy grass that
 * lies down as the snake passes; the others (Marte, Lua, Vênus, Júpiter, …)
 * are bare textured rock/gas with no grass.
 *
 * Everything here is data — the world classes (Planet, Sky, Grass) read these
 * fields, so adding or tweaking a level needs no engine changes. Names and
 * exact numbers are placeholders meant to be tuned later.
 */

/**
 * Reusable per-planet themes, shared by the campaign and by free-play's surface
 * picker. Keyed by a short id; each maps to a PlanetTextures.js texture key.
 */
export const PLANET_THEMES = {
  terra: {
    name: 'Terra',
    texture: 'earth',
    surface: { brightness: 1.0, roughness: 0.95 },
    atmosphere: 0x6ad6ff,
    atmosphereIntensity: 0.6,
    sky: { top: 0x0a0f1f, bottom: 0x05060d, glow: 0x2a3a6a },
    grass: { color: 0x4b7a1e, coverage: 0.5, density: 1.0 }, // habitable → keep grass
  },
  marte: {
    name: 'Marte',
    texture: 'mars',
    surface: { brightness: 1.05, roughness: 1.0 },
    atmosphere: 0xd2723a,
    atmosphereIntensity: 0.4,
    sky: { top: 0x1a0d08, bottom: 0x0a0503, glow: 0x6a3a1a },
    grass: { coverage: 0 },
  },
  lua: {
    name: 'Lua',
    texture: 'moon',
    surface: { brightness: 1.1, roughness: 1.0 },
    atmosphere: 0x9fb0c8,
    atmosphereIntensity: 0.22,
    sky: { top: 0x05070d, bottom: 0x02030a, glow: 0x1a2740 },
    grass: { coverage: 0 },
  },
  venus: {
    name: 'Vênus',
    texture: 'venus',
    surface: { brightness: 1.05, roughness: 0.9 },
    atmosphere: 0xffc46a,
    atmosphereIntensity: 0.7,
    sky: { top: 0x1a1206, bottom: 0x0a0703, glow: 0x7a5210 },
    grass: { coverage: 0 },
  },
  jupiter: {
    name: 'Júpiter',
    texture: 'jupiter',
    surface: { brightness: 1.0, roughness: 0.85 },
    atmosphere: 0xe8b07a,
    atmosphereIntensity: 0.6,
    sky: { top: 0x140d08, bottom: 0x070403, glow: 0x5a3a1a },
    grass: { coverage: 0 },
  },
  mercurio: {
    name: 'Mercúrio',
    texture: 'mercury',
    surface: { brightness: 1.1, roughness: 1.0 },
    atmosphere: 0xbfae90,
    atmosphereIntensity: 0.25,
    sky: { top: 0x070707, bottom: 0x030303, glow: 0x2a2620 },
    grass: { coverage: 0 },
  },
};

/** Build a campaign level by referencing a shared planet theme. */
const level = (planetKey, radius, goal, enemies) => ({
  id: planetKey,
  ...PLANET_THEMES[planetKey],
  radius,
  goal,
  enemies,
});

export const LEVELS = [
  level('terra', 16, 8, { base: 2, max: 4, speedMax: 0.7 }),
  level('marte', 22, 11, { base: 2, max: 5, speedMax: 0.8 }),
  level('lua', 18, 14, { base: 3, max: 5, speedMax: 0.85 }),
  level('venus', 24, 16, { base: 3, max: 6, speedMax: 0.92 }),
  level('jupiter', 34, 20, { base: 3, max: 6, speedMax: 0.95 }),
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
