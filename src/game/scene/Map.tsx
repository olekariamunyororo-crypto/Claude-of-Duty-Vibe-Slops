// Hijacked-flavored yacht: two decks, helipad (aft), pool (mid-starboard),
// superstructure with roof route, engine room, corridors, two stairwells.
// BOXES is the single source of truth for rendering, collision, LOS and radar.
import { useMemo, Component, type ReactNode } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { useGLTF } from '@react-three/drei';
import { helipadTexture, noiseTexture, useNormalizedModel } from '../utils/ProceduralGeometry';
import { MODEL_STATE } from '../utils/GLBProbe';
import { registerSpecGlossExtension } from '../utils/GLTFSpecGloss';
import { useGame } from '../store/gameStore';
import { rayBox, type AABB } from '../utils/MathUtils';

export type BoxKind = 'floor' | 'wall' | 'crate' | 'railing' | 'hull' | 'metal';
export interface LevelBox extends AABB { kind: BoxKind; deck: number }

function buildLevel(): LevelBox[] {
  const L: LevelBox[] = [];
  const B = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, kind: BoxKind, deck: number) =>
    L.push({ min: [x0, y0, z0], max: [x1, y1, z1], kind, deck });

  // hull shell
  B(-7.8, -2, -30.8, -7, 8, 30.8, 'hull', 0);
  B(7, -2, -30.8, 7.8, 8, 30.8, 'hull', 0);
  B(-7.8, -2, -30.8, 7.8, 8, -30, 'hull', 0);
  B(-7.8, -2, 30, 7.8, 8, 30.8, 'hull', 0);

  // lower deck floor
  B(-7.8, -1, -30.8, 7.8, 0, 30.8, 'floor', 0);

  // upper deck slabs (top y = 3.4) around stair holes + pool hole
  B(-7, 3, -30, 7, 3.4, -12, 'floor', 1);
  B(-7, 3, -12, -6.2, 3.4, -8, 'floor', 1);
  B(-4.2, 3, -12, 7, 3.4, -8, 'floor', 1);
  B(-7, 3, -8, 7, 3.4, -3.5, 'floor', 1);
  B(-7, 3, -3.5, 1.2, 3.4, 3.5, 'floor', 1);
  B(5.2, 3, -3.5, 7, 3.4, 3.5, 'floor', 1);
  B(-7, 3, 3.5, 7, 3.4, 8, 'floor', 1);
  B(-7, 3, 8, 4.2, 3.4, 12, 'floor', 1);
  B(6.2, 3, 8, 7, 3.4, 12, 'floor', 1);
  B(-7, 3, 12, 7, 3.4, 30, 'floor', 1);

  // pool: floor, walls, climbable steps
  B(1.2, 2.0, -3.5, 5.2, 2.2, 3.5, 'floor', 0);
  B(1.2, 2.2, -3.5, 5.2, 3.4, -3.3, 'wall', 1);
  B(1.2, 2.2, 3.3, 5.2, 3.4, 3.5, 'wall', 1);
  B(1.2, 2.2, -3.3, 1.4, 3.4, 3.3, 'wall', 1);
  B(5.0, 2.2, -3.3, 5.2, 3.4, 3.3, 'wall', 1);
  B(3.9, 2.2, -3.5, 4.55, 3.2, -2.6, 'metal', 0);
  B(4.55, 2.2, -3.5, 5.2, 2.75, -2.6, 'metal', 0);

  // aft stairwell (port) ascending toward stern
  for (let i = 0; i < 8; i++) {
    const t = 0.425 * (i + 1);
    B(-6.2, t - 0.35, -12 + 0.5 * i, -4.2, t, -11.5 + 0.5 * i, 'metal', 0);
  }
  B(-6.5, 0, -12, -6.2, 3.4, -8, 'wall', 0);
  B(-4.2, 0, -12, -3.9, 3.4, -8, 'wall', 0);

  // fore stairwell (starboard) descending toward stern
  for (let i = 0; i < 8; i++) {
    const t = 3.4 - 0.425 * i;
    B(4.2, t - 0.35, 8 + 0.5 * i, 6.2, t, 8.5 + 0.5 * i, 'metal', 0);
  }
  B(3.9, 0, 8, 4.2, 3.4, 12, 'wall', 0);
  B(6.2, 0, 8, 6.5, 3.4, 12, 'wall', 0);

  // superstructure with doors + roof route via crate hops
  B(-1.1, 3.4, -4.5, -0.8, 5.55, -1, 'wall', 1);
  B(-1.1, 3.4, 1, -0.8, 5.55, 4.5, 'wall', 1);
  B(-6.4, 3.4, -4.8, -4.4, 5.55, -4.5, 'wall', 1);
  B(-3.4, 3.4, -4.8, -0.8, 5.55, -4.5, 'wall', 1);
  B(-6.4, 3.4, 4.5, -4.4, 5.55, 4.8, 'wall', 1);
  B(-2.4, 3.4, 4.5, -0.8, 5.55, 4.8, 'wall', 1);
  B(-6.7, 3.4, -4.5, -6.4, 5.55, 4.5, 'wall', 1);
  B(-6.0, 3.4, -2.5, -3.8, 4.5, -1.5, 'crate', 1);
  B(-6.7, 5.55, -4.8, -0.8, 5.8, 4.8, 'floor', 2);
  B(-6.7, 5.8, -4.8, -0.8, 6.45, -4.65, 'railing', 2);
  B(-6.7, 5.8, 4.65, -0.8, 6.45, 4.8, 'railing', 2);
  B(-6.7, 5.8, -4.8, -6.55, 6.45, 4.8, 'railing', 2);
  B(-0.95, 5.8, -4.8, -0.8, 6.45, 4.8, 'railing', 2);
  B(-0.35, 3.4, -2.55, 0.75, 4.2, -1.45, 'crate', 1);
  B(-0.35, 3.4, -0.95, 0.75, 5.0, 0.15, 'crate', 1);

  // lower interior: engine room, lounge, storage
  B(-6.7, 0, -16.3, -4.5, 3.2, -16, 'wall', 0);
  B(-3.5, 0, -16.3, -1.6, 3.2, -16, 'wall', 0);
  B(-1.9, 0, -28, -1.6, 3.2, -19, 'wall', 0);
  B(-1.9, 0, -17.6, -1.6, 3.2, -16, 'wall', 0);
  B(-5.9, 0, -24.5, -4.5, 1.7, -23.1, 'metal', 0);
  B(-4.0, 0, -21.5, -2.6, 1.7, -20.1, 'metal', 0);
  B(-6.7, 2.2, -28, -6.3, 2.6, -16, 'metal', 0);
  B(1.6, 0, -6, 1.9, 3.2, -1.2, 'wall', 0);
  B(1.6, 0, 1.2, 1.9, 3.2, 6, 'wall', 0);
  B(3.6, 0, -2.2, 6.2, 1.1, -1.2, 'crate', 0);
  B(6.2, 0, -5.5, 6.7, 2.2, -4.5, 'metal', 0);
  B(1.6, 0, 15.7, 3.8, 3.2, 16, 'wall', 0);
  B(4.8, 0, 15.7, 6.7, 3.2, 16, 'wall', 0);
  B(1.6, 0, 16, 1.9, 3.2, 28, 'wall', 0);
  B(2.6, 0, 20, 3.7, 1.1, 21.1, 'crate', 0);
  B(4.8, 0, 24, 5.9, 1.1, 25.1, 'crate', 0);

  // scattered cover
  B(0.4, 0, -14.05, 1.5, 1.1, -12.95, 'crate', 0);
  B(-1.5, 0, 7.95, -0.4, 1.1, 9.05, 'crate', 0);
  B(-2.5, 3.4, -21.5, -1.4, 4.5, -20.4, 'crate', 1);
  B(1.5, 3.4, 22, 2.6, 4.5, 23.1, 'crate', 1);
  B(-4.5, 3.4, 12, -3.4, 4.5, 13.1, 'crate', 1);
  B(2.0, 3.4, -11, 3.1, 4.5, -9.9, 'crate', 1);

  return L;
}

