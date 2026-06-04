import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

import { Planet } from './world/Planet.js';
import { Sky } from './world/Sky.js';
import { Grass } from './world/Grass.js';
import { LEVELS, PLANET_THEMES, getUnlocked, setUnlocked } from './world/Levels.js';
import { Snake } from './entities/Snake.js';
import { EnergyField } from './entities/EnergyField.js';
import { PowerUpField } from './entities/PowerUpField.js';
import { EnemyWorm } from './entities/EnemyWorm.js';
import { Explosions } from './entities/Explosions.js';
import { ChaseCamera } from './core/Camera.js';
import { Input } from './core/Input.js';
import { AudioFx } from './core/Audio.js';
import { Leaderboard } from './core/Leaderboard.js';
import { Hud } from './ui/Hud.js';

const DEFAULT_PLANET_SIZE = 'medium';
const PLANET_SIZES = { small: 16, medium: 20, large: 26 };
const MENU_VIEWS = {
  near: { distance: 46, zoom: 2.2 },
  normal: { distance: 58, zoom: 3.5 },
  far: { distance: 72, zoom: 4.8 },
};

// Theme used by the free-play mode (a lush grassland, any planet size).
const FREE_THEME = {
  surface: { grass: 0x5a8530, dirt: 0x6a4a2e, patchScale: 3.0, brightness: 1.6 },
  atmosphere: 0x6ad6ff,
  sky: { top: 0x0a0f1f, bottom: 0x05060d, glow: 0x3a2a5a },
  grass: { color: 0x4b7a1e, coverage: 0.65, density: 1.0 },
};

const MAX_ENEMIES   = 6;
const BASE_ENEMIES  = 2;
const SHIELD_TIME   = 6;
const TURBO_TIME    = 5;

class Game {
  constructor() {
    this.canvas = document.getElementById('game');

    this.mode = localStorage.getItem('snake3d.mode') || 'campaign';
    this.levelIndex = Math.min(getUnlocked(), LEVELS.length - 1);

    // Active world setup (radius / theme / goal / enemy config).
    this.planetRadius = this._loadPlanetRadius();
    this.theme = FREE_THEME;
    this.goal = 0;
    this.fruits = 0;
    this.enemyCfg = { base: BASE_ENEMIES, max: MAX_ENEMIES, speedMax: 0.92 };
    this._builtKey = '';

    this._initRenderer();
    this._initScene();
    this._initPost();

    this.input       = new Input(this.canvas);
    this.audio       = new AudioFx();
    this.leaderboard = new Leaderboard();
    this.hud         = new Hud();
    this.hud.setMuted(this.audio.muted);

    this.state         = 'menu';
    this.score         = 0;
    this.kills         = 0;
    this.activeEnemies = BASE_ENEMIES;
    this.shieldUntil   = 0;
    this.turboUntil    = 0;
    this._board        = [];

    this._wireControls();

    this.clock = new THREE.Clock();
    window.addEventListener('resize', () => this._onResize());

    // Sync the menu UI with the saved mode/level and show the matching planet.
    this.hud.setMode(this.mode);
    this.hud.setLevelInfo(this._levelMenuInfo());
    this._applySetup();

    this._refreshBoard();
    this.hud.showStart(this._board);
    this._loop();

    if (typeof window !== 'undefined') window.__game = this;
  }

