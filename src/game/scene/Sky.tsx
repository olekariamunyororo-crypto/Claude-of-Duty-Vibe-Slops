// Gradient dome + FBM clouds + sun disk. SUN_DIRECTION is shared with lighting.
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { Quality } from '../store/gameStore';

export const SUN_DIRECTION = new THREE.Vector3(0.45, 0.55, 0.3).normalize();

const OCTAVES: Record<Quality, number> = { low: 0, med: 1, high: 2 };

export function Sky({ quality }: { quality: Quality }) {
  const ref = useRef<THREE.Mesh>(null);
  const mat = useMemo(() => new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: { uSun: { value: SUN_DIRECTION.clone() }, uTime: { value: 0 }, uOct: { value: OCTAVES[quality] } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `
      varying vec3 vDir; uniform vec3 uSun; uniform float uTime; uniform float uOct;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
      float fbm(vec2 p){ float v=0.0,a=0.5; for(int i=0;i<2;i++){ v+=a*noise(p); p*=2.13; a*=0.5; } return v; }
      void main(){
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 col = mix(vec3(0.86,0.93,0.97), vec3(0.29,0.56,0.76), smoothstep(-0.05, 0.55, h));
        col = mix(vec3(0.13,0.27,0.37), col, smoothstep(-0.35, 0.0, h));
        if (uOct > 0.5 && h > 0.02) {
          vec2 cp = d.xz / (d.y + 0.18) * 1.6 + vec2(uTime*0.006, uTime*0.003);
          float c = fbm(cp) + 0.35*fbm(cp*2.7 + 11.0);
          float cl = smoothstep(0.62, 1.05, c) * smoothstep(0.02, 0.2, h);
          col = mix(col, vec3(1.0), cl * 0.75);
        }
        float s = max(dot(d, uSun), 0.0);
        col += vec3(1.0, 0.92, 0.75) * (pow(s, 900.0)*3.0 + pow(s, 10.0)*0.14);
        gl_FragColor = vec4(col, 1.0);
      }`,
  }), [quality]);

  useFrame(({ camera }, dt) => {
    (mat.uniforms.uTime.value as number) += dt;
    ref.current?.position.copy(camera.position);
  });

  return (
    <mesh ref={ref} frustumCulled={false}>
      <sphereGeometry args={[420, 24, 16]} />
      <primitive object={mat} attach="material" />
    </mesh>
  );
}