export const BOXES: LevelBox[] = buildLevel();

export function rayWorld(o: THREE.Vector3, d: THREE.Vector3, maxT: number): number {
  let best = -1;
  for (const b of BOXES) {
    const t = rayBox(o.x, o.y, o.z, d.x, d.y, d.z, b, maxT);
    if (t >= 0 && (best < 0 || t < best)) best = t;
  }
  return best;
}

export function losBlocked(a: THREE.Vector3, b: THREE.Vector3): boolean {
  const d = new THREE.Vector3().subVectors(b, a);
  const dist = d.length();
  if (dist < 0.001) return false;
  d.divideScalar(dist);
  return rayWorld(a, d, dist - 0.15) >= 0;
}

// ---- Waypoint graph (bots) -------------------------------------------------
const WP: [number, number, number][] = [
  [0, 3.42, -24], [5, 3.42, -16], [6, 3.42, -6], [6, 3.42, 0], [6, 3.42, 6],
  [3, 3.42, 9], [3, 3.42, 14], [0, 3.42, 24], [-5, 3.42, 14], [-5, 3.42, 6],
  [-3.9, 3.42, 3.4], [-3.9, 3.42, -0.5], [-4, 3.42, -6.5], [-3, 3.42, -16],
  [-3, 3.42, -10], [-5.2, 0, -12.5], [-5.2, 1.7, -10], [-5.2, 3.42, -7.5],
  [0, 0.02, 0], [-5.2, 0.02, -15.5], [-4, 0.02, -16.6], [0, 0.02, -20],
  [0, 0.02, 10], [0, 0.02, 20], [3.6, 0.02, 13.5], [4.3, 0.02, 14.5],
  [4.5, 0.02, 20], [4, 0.02, -1], [4, 0.02, -11], [4, 0.02, -22],
  [5.2, 0.02, 12.6], [5.2, 1.7, 10], [5.2, 3.42, 7.5],
];
const LINKS: number[][] = [
  [1], [0, 2, 15], [2], [2, 3], [3, 4, 5], [4, 6], [5, 7], [6, 8], [7, 9], [8, 10],
  [9, 11], [10, 12], [11, 13], [12, 13, 0], [13, 1], [15, 17, 16], [16, 17, 15], [17, 16],
  [19, 22, 28], [15, 21, 16], [20, 22], [19, 20, 23, 30], [19, 23, 24, 25], [22, 24],
  [22, 23, 25, 26, 31], [23, 24, 26, 31], [24, 25], [19, 29], [27, 28, 30], [28, 30],
  [25, 29, 32], [31, 32], [32, 4],
];
export const NAV = WP.map((p, i) => ({ p: new THREE.Vector3(...p), links: LINKS[i] ?? [] }));