  _wireControls() {
    this.hud.onStart = () => {
      this.audio.resume();
      this.start();
    };
    this.hud.onMuteToggle = () => this.hud.setMuted(this.audio.toggleMute());
    this.hud.onZoom       = (d) => this.chase.addZoom(d);
    this.hud.onMenuViewChange = () => this._setMenuView();

    this.hud.onPlanetSizeChange = () => {
      if (this.state === 'playing' || this.state === 'paused') return;
      this._applySetup();
      this._setMenuView();
    };

    this.hud.onFreeSurfaceChange = () => {
      if (this.state === 'playing' || this.state === 'paused') return;
      this._applySetup();
      this._setMenuView();
    };

    this.hud.onModeChange = (mode) => {
      if (this.state === 'playing' || this.state === 'paused') return;
      this.mode = mode;
      localStorage.setItem('snake3d.mode', mode);
      this.hud.setLevelInfo(this._levelMenuInfo());
      this._applySetup();
      this._setMenuView();
    };

    this.hud.onLevelChange = (delta) => {
      if (this.state === 'playing' || this.state === 'paused') return;
      const unlocked = getUnlocked();
      const next = Math.max(0, Math.min(unlocked, this.levelIndex + delta));
      if (next === this.levelIndex) return;
      this.levelIndex = next;
      this.hud.setLevelInfo(this._levelMenuInfo());
      this._applySetup();
      this._setMenuView();
    };

    this.hud.onNextLevel = () => {
      this.audio.resume();
      this._goToNextLevel();
    };

    this.input.onConfirm = () => {
      this.audio.resume();
      if (this.state === 'menu' || this.state === 'dead') this.start();
      else if (this.state === 'levelComplete') this._goToNextLevel();
    };
    this.input.onJump = () => {
      this.audio.resume();
      if (this.state === 'playing') {
        this.snake.jump(() => this.audio.jump());
      } else if (this.state === 'menu' || this.state === 'dead') {
        this.start();
      }
    };
    this.input.onPause = () => this._togglePause();
    this.input.onZoom = (d) => this.chase.addZoom(d);
    this.input.bindForwardButton(document.getElementById('btn-forward'));
  }

