import * as THREE from 'three';

/**
 * Background: a large starfield (Points) plus a soft nebula painted onto the
 * inside of a sky sphere with an additive shader. Sits far behind everything.
 */
export class Sky {
  constructor() {
    this.group = new THREE.Group();
    this._buildStars();
    this._buildNebula();
  }

  _buildStars(count = 2400, radius = 400) {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const c = new THREE.Color();

    for (let i = 0; i < count; i++) {
      // Random point on a far sphere.
      const u = Math.random() * 2 - 1;
      const phi = Math.random() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      positions[i * 3] = radius * r * Math.cos(phi);
      positions[i * 3 + 1] = radius * u;
      positions[i * 3 + 2] = radius * r * Math.sin(phi);

      const t = Math.random();
      c.setHSL(0.55 + t * 0.1, 0.4, 0.6 + Math.random() * 0.35);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
      sizes[i] = 1 + Math.random() * 2.5;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));

    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 } },
      vertexShader: `
        attribute float aSize;
        varying vec3 vColor;
        uniform float uTime;
        void main() {
          vColor = color;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          float tw = 0.7 + 0.3 * sin(uTime * 2.0 + position.x * 0.5 + position.y);
          gl_PointSize = aSize * tw * (300.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.0, d);
          gl_FragColor = vec4(vColor, a);
        }
      `,
      vertexColors: true,
    });

    this.stars = new THREE.Points(geo, mat);
    this._starUniforms = mat.uniforms;
    this.group.add(this.stars);
  }

  _buildNebula(radius = 420) {
    const geo = new THREE.SphereGeometry(radius, 32, 32);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uTop: { value: new THREE.Color(0x0a0f1f) },
        uBottom: { value: new THREE.Color(0x05060d) },
        uGlow: { value: new THREE.Color(0x3a2a5a) },
      },
      vertexShader: `
        varying vec3 vPos;
        void main() {
          vPos = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uTop;
        uniform vec3 uBottom;
        uniform vec3 uGlow;
        varying vec3 vPos;
        float hash(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719)))*43758.5453); }
        // Smoothly interpolated value noise (trilinear) — avoids blocky cells.
        float vnoise(vec3 p){
          vec3 i = floor(p);
          vec3 f = fract(p);
          f = f*f*(3.0-2.0*f);
          float n000=hash(i+vec3(0,0,0)), n100=hash(i+vec3(1,0,0));
          float n010=hash(i+vec3(0,1,0)), n110=hash(i+vec3(1,1,0));
          float n001=hash(i+vec3(0,0,1)), n101=hash(i+vec3(1,0,1));
          float n011=hash(i+vec3(0,1,1)), n111=hash(i+vec3(1,1,1));
          float nx00=mix(n000,n100,f.x), nx10=mix(n010,n110,f.x);
          float nx01=mix(n001,n101,f.x), nx11=mix(n011,n111,f.x);
          return mix(mix(nx00,nx10,f.y), mix(nx01,nx11,f.y), f.z);
        }
        float fbm(vec3 p){
          float s=0.0, a=0.5;
          for(int k=0;k<4;k++){ s+=a*vnoise(p); p*=2.0; a*=0.5; }
          return s;
        }
        void main() {
          float h = vPos.y * 0.5 + 0.5;
          vec3 col = mix(uBottom, uTop, h);
          // soft, cloudy nebula
          float n = fbm(vPos * 3.0);
          float band = smoothstep(0.45, 0.85, n);
          col += uGlow * band * 0.7;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    this.nebula = new THREE.Mesh(geo, mat);
    this.group.add(this.nebula);
  }

  update(dt) {
    if (this._starUniforms) this._starUniforms.uTime.value += dt;
    this.group.rotation.y += dt * 0.005;
  }

  /** Swap the nebula gradient/glow colours for a level theme. */
  setColors(sky) {
    if (!sky || !this.nebula) return;
    const u = this.nebula.material.uniforms;
    if (sky.top != null) u.uTop.value.setHex(sky.top);
    if (sky.bottom != null) u.uBottom.value.setHex(sky.bottom);
    if (sky.glow != null) u.uGlow.value.setHex(sky.glow);
  }
}
