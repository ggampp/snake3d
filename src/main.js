import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

import { Planet } from './world/Planet.js';
import { Sky } from './world/Sky.js';
import { Grass } from './world/Grass.js';
import { Snake } from './entities/Snake.js';
import { Food } from './entities/Food.js';
import { ChaseCamera } from './core/Camera.js';
import { Input } from './core/Input.js';
import { Hud } from './ui/Hud.js';

const PLANET_RADIUS = 20;

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
    this.camera.position.set(0, 30, 30);

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

    this.food = new Food(PLANET_RADIUS);
    this.scene.add(this.food.group);

    this.chase = new ChaseCamera(this.camera, PLANET_RADIUS);
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
    this.food.respawn(this.snake.position);
    this.state = 'playing';
    this.hud.hide();
  }

  _gameOver() {
    this.state = 'dead';
    this.snake.die();
    this.hud.showGameOver(this.score, this.snake.segmentCount);
  }

  _eatAngle() {
    // Head + food radii expressed as an angle on the sphere.
    return (this.snake.thickness * 1.1 + 0.5) / PLANET_RADIUS;
  }

  _update(dt) {
    this.sky.update(dt);
    this.planet.update(dt);
    this.food.update(dt);

    if (this.state === 'playing') {
      this.snake.setDifficulty(this.score);
      this.snake.update(dt, this.input.steer);

      // Eat?
      if (this.food.isEatenBy(this.snake.position, this._eatAngle())) {
        this.score += 1;
        this.snake.grow(2);
        this.food.respawn(this.snake.position);
        this.hud.setScore(this.score);
      }

      // Stats + collision.
      this.hud.setStats({
        length: this.snake.segmentCount,
        speed: this.snake.speed / this.snake.baseSpeed,
      });
      if (this.snake.checkSelfCollision()) this._gameOver();

      this.chase.update(dt, this.snake.position, this.snake.heading);
    } else {
      // Idle: slow orbit so the menu/death screen isn't static.
      const t = this.clock.elapsedTime * 0.15;
      this.camera.position.set(
        Math.cos(t) * 42,
        18,
        Math.sin(t) * 42
      );
      this.camera.up.set(0, 1, 0);
      this.camera.lookAt(0, 0, 0);
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
