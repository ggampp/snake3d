import * as THREE from 'three';

const DEFAULT_THEME = {
  surface: { grass: 0x5a8530, dirt: 0x6a4a2e, patchScale: 3.0, brightness: 1.6 },
  atmosphere: 0x6ad6ff,
};

/**
 * The planet: a shaded sphere with a grass/earth surface and a fresnel
 * atmosphere shell that gives the glowing rim seen in the reference video.
 *
 * Surface colours and the atmosphere tint are driven by a `theme` so each
 * campaign level can look different (desert, ice, volcano, …) without changing
 * the shader. Colours are uniforms, so they can also be swapped at runtime.
 */
export class Planet {
  constructor(radius = 20, theme = DEFAULT_THEME) {
    this.radius = radius;
    this.group = new THREE.Group();
    this.theme = theme;

    this._buildSurface();
    this._buildAtmosphere();
  }

  _buildSurface() {
    const geo = new THREE.SphereGeometry(this.radius, 96, 96);
    const s = this.theme.surface || DEFAULT_THEME.surface;

    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.95,
      metalness: 0.0,
      flatShading: false,
    });

    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = { value: 0 };
      shader.uniforms.uGrass = { value: new THREE.Color(s.grass) };
      shader.uniforms.uDirt = { value: new THREE.Color(s.dirt) };
      shader.uniforms.uPatchScale = { value: s.patchScale ?? 3.0 };
      shader.uniforms.uBrightness = { value: s.brightness ?? 1.6 };
      this._surfaceUniforms = shader.uniforms;
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
           varying vec3 vWorldPos;`
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
           vWorldPos = position;`
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
           varying vec3 vWorldPos;
           uniform vec3 uGrass;
           uniform vec3 uDirt;
           uniform float uPatchScale;
           uniform float uBrightness;
           float hash(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719)))*43758.5453); }`
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
           vec3 n = normalize(vWorldPos);
           float patches = hash(floor(vWorldPos * uPatchScale));
           vec3 surf = mix(uDirt, uGrass, smoothstep(0.25, 0.7, patches));
           surf *= 0.85 + 0.15 * (1.0 - abs(n.y));
           diffuseColor.rgb *= surf * uBrightness;`
        );
    };

    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.receiveShadow = true;
    this.group.add(this.mesh);
  }

  _buildAtmosphere() {
    const geo = new THREE.SphereGeometry(this.radius * 1.32, 64, 64);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.BackSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uColor: { value: new THREE.Color(this.theme.atmosphere ?? DEFAULT_THEME.atmosphere) },
        uPower: { value: 5.5 },
        uIntensity: { value: 0.55 },
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vViewDir;
        void main() {
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vNormal = normalize(normalMatrix * normal);
          vViewDir = normalize(-mvPosition.xyz);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uPower;
        uniform float uIntensity;
        varying vec3 vNormal;
        varying vec3 vViewDir;
        void main() {
          float fres = pow(1.0 - abs(dot(vNormal, vViewDir)), uPower);
          gl_FragColor = vec4(uColor, fres * uIntensity);
        }
      `,
    });
    this.atmosphere = new THREE.Mesh(geo, mat);
    this.group.add(this.atmosphere);
  }

  update(dt) {
    if (this._surfaceUniforms) this._surfaceUniforms.uTime.value += dt;
  }
}
