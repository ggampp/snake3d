import * as THREE from 'three';

/**
 * Background sky: a big dome sphere textured with a procedurally painted
 * canvas — vertical gradient, soft nebula clouds and a dense starfield.
 *
 * Painted on the CPU (once per theme/daylight change) instead of a GLSL
 * ShaderMaterial so it renders identically on the WebGPU and WebGL backends
 * of WebGPURenderer, which do not support raw GLSL materials.
 */
export class Sky {
  constructor() {
    this.group = new THREE.Group();
    this._colors = { top: 0x0a0f1f, bottom: 0x05060d, glow: 0x3a2a5a };
    this._daylight = 'day';
    this._buildDome();
  }

  _buildDome(radius = 420) {
    // Headless (tests): no DOM, skip the visual dome entirely.
    if (typeof document === 'undefined') return;

    this._canvas = document.createElement('canvas');
    this._canvas.width = 2048;
    this._canvas.height = 1024;
    this._texture = new THREE.CanvasTexture(this._canvas);
    this._texture.colorSpace = THREE.SRGBColorSpace;

    const geo = new THREE.SphereGeometry(radius, 48, 32);
    const mat = new THREE.MeshBasicMaterial({
      map: this._texture,
      side: THREE.BackSide,
      depthWrite: false,
    });
    this.dome = new THREE.Mesh(geo, mat);
    this.group.add(this.dome);
    this._paint();
  }

  /** Deterministic RNG so stars/nebulae stay put across repaints. */
  static _rng(seed = 1337) {
    let s = seed >>> 0;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 0xffffffff;
    };
  }

  _paint() {
    if (!this._canvas) return;
    const ctx = this._canvas.getContext('2d');
    const W = this._canvas.width;
    const H = this._canvas.height;
    const day = this._daylight === 'day';

    const top = new THREE.Color(this._colors.top);
    const bottom = new THREE.Color(this._colors.bottom);
    const glow = new THREE.Color(this._colors.glow);
    if (day) {
      // Daylight: lift the whole backdrop toward a deep airy blue so the
      // frame reads bright even though we're in space.
      top.lerp(new THREE.Color(0x2a4a80), 0.55);
      bottom.lerp(new THREE.Color(0x16294e), 0.5);
      glow.lerp(new THREE.Color(0x5a7ab8), 0.45);
    }
    const css = (c) => `#${c.getHexString()}`;

    // Vertical gradient (texture top = sky zenith on the dome).
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, css(top));
    grad.addColorStop(1, css(bottom));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Nebula: layered soft radial blobs in the glow color.
    const rng = Sky._rng(90210);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 26; i++) {
      const x = rng() * W;
      const y = rng() * H;
      const r = 90 + rng() * 260;
      const a = (day ? 0.10 : 0.16) * (0.4 + rng() * 0.6);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${(glow.r * 255) | 0},${(glow.g * 255) | 0},${(glow.b * 255) | 0},${a})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }

    // Stars: dense field of tinted points, a few with a visible halo.
    const srng = Sky._rng(4242);
    const starColor = new THREE.Color();
    for (let i = 0; i < 1500; i++) {
      const x = srng() * W;
      const y = srng() * H;
      const t = srng();
      starColor.setHSL(0.55 + t * 0.12, 0.35, 0.75 + srng() * 0.25);
      const size = 0.6 + srng() * 1.8;
      const alpha = (day ? 0.55 : 0.9) * (0.5 + srng() * 0.5);
      ctx.fillStyle = `rgba(${(starColor.r * 255) | 0},${(starColor.g * 255) | 0},${(starColor.b * 255) | 0},${alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
      if (srng() > 0.94) {
        const g = ctx.createRadialGradient(x, y, 0, x, y, size * 6);
        g.addColorStop(0, `rgba(255,255,255,${alpha * 0.35})`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, size * 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalCompositeOperation = 'source-over';

    this._texture.needsUpdate = true;
  }

  update(dt) {
    // Slow drift sells depth and makes the painted stars feel alive.
    this.group.rotation.y += dt * 0.005;
  }

  /** Swap the gradient/glow colours for a level theme. */
  setColors(sky) {
    if (!sky) return;
    if (sky.top != null) this._colors.top = sky.top;
    if (sky.bottom != null) this._colors.bottom = sky.bottom;
    if (sky.glow != null) this._colors.glow = sky.glow;
    this._paint();
  }

  /** 'day' brightens the backdrop; 'night' keeps deep space. */
  setDaylight(mode) {
    if (mode === this._daylight) return;
    this._daylight = mode;
    this._paint();
  }
}