  _togglePause() {
    if (this.state === 'playing') {
      this.state = 'paused';
      this._pauseEl = this._pauseEl || document.getElementById('pause-overlay');
      if (this._pauseEl) this._pauseEl.classList.remove('hidden');
    } else if (this.state === 'paused') {
      this.state = 'playing';
      if (this._pauseEl) this._pauseEl.classList.add('hidden');
    }
  }

  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
  }

  _initScene() {
    this.scene  = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1000);

    this.worldObjects = [];

    this.planet = new Planet(this.planetRadius, this.theme);
    this.scene.add(this.planet.group);
    this.worldObjects.push(this.planet.group);

    this.sky = new Sky();
    this.scene.add(this.sky.group);

    this.grass = new Grass(this.planetRadius * 1.001, this._grassCount(this.planetRadius), this.theme.grass);
    this.planet.group.add(this.grass.mesh);

    const sun = new THREE.DirectionalLight(0xfff1dc, 2.0);
    sun.position.set(40, 30, 20);
    this.scene.add(sun);
    this.scene.add(new THREE.AmbientLight(0x4a5a7a, 0.7));
    const rim = new THREE.DirectionalLight(0x66ccff, 0.6);
    rim.position.set(-30, -10, -20);
    this.scene.add(rim);

    const skinKey = localStorage.getItem('snake3d.skin') || 'cosmic';
    this.snake = new Snake(this.planetRadius, skinKey);
    this.scene.add(this.snake.group);
    this.worldObjects.push(this.snake.group);

    this.energy = new EnergyField(this.planetRadius);
    this.scene.add(this.energy.group);
    this.worldObjects.push(this.energy.group);
    this.powerups = new PowerUpField(this.planetRadius);
    this.scene.add(this.powerups.group);
    this.worldObjects.push(this.powerups.group);

    this.enemies = [];
    for (let i = 0; i < MAX_ENEMIES; i++) {
      const worm = new EnemyWorm(this.planetRadius);
      worm.group.visible = false;
      worm._dead = false;
      worm.respawnIn = 0;
      this.enemies.push(worm);
      this.scene.add(worm.group);
      this.worldObjects.push(worm.group);
    }

    this.explosions = new Explosions();
    this.scene.add(this.explosions.group);
    this.worldObjects.push(this.explosions.group);

    this.chase = new ChaseCamera(this.camera, this.planetRadius);
    this.sky.setColors(this.theme.sky);
    // The initial world is the default (free) theme; leave the key empty so the
    // first _applySetup() rebuilds to the selected mode/level.
    this._builtKey = '';
  }

  /** Resolve the world parameters for the current mode + menu selection. */
  _setup() {
    if (this.mode === 'campaign') {
      const lvl = LEVELS[this.levelIndex] || LEVELS[0];
      return {
        radius: lvl.radius,
        theme: lvl,
        goal: lvl.goal,
        enemies: lvl.enemies || { base: BASE_ENEMIES, max: MAX_ENEMIES, speedMax: 0.92 },
        themeId: lvl.id,
      };
    }
    const surface = this.hud ? this.hud.getFreeSurface() : 'pradaria';
    const theme = surface === 'pradaria' ? FREE_THEME : PLANET_THEMES[surface] || FREE_THEME;
    return {
      radius: this.hud ? this.hud.getPlanetRadius() : this.planetRadius,
      theme,
      goal: 0,
      enemies: { base: BASE_ENEMIES, max: MAX_ENEMIES, speedMax: 0.92 },
      themeId: `free:${surface}`,
    };
  }

  _setupKey(skinKey) {
    const s = this._setup();
    return `${s.radius}:${s.themeId}:${skinKey || (this.hud && this.hud.getSkin())}`;
  }

  _levelMenuInfo() {
    const lvl = LEVELS[this.levelIndex] || LEVELS[0];
    return {
      index: this.levelIndex,
      total: LEVELS.length,
      name: lvl.name,
      unlocked: getUnlocked(),
      goal: lvl.goal,
    };
  }

  /**
   * Rebuild the world to match the current setup if anything changed (radius,
   * theme or skin). Cheap no-op when nothing changed.
   */
  _applySetup() {
    const skinKey = this.hud ? this.hud.getSkin() : (localStorage.getItem('snake3d.skin') || 'cosmic');
    const key = this._setupKey(skinKey);
    if (key === this._builtKey) return;
    const setup = this._setup();
    this._rebuildWorld(setup.radius, skinKey, setup.theme);
    this.theme = setup.theme;
    this.goal = setup.goal;
    this.enemyCfg = setup.enemies;
    this._builtKey = key;
  }

  _setMenuView() {
    const key = this.hud?.getMenuView?.() || localStorage.getItem('snake3d.view') || 'normal';
    const view = MENU_VIEWS[key] || MENU_VIEWS.normal;
    const scale = this.planetRadius / PLANET_SIZES.medium;
    this.camera.position.set(0, 8 * scale, view.distance * scale);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(0, 0, 0);
  }

  _loadPlanetRadius() {
    const key = localStorage.getItem('snake3d.planetSize') || DEFAULT_PLANET_SIZE;
    return PLANET_SIZES[key] || PLANET_SIZES[DEFAULT_PLANET_SIZE];
  }

  _grassCount(radius) {
    return Math.round(1800 * (radius / PLANET_SIZES.medium) ** 2);
  }

  _rebuildWorld(radius, skinKey, theme = FREE_THEME) {
    for (const obj of this.worldObjects || []) this.scene.remove(obj);
    this.planetRadius = radius;
    this.worldObjects = [];

    this.planet = new Planet(radius, theme);
    this.scene.add(this.planet.group);
    this.worldObjects.push(this.planet.group);
    this.grass = new Grass(radius * 1.001, this._grassCount(radius), theme.grass);
    this.planet.group.add(this.grass.mesh);
    this.sky.setColors(theme.sky);

    this.snake = new Snake(radius, skinKey);
    this.scene.add(this.snake.group);
    this.worldObjects.push(this.snake.group);

    this.energy = new EnergyField(radius);
    this.scene.add(this.energy.group);
    this.worldObjects.push(this.energy.group);

    this.powerups = new PowerUpField(radius);
    this.scene.add(this.powerups.group);
    this.worldObjects.push(this.powerups.group);

    this.enemies = [];
    for (let i = 0; i < MAX_ENEMIES; i++) {
      const worm = new EnemyWorm(radius);
      worm.group.visible = false;
      worm._dead = false;
      worm.respawnIn = 0;
      this.enemies.push(worm);
      this.scene.add(worm.group);
      this.worldObjects.push(worm.group);
    }

    this.explosions = new Explosions();
    this.scene.add(this.explosions.group);
    this.worldObjects.push(this.explosions.group);
    this.chase = new ChaseCamera(this.camera, radius);
  }

  _initPost() {
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.55, 0.6, 0.5
    );
    this.composer.addPass(this.bloom);
  }

  async _refreshBoard() {
    this._board = await this.leaderboard.getTop(10);
    if (this.state === 'menu') this.hud.renderBoard(this._board);
    else if (this.state === 'dead') this.hud.renderBoard(this._board, undefined, this.score);
  }

  start() {
    // Make sure the world matches the selected mode/level/skin.
    this._applySetup();

    const setup = this._setup();
    this.goal = setup.goal;
    this.enemyCfg = setup.enemies;

    const menuView = MENU_VIEWS[this.hud.getMenuView()] || MENU_VIEWS.normal;
    this.chase.setZoom(menuView.zoom);

    this.score  = 0;
    this.kills  = 0;
    this.fruits = 0;
    this.hud.setScore(0);
    this.hud.setPowerups({});
    this.hud.setStats({ kills: 0 });
    this.hud.setGoal(this.mode === 'campaign' ? { collected: 0, goal: this.goal, name: LEVELS[this.levelIndex].name } : null);
    this.snake.reset();
    this.chase.reset();
    this.energy.reset();
    this.powerups.reset();
    this.shieldUntil = 0;
    this.turboUntil  = 0;

    this.activeEnemies = this.enemyCfg.base;
    this.enemies.forEach((worm, i) => {
      const on = i < this.activeEnemies;
      worm.group.visible = on;
      worm._dead = false;
      worm.respawnIn = 0;
      if (on) worm.reset(this.snake.position, 1.1);
    });

    this.state = 'playing';
    this.hud.hide();
  }

  _activateEnemy(i) {
    const worm = this.enemies[i];
    worm.group.visible = true;
    worm._dead = false;
    worm.respawnIn = 0;
    worm.reset(this.snake.position, 1.4);
  }

  /** Destroy an enemy worm: explosion, score, and a trail of fruit pickups. */
  _killEnemy(i) {
    const worm = this.enemies[i];
    if (worm._dead) return;
    worm._dead = true;
    worm.group.visible = false;
    worm.respawnIn = 3 + Math.random() * 2;
    this.kills++;
    this.audio.death();

    const lift = this.planetRadius + worm.surfaceLift;
    const at = worm.position.clone().multiplyScalar(lift);
    this.explosions.trigger(at, 0xff4d6d);

    const segs = worm.segments;
    const stepN = Math.max(1, Math.floor(segs.length / 6));
    for (let k = 0; k < segs.length; k += stepN) {
      this.energy.spawnAt(segs[k], 1 + (k % 2 === 0 ? 1 : 0));
    }
  }

  /** Campaign: clear the level once the fruit goal is reached. */
  _levelComplete() {
    this.state = 'levelComplete';
    this.snake.setTurbo(false);
    const isLast = this.levelIndex >= LEVELS.length - 1;
    if (!isLast) setUnlocked(this.levelIndex + 1);
    this.audio.powerup('shield');
    this._setMenuView();
    this.hud.showLevelComplete({
      name: LEVELS[this.levelIndex].name,
      score: this.score,
      isLast,
      nextName: isLast ? null : LEVELS[this.levelIndex + 1].name,
    });
  }

  /** Advance to the next campaign level (or back to menu after the last). */
  _goToNextLevel() {
    if (this.state !== 'levelComplete') return;
    const isLast = this.levelIndex >= LEVELS.length - 1;
    this.hud.hideLevelComplete();
    if (isLast) {
      this.state = 'menu';
      this.levelIndex = 0;
      this.hud.setLevelInfo(this._levelMenuInfo());
      this._applySetup();
      this._setMenuView();
      this.hud.showStart(this._board);
      return;
    }
    this.levelIndex += 1;
    this.hud.setLevelInfo(this._levelMenuInfo());
    this.start();
  }

  _gameOver() {
    this.state = 'dead';
    this.snake.die();
    this.audio.death();
    this.hud.showGameOver(this.score, this.snake.segmentCount, this._board);
    this._setMenuView();

    this.leaderboard.submit(this.hud.getName(), this.score).then((top) => {
      if (top && top.length) this._board = top;
      this.hud.renderBoard(this._board, undefined, this.score);
    });
  }

  _update(dt) {
    // Paused / level-complete: freeze the world (frame still re-rendered).
    if (this.state === 'paused') return;

    this.sky.update(dt);
    this.planet.update(dt);
    this.explosions.update(dt);

    if (this.state === 'playing') {
      const now = this.clock.elapsedTime;
      const shieldRemain = Math.max(0, this.shieldUntil - now);
      const turboRemain  = Math.max(0, this.turboUntil  - now);
      this.snake.setShield(shieldRemain > 0);
      this.snake.setTurbo(turboRemain > 0);

      this.snake.setDifficulty(this.score);
      const moving = this.input.forward;
      this.snake.update(dt, this.input.steer, moving);

      const headR = this.snake.thickness * 1.05;
      const headAngle = headR / this.planetRadius;

      this.energy.update(dt, this.snake.position, headR, (growth, score) => {
        this.score += score;
        this.fruits += 1;
        this.snake.grow(growth);
        this.snake.swallow();
        this.audio.eat(score);
        this.hud.setScore(this.score);
        if (this.mode === 'campaign') {
          this.hud.setGoal({ collected: this.fruits, goal: this.goal, name: LEVELS[this.levelIndex].name });
          if (this.fruits >= this.goal) this._levelComplete();
        }
      });

      if (this.state !== 'playing') return; // level cleared mid-frame

      this.powerups.update(dt, this.snake.position, headR, (type) => {
        if (type === 'shield') this.shieldUntil = now + SHIELD_TIME;
        else                   this.turboUntil  = now + TURBO_TIME;
        this.audio.powerup(type);
      });

      const ecfg = this.enemyCfg;
      const desired   = Math.min(ecfg.max, ecfg.base + Math.floor(this.score / 6));
      const wormSpeed = Math.min(ecfg.speedMax, 0.42 + this.score * 0.004);
      while (this.activeEnemies < desired) {
        this._activateEnemy(this.activeEnemies++);
      }

      for (let i = 0; i < this.activeEnemies; i++) {
        const worm = this.enemies[i];
        if (worm._dead) {
          worm.respawnIn -= dt;
          if (worm.respawnIn <= 0) this._activateEnemy(i);
          continue;
        }
        worm.speed = wormSpeed;
        worm.update(dt);

        if (!this.snake.invincible && worm.hits(this.snake.position, headAngle)) {
          this._gameOver();
          break;
        }
        if (worm.touches(this.snake.segments, headR / this.planetRadius, 4)) {
          this._killEnemy(i);
        }
      }

      if (this.state === 'playing') {
        for (let i = 0; i < this.activeEnemies; i++) {
          const a = this.enemies[i];
          if (a._dead) continue;
          for (let j = i + 1; j < this.activeEnemies; j++) {
            const b = this.enemies[j];
            if (b._dead) continue;
            if (a.touches(b.segments, b.thickness / this.planetRadius, 0)) {
              this._killEnemy(i);
              this._killEnemy(j);
              break;
            }
          }
        }
      }

      this.hud.setStats({
        length: this.snake.segmentCount,
        speed:  this.snake.speed / this.snake.baseSpeed,
        kills:  this.kills,
      });
      this.hud.setPowerups({ shield: shieldRemain, turbo: turboRemain });

      if (this.state === 'playing' && this.snake.checkSelfCollision()) this._gameOver();
      if (this.state === 'playing') {
        this.chase.update(dt, this.snake.position, this.snake.heading);
      }
    } else {
      for (let i = 0; i < this.activeEnemies; i++) {
        if (!this.enemies[i]._dead) this.enemies[i].update(dt);
      }
      this.energy.update(dt, null, 0, () => {});
      this.powerups.update(dt, null, 0, () => {});
      this._setMenuView();
    }
  }

  _loop() {
    requestAnimationFrame(() => this._loop());
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this._update(dt);
    this.composer.render();
  }

  _onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.bloom.setSize(w, h);
  }
}

new Game();
