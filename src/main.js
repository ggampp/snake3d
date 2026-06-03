import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

import { Planet } from './world/Planet.js';
import { Sky } from './world/Sky.js';
import { Grass } from './world/Grass.js';
import { Snake } from './entities/Snake.js';
import { EnergyField } from './entities/EnergyField.js';
import { EnemyWorm } from './entities/EnemyWorm.js';
import { ChaseCamera } from './core/Camera.js';
import { Input } from './core/Input.js';
import { Hud } from './ui/Hud.js';

const PLANET_RADIUS = 20;
const ENEMY_COUNT = 3;

class Game {
  constructor() {
    this.canvas = document.getElementById('game');
    this._initRenderer();
    this._initScene();
    this._initPost();

    this.input = new Input(this.canvas);
    this.hud = new Hud();

    this.state = 'menu'; // 'menu' | 'playing' | 'dead'
    this.score = 0;

    this.hud.onStart = () => this.start();
    this.input.onConfirm = () => {
      if (this.state !== 'playing') this.start();
    };

    this.clock = new THREE.Clock();
    window.addEventListener('resize', () => this._onResize());

    this.hud.showStart();
    this._loop();

    // Debug/test hook (harmless in production; used by headless e2e tests).
    if (typeof window !== 'undefined') window.__game = this;
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
    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(
      62,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );

    // World
    this.planet = new Planet(PLANET_RADIUS);
    this.scene.add(this.planet.group);

    this.sky = new Sky();
    this.scene.add(this.sky.group);

    this.grass = new Grass(PLANET_RADIUS * 1.005, 1400);
    this.planet.group.add(this.grass.mesh);

    // Lights
    const sun = new THREE.DirectionalLight(0xfff1dc, 2.0);
    sun.position.set(40, 30, 20);
    this.scene.add(sun);
    this.scene.add(new THREE.AmbientLight(0x4a5a7a, 0.7));
    const rim = new THREE.DirectionalLight(0x66ccff, 0.6);
    rim.position.set(-30, -10, -20);
    this.scene.add(rim);

    // Entities
    this.snake = new Snake(PLANET_RADIUS);
    this.scene.add(this.snake.group);

    this.energy = new EnergyField(PLANET_RADIUS);
    this.scene.add(this.energy.group);

    this.enemies = [];
    for (let i = 0; i < ENEMY_COUNT; i++) {
      const worm = new EnemyWorm(PLANET_RADIUS);
      this.enemies.push(worm);
      this.scene.add(worm.group);
    }

    this.chase = new ChaseCamera(this.camera, PLANET_RADIUS);

    // Default (pre-game) framing: the whole planet, held steady.
    this._setMenuView();
  }

  _setMenuView() {
    this.camera.position.set(0, 6, 42);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(0, 0, 0);
  }

  _initPost() {
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.55, // strength
      0.6, // radius
      0.5 // threshold — only bright emissive (snake/food) blooms
    );
    this.composer.addPass(this.bloom);
  }

  start() {
    this.score = 0;
    this.hud.setScore(0);
    this.snake.reset();
    this.chase.reset();
    this.energy.reset();
    for (const worm of this.enemies) worm.reset(this.snake.position, 1.1);
    this.state = 'playing';
    this.hud.hide();
  }

  _gameOver() {
    this.state = 'dead';
    this.snake.die();
    this.hud.showGameOver(this.score, this.snake.segmentCount);
    this._setMenuView();
  }

  _update(dt) {
    this.sky.update(dt);
    this.planet.update(dt);

    if (this.state === 'playing') {
      this.snake.setDifficulty(this.score);
      this.snake.update(dt, this.input.steer);

      // Energy orbs: temporary yellow pickups, proportional growth.
      this.energy.update(
        dt,
        this.snake.position,
        this.snake.thickness * 1.05,
        (growth, score) => {
          this.score += score;
          this.snake.grow(growth);
          this.hud.setScore(this.score);
        }
      );

      // Enemy worms wander; touching one ends the run.
      const extra = this.snake.thickness / PLANET_RADIUS;
      for (const worm of this.enemies) {
        worm.update(dt);
        if (worm.hits(this.snake.position, extra)) {
          this._gameOver();
          break;
        }
      }

      this.hud.setStats({
        length: this.snake.segmentCount,
        speed: this.snake.speed / this.snake.baseSpeed,
      });
      if (this.state === 'playing' && this.snake.checkSelfCollision()) this._gameOver();

      if (this.state === 'playing') {
        this.chase.update(dt, this.snake.position, this.snake.heading);
      }
    } else {
      // Menu / game-over: keep enemies and orbs gently alive in the backdrop.
      for (const worm of this.enemies) worm.update(dt);
      this.energy.update(dt, null, 0, () => {});
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