export function nearestNode(p: THREE.Vector3): number {
  let bi = 0, bd = Infinity;
  for (let i = 0; i < NAV.length; i++) {
    const n = NAV[i].p;
    const d = (n.x - p.x) ** 2 + (n.z - p.z) ** 2 + Math.abs(n.y - p.y) * 12;
    if (d < bd) { bd = d; bi = i; }
  }
  return bi;
}

export function bfsPath(from: number, to: number): number[] {
  if (from === to) return [to];
  const prev = new Array<number>(NAV.length).fill(-1);
  prev[from] = from;
  const q = [from];
  while (q.length) {
    const cur = q.shift()!;
    for (const nx of NAV[cur].links) {
      if (prev[nx] !== -1) continue;
      prev[nx] = cur;
      if (nx === to) {
        const path: number[] = [to];
        let c = to;
        while (c !== from) { c = prev[c]; if (c !== from) path.unshift(c); }
        return path;
      }
      q.push(nx);
    }
  }
  return [];
}

export const SPAWNS: { pos: THREE.Vector3; yaw: number }[] = [
  { pos: new THREE.Vector3(0, 3.42, -25), yaw: Math.PI },
  { pos: new THREE.Vector3(0, 3.42, 25), yaw: 0 },
  { pos: new THREE.Vector3(4, 0.02, -22), yaw: Math.PI },
  { pos: new THREE.Vector3(-4, 0.02, -19), yaw: Math.PI / 2 },
  { pos: new THREE.Vector3(0, 0.02, 22), yaw: 0 },
  { pos: new THREE.Vector3(5, 3.42, -14), yaw: Math.PI },
];

// ---- Rendering --------------------------------------------------------------
function YachtModel({ url }: { url: string }) {
  const gltf = useGLTF(url, true, true, registerSpecGlossExtension) as { scene: THREE.Group };
  const normalized = useNormalizedModel(gltf.scene, 64, 0.6);
  return <primitive object={normalized} />;
}

class YachtGLBErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { /* yacht visual failed — collision stays intact */ }
  render() { return this.state.failed ? null : this.props.children; }
}

function StandInHull() {
  return (
    <group>
      <mesh position={[0, 1.4, 0]}><boxGeometry args={[14.5, 6.8, 61]} /><meshLambertMaterial color="#d7dde2" /></mesh>
      <mesh position={[0, 5.4, 0]}><boxGeometry args={[11, 3.4, 30]} /><meshLambertMaterial color="#cfd6db" /></mesh>
      <mesh position={[-3.6, 8.6, 2]}><cylinderGeometry args={[1.7, 2.1, 4.4, 12]} /><meshLambertMaterial color="#39424c" /></mesh>
      <mesh position={[0, 9.6, -18]}><cylinderGeometry args={[0.14, 0.14, 7, 6]} /><meshLambertMaterial color="#39424c" /></mesh>
    </group>
  );
}

