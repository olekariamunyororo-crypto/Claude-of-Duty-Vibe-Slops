// Sum-of-sines displacement, sun specular, foam ring around the yacht, horizon haze.
import { useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { SUN_DIRECTION } from './Sky';
import type { Quality } from '../store/gameStore';

const SEGS: Record<Quality, number> = { low: 32, med: 64, high: 96 };

export function Ocean({ quality }: { quality: Quality }) {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uSun: { value: SUN_DIRECTION.clone() }, uCam: { value: new THREE.Vector3() } },
    vertexShader: `
      uniform float uTime;
      varying vec3 vWorld; varying vec3 vNormal;
      float waveH(vec2 p, float t){
        float h = 0.0;
        h += sin(p.x*0.055 + t*0.9) * 0.55;
        h += sin(p.y*0.041 - t*0.7) * 0.48;
        h += sin((p.x+p.y)*0.032 + t*0.5) * 0.42;
        h += sin(p.x*0.13 - p.y*0.11 + t*1.4) * 0.16;
        return h;
      }
      void main(){
        vec4 wp = modelMatrix * vec4(position, 1.0);
        float h = waveH(wp.xz, uTime);
        wp.y += h;
        float e = 1.5;
        float hx = waveH(wp.xz + vec2(e,0.0), uTime);
        float hz = waveH(wp.xz + vec2(0.0,e), uTime);
        vNormal = normalize(vec3(h - hx, e, h - hz));
        vWorld = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: `
      uniform vec3 uSun; uniform vec3 uCam; uniform float uTime;
      varying vec3 vWorld; varying vec3 vNormal;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(41.3,289.1)))*43758.5453); }
      void main(){
        vec3 V = normalize(uCam - vWorld);
        vec3 N = normalize(vNormal);
        float fres = pow(1.0 - max(dot(N, V), 0.0), 2.2);
        vec3 col = mix(vec3(0.05,0.22,0.34), vec3(0.55,0.74,0.86), fres);
        vec3 H = normalize(uSun + V);
        col += vec3(1.0, 0.9, 0.7) * pow(max(dot(N, H), 0.0), 220.0) * 1.6;
        float d = length(vWorld.xz);
        float foam = smoothstep(48.0, 38.0, d) * (0.5 + 0.5*sin(d*1.7 - uTime*2.0 + hash(floor(vWorld.xz*0.5))*6.28));
        col = mix(col, vec3(0.92), foam * smoothstep(40.0, 26.0, d) * 0.5);
        col = mix(col, vec3(0.78, 0.86, 0.9), smoothstep(180.0, 620.0, d));
        gl_FragColor = vec4(col, 1.0);
      }`,
  }), []);

  const geo = useMemo(() => new THREE.PlaneGeometry(1500, 1500, SEGS[quality], SEGS[quality]), [quality]);

  useFrame(({ camera }, dt) => {
    (mat.uniforms.uTime.value as number) += dt;
    (mat.uniforms.uCam.value as THREE.Vector3).copy(camera.position);
  });

  return (
    <mesh geometry={geo} rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.4, 0]} frustumCulled={false}>
      <primitive object={mat} attach="material" />
    </mesh>
  );
}
