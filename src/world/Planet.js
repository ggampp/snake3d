import * as THREE from 'three';

/**
 * The planet: a shaded sphere with a green/earth gradient and a fresnel
 * atmosphere shell that gives the glowing rim seen in the reference video.
 */
export class Planet {
  constructor(radius = 20) {
    this.radius = radius;
    this.group = new THREE.Group();

    this._buildSurface();
    this._buildAtmosphere();
  }

  _buildSurface() {
    const geo = new THREE.SphereGeometry(this.radius, 96, 96);

    // Procedural-ish look without textures: blend grass-green over a darker
    // base by latitude + a little noise, computed in the shader.
    const mat = new THREE.MeshStandardMaterial({
      color: 0x6f8f3a,
      roughness: 0.95,
      metalness: 0.0,
      flatShading: false,
    });

    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = { value: 0 };
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
           float hash(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719)))*43758.5453); }`
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
           vec3 n = normalize(vWorldPos);
           float patches = hash(floor(vWorldPos * 3.0));
           vec3 grass = vec3(0.36, 0.52, 0.18);
           vec3 dirt  = vec3(0.42, 0.34, 0.20);
           vec3 surf = mix(dirt, grass, smoothstep(0.25, 0.7, patches));
           // subtle darkening toward poles for depth
           surf *= 0.85 + 0.15 * (1.0 - abs(n.y));
           diffuseColor.rgb *= surf * 1.6;`
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
        uColor: { value: new THREE.Color(0x6ad6ff) },
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
