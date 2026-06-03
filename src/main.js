import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

import { Planet } from './world/Planet.js';
import { Sky } from './world/Sky.js';
import { Grass } from './world/Grass.js';
import { Snake } from './entities/Snake.js';
import { EnergyField } from './entities/EnergyField.js';
import { PowerUpField } from './entities/PowerUpField.js';
import { EnemyWorm } from './entities/EnemyWorm.js';
import { ChaseCamera } from './core/Camera.js';
import { Input } from './core/Input.js';
import { AudioFx } from './core/Audio.js';
import { Leaderboard } from './core/Leaderboard.js';
import { Hud } from './ui/Hud.js';

const PLANET_RADIUS = 20;
const MAX_ENEMIES   = 6;
const BASE_ENEMIES  = 2;
const SHIELD_TIME   = 6;
const TURBO_TIME    = 5;

class Game {
  constructor() {
    this.canvas = document.getElementById('game');
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

    this.input.onConfirm = () => {
      this.audio.resume();
      if (this.state !== 'playing') this.start();
    };
    this.input.onJump = () => {
      this.audio.resume();
      if (this.state === 'playing') {
        this.snake.jump(() => this.audio.jump());
      } else {
        this.start();
      }
    };
    this.input.onZoom = (d) => this.chase.addZoom(d);
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

    this.planet = new Planet(PLANET_RADIUS);
    this.scene.add(this.planet.group);
    this.sky = new Sky();
    this.scene.add(this.sky.group);
    // Grass slightly above planet surface; snake surfaceLift clears it
    this.grass = new Grass(PLANET_RADIUS * 1.001, 1800);
    this.planet.group.add(this.grass.mesh);

    const sun = new THREE.DirectionalLight(0xfff1dc, 2.0);
    sun.position.set(40, 30, 20);
    this.scene.add(sun);
    this.scene.add(new THREE.AmbientLight(0x4a5a7a, 0.7));
    const rim = new THREE.DirectionalLight(0x66ccff, 0.6);
    rim.position.set(-30, -10, -20);
    this.scene.add(rim);

    const skinKey = localStorage.getItem('snake3d.skin') || 'cosmic';
    this.snake = new Snake(PLANET_RADIUS, skinKey);
    this.scene.add(this.snake.group);

    this.energy   = new EnergyField(PLANET_RADIUS);
    this.scene.add(this.energy.group);
    this.powerups = new PowerUpField(PLANET_RADIUS);
    this.scene.add(this.powerups.group);

    this.enemies = [];
    for (let i = 0; i < MAX_ENEMIES; i++) {
      const worm = new EnemyWorm(PLANET_RADIUS);
      worm.group.visible = false;
      this.enemies.push(worm);
      this.scene.add(worm.group);
    }

    this.chase = new ChaseCamera(this.camera, PLANET_RADIUS);
    this._setMenuView();
  }

  _setMenuView() {
    // Far view so the full planet is visible from the menu
    this.camera.position.set(0, 8, 58);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(0, 0, 0);
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
    // Rebuild snake if skin changed
    const skinKey = this.hud.getSkin();
    if (this.snake.skinKey !== skinKey) {
      this.scene.remove(this.snake.group);
      this.snake = new Snake(PLANET_RADIUS, skinKey);
      this.scene.add(this.snake.group);
    }

    this.score  = 0;
    this.kills  = 0;
    this.hud.setScore(0);
    this.hud.setPowerups({});
    this.hud.setStats({ kills: 0 });
    this.snake.reset();
    this.chase.reset();
    this.energy.reset();
    this.powerups.reset();
    this.shieldUntil = 0;
    this.turboUntil  = 0;

    this.activeEnemies = BASE_ENEMIES;
    this.enemies.forEach((worm, i) => {
      const on = i < this.activeEnemies;
      worm.group.visible = on;
      if (on) worm.reset(this.snake.position, 1.1);
    });

    this.state = 'playing';
    this.hud.hide();
  }

  _activateEnemy(i) {
    const worm = this.enemies[i];
    worm.group.visible = true;
    worm.reset(this.snake.position, 1.4);
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
    this.sky.update(dt);
    this.planet.update(dt);

    if (this.state === 'playing') {
      const now = this.clock.elapsedTime;
      const shieldRemain = Math.max(0, this.shieldUntil - now);
      const turboRemain  = Math.max(0, this.turboUntil  - now);
      this.snake.setShield(shieldRemain > 0);
      this.snake.setTurbo(turboRemain > 0);

      this.snake.setDifficulty(this.score);
      this.snake.update(dt, this.input.steer);

      const headR = this.snake.thickness * 1.05;

      this.energy.update(dt, this.snake.position, headR, (growth, score) => {
        this.score += score;
        this.snake.grow(growth);
        this.audio.eat(score);
        this.hud.setScore(this.score);
      });

      this.powerups.update(dt, this.snake.position, headR, (type) => {
        if (type === 'shield') this.shieldUntil = now + SHIELD_TIME;
        else                   this.turboUntil  = now + TURBO_TIME;
        this.audio.powerup(type);
      });

      const desired   = Math.min(MAX_ENEMIES, BASE_ENEMIES + Math.floor(this.score / 6));
      const wormSpeed = Math.min(0.92, 0.42 + this.score * 0.004);
      while (this.activeEnemies < desired) {
        this._activateEnemy(this.activeEnemies++);
      }
      for (let i = 0; i < this.activeEnemies; i++) {
        const worm = this.enemies[i];
        worm.speed = wormSpeed;
        worm.update(dt);
        if (!this.snake.invincible && worm.hits(this.snake.position, headR / PLANET_RADIUS)) {
          this._gameOver();
          break;
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
      for (let i = 0; i < this.activeEnemies; i++) this.enemies[i].update(dt);
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