function PoolWater() {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true,
    uniforms: { uTime: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `
      varying vec2 vUv; uniform float uTime;
      float caus(vec2 p, float t){ return sin(p.x*22.0+t)*sin(p.y*18.0-t*1.3); }
      void main(){
        vec2 p = vUv*3.0;
        float c = caus(p, uTime*1.4)*0.5 + caus(p.yx+2.7, uTime*1.1)*0.5;
        c = smoothstep(0.55, 1.0, c);
        vec3 col = mix(vec3(0.10,0.42,0.58), vec3(0.65,0.92,1.0), c*0.6);
        float edge = smoothstep(0.0,0.06,vUv.x)*smoothstep(1.0,0.94,vUv.x)*smoothstep(0.0,0.06,vUv.y)*smoothstep(1.0,0.94,vUv.y);
        col += (1.0-edge)*0.18;
        gl_FragColor = vec4(col, 0.78);
      }`,
  }), []);
  useAnimTime(mat);
  return (
    <mesh position={[3.2, 2.92, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[3.8, 6.8]} />
      <primitive object={mat} attach="material" />
    </mesh>
  );
}

function useAnimTime(mat: THREE.ShaderMaterial): void {
  useMemo(() => {
    const tick = () => { mat.uniforms.uTime.value = performance.now() / 1000; };
    const id = setInterval(tick, 50);
    return () => clearInterval(id);
  }, [mat]);
}

export function MapMeshes() {
  const buckets = useMemo(() => {
    const byKind = new Map<BoxKind, THREE.BufferGeometry[]>();
    for (const b of BOXES) {
      const arr = byKind.get(b.kind) ?? [];
      const g = new THREE.BoxGeometry(b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]);
      g.translate((b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2);
      arr.push(g);
      byKind.set(b.kind, arr);
    }
    const out = new Map<BoxKind, THREE.BufferGeometry>();
    for (const [k, arr] of byKind) out.set(k, mergeGeometries(arr));
    return out;
  }, []);

  const floorTex = useMemo(() => noiseTexture(64, [126, 132, 140], 18, 6), []);
  const wallTex = useMemo(() => noiseTexture(64, [158, 150, 138], 22, 3), []);
  const crateTex = useMemo(() => noiseTexture(32, [142, 108, 64], 30, 1), []);
  const metalTex = useMemo(() => noiseTexture(32, [96, 104, 112], 14, 2), []);
  const padTex = useMemo(() => helipadTexture(), []);
  const deployTick = useGame((s) => s.deployTick);

  const yacht = MODEL_STATE.yacht;
  const showGLBYacht = yacht.ok && !yacht.placeholder && deployTick >= 0;

  return (
    <group>
      {buckets.get('floor') && <mesh geometry={buckets.get('floor')!}><meshLambertMaterial map={floorTex} /></mesh>}
      {buckets.get('wall') && <mesh geometry={buckets.get('wall')!}><meshLambertMaterial map={wallTex} /></mesh>}
      {buckets.get('crate') && <mesh geometry={buckets.get('crate')!}><meshLambertMaterial map={crateTex} /></mesh>}
      {buckets.get('metal') && <mesh geometry={buckets.get('metal')!}><meshLambertMaterial map={metalTex} /></mesh>}
      {buckets.get('railing') && (
        <mesh geometry={buckets.get('railing')!}>
          <meshPhongMaterial color="#9fd8e8" transparent opacity={0.45} shininess={90} />
        </mesh>
      )}
      {buckets.get('hull') && <mesh geometry={buckets.get('hull')!}><meshLambertMaterial color="#e8ecef" side={THREE.BackSide} /></mesh>}

      <PoolWater />
      <mesh position={[0, 3.42, -24]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[5.4, 28]} />
        <meshBasicMaterial map={padTex} transparent />
      </mesh>
      {[-24, -12, 0, 12, 24].map((z) => (
        <mesh key={z} position={[0, 3.05, z]}>
          <boxGeometry args={[1.6, 0.06, 0.16]} />
          <meshBasicMaterial color="#8fe8ff" />
        </mesh>
      ))}

      {showGLBYacht ? (
        <YachtGLBErrorBoundary>
          <YachtModel url={yacht.url} />
        </YachtGLBErrorBoundary>
      ) : (
        <StandInHull />
      )}
    </group>
  );
}
