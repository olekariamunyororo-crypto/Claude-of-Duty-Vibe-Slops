// Bot rendering with procedural locomotion + attached NV4.
//
// v2.3: real ghost.glb is a static mesh (no animations, no gun). Without leg
// motion the bots read as "gliding". This component:
//   1. Probes the clone for leg bones and swings them with a gait phase that
//      advances by *distance traveled* (not wall time) so foot speed always
//      matches ground speed.
//   2. If no skeleton is found, sells the gait with lean + lateral sway +
//      step-bob + yaw wobble — all at walk-cycle frequency.
//   3. Clones nv4.glb (or the procedural stand-in) and mounts it at a
//      right-hand anchor so bots visibly carry a weapon.
import { Suspense, useMemo, useRef, useSyncExternalStore } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { bots, subscribeBots, getBotsVersion } from '../ai/bots';
import { MODEL_STATE } from '../utils/GLBProbe';
import { registerSpecGlossExtension } from '../utils/GLTFSpecGloss';
import { cloneScene, ghostStandIn, nv4StandIn, useNormalizedModel } from '../utils/ProceduralGeometry';
import { T } from '../store/transient';

const FLASH_COLOR = new THREE.Color('#ff5040');
const WEAPON_ANCHOR = new THREE.Vector3(0.28, 1.28, -0.24);
const PATROL_SPEED = 3.2; // keep in sync with bots.ts — used to normalize the gait

function useGhostBase(url: string): THREE.Group {
  const gltf = useGLTF(url, true, true, registerSpecGlossExtension) as { scene: THREE.Group };
  // Negative yOffset drops the mesh so feet sit on the ground (many Sketchfab
  // humanoids have origin at pelvis / mid-body and otherwise float).
  return useNormalizedModel(gltf.scene, 1.8, -0.12, true);
}

function useNv4Base(url: string | null): THREE.Group | null {
  if (!url) return null;
  const gltf = useGLTF(url, true, true, registerSpecGlossExtension) as { scene: THREE.Group };
  return useNormalizedModel(gltf.scene, 0.62, 0, true);
}

function useClonedBody(base: THREE.Group): THREE.Group {
  return useMemo(() => {
    const c = cloneScene(base);
    c.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.material) {
        m.material = Array.isArray(m.material) ? m.material.map((mm) => mm.clone()) : m.material.clone();
      }
    });
    return c;
  }, [base]);
}

interface LegRig {
  leftThigh: THREE.Object3D | null;
  rightThigh: THREE.Object3D | null;
  hips: THREE.Object3D | null;
}

/** Heuristic bone lookup. Handles Mixamo, Blender, and generic naming. */
function findLegPairs(root: THREE.Object3D): LegRig {
  const bones: THREE.Object3D[] = [];
  root.traverse((o) => {
    const b = o as THREE.Bone;
    if (b.isBone) bones.push(b);
  });
  if (bones.length === 0) return { leftThigh: null, rightThigh: null, hips: null };

  const pick = (re: RegExp) => bones.find((b) => re.test(b.name)) ?? null;
  const hips = pick(/hips|pelvis|spine_?0?1/i);
  const leftThigh =
    pick(/(l(eft)?|_l_|\.l\.|_l$)[^a-z]*(thigh|upleg|upperleg)/i) ??
    pick(/(thigh|upleg|upperleg)[^a-z]*(l(eft)?|_l_|\.l\.|_l$)/i);
  const rightThigh =
    pick(/(r(ight)?|_r_|\.r\.|_r$)[^a-z]*(thigh|upleg|upperleg)/i) ??
    pick(/(thigh|upleg|upperleg)[^a-z]*(r(ight)?|_r_|\.r\.|_r$)/i);
  return { leftThigh, rightThigh, hips };
}

function BotBody({ index, base, weaponBase }: {
  index: number;
  base: THREE.Group;
  weaponBase: THREE.Group | null;
}) {
  const group = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Group>(null);
  const weapon = useRef<THREE.Group>(null);
  const flashRef = useRef<THREE.Mesh>(null);

  const body = useClonedBody(base);
  const rig = useMemo(() => findLegPairs(body), [body]);
  const isSkinned = !!(rig.leftThigh && rig.rightThigh);
  const phaseOffset = useMemo(() => Math.random() * Math.PI * 2, []);

  const weaponObj = useMemo(() => {
    if (!weaponBase) return nv4StandIn();
    const c = cloneScene(weaponBase);
    c.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.material) {
        m.material = Array.isArray(m.material) ? m.material.map((mm) => mm.clone()) : m.material.clone();
      }
    });
    return c;
  }, [weaponBase]);

  const restRot = useMemo(() => ({
    l: rig.leftThigh ? rig.leftThigh.rotation.x : 0,
    r: rig.rightThigh ? rig.rightThigh.rotation.x : 0,
  }), [rig]);

  const walkPhase = useRef(0);

  useFrame((_, dt) => {
    const b = bots[index];
    const g = group.current;
    if (!b || !g) return;

    g.position.lerpVectors(b.prevPos, b.pos, T.alpha);
    g.rotation.y = b.yaw;

    const speed = Math.hypot(b.vel.x, b.vel.z);
    const norm = Math.min(1, speed / PATROL_SPEED);

    // Root-motion trick: phase advances by distance traveled, not wall time.
    // Slightly higher multiplier = faster, more readable step cycle.
    walkPhase.current += speed * dt * 4.8;

    if (inner.current) {
      if (b.alive) {
        const ph = walkPhase.current + phaseOffset;
        const swing = Math.sin(ph);

        if (isSkinned && rig.leftThigh && rig.rightThigh) {
          const amp = 0.65 * norm;
          rig.leftThigh.rotation.x = restRot.l + swing * amp;
          rig.rightThigh.rotation.x = restRot.r - swing * amp;
          if (rig.hips) rig.hips.rotation.z = Math.sin(ph * 0.5) * 0.05 * norm;
          inner.current.position.y = Math.abs(Math.cos(ph)) * 0.04 * norm;
          inner.current.rotation.x = THREE.MathUtils.lerp(inner.current.rotation.x, -0.08 * norm, 0.2);
          inner.current.rotation.z = THREE.MathUtils.lerp(inner.current.rotation.z, 0, 0.2);
        } else {
          // Rigid-mesh fallback (most Sketchfab Ghost models have no skeleton).
          // Stronger lean / sway / step-bob so the character reads as walking
          // instead of floating/gliding.
          const ph2 = walkPhase.current * 1.8 + phaseOffset;
          const lean = -0.14 * norm;
          const sway = Math.sin(ph2) * 0.11 * norm;
          const bob  = Math.abs(Math.sin(ph2)) * 0.07 * norm;
          const yawW = Math.sin(ph2 * 0.5) * 0.07 * norm;
          inner.current.rotation.x = THREE.MathUtils.lerp(inner.current.rotation.x, lean, 0.22);
          inner.current.rotation.z = THREE.MathUtils.lerp(inner.current.rotation.z, sway, 0.28);
          inner.current.rotation.y = THREE.MathUtils.lerp(inner.current.rotation.y, yawW, 0.22);
          inner.current.position.y = bob;
          inner.current.position.x = Math.sin(ph2) * 0.03 * norm;
        }
        g.visible = true;
      } else {
        const age = T.time - b.deathT;
        inner.current.rotation.x = Math.min(Math.PI / 2, age * 5);
        inner.current.position.y = -Math.min(0.5, Math.max(0, age - 2.5) * 0.5);
        inner.current.rotation.z = 0;
      }

      inner.current.traverse((o) => {
        const m = o as THREE.Mesh & { material?: THREE.MeshLambertMaterial };
        if (m.isMesh && m.material && m.material.color) {
          const ud = m.userData as { baseColor?: THREE.Color };
          if (!ud.baseColor) ud.baseColor = m.material.color.clone();
          m.material.color.copy(ud.baseColor);
          if (T.time - b.hitFlashT < 0.09) m.material.color.lerp(FLASH_COLOR, 0.85);
        }
      });
    }

    if (weapon.current) {
      const aim = b.state === 'combat' ? 1 : 0;
      const targetPitch = THREE.MathUtils.lerp(-0.9, -0.1, aim);
      weapon.current.rotation.x = THREE.MathUtils.lerp(weapon.current.rotation.x, targetPitch, 0.15);
      weapon.current.rotation.y = Math.sin(walkPhase.current * 1.6 + phaseOffset) * 0.05 * norm;
    }

    if (flashRef.current) flashRef.current.visible = T.time - b.flashT < 0.05;
  });

  return (
    <group ref={group}>
      <group ref={inner}>
        <primitive object={body} />
        <group ref={weapon} position={WEAPON_ANCHOR.toArray()}>
          <primitive object={weaponObj} />
        </group>
        <mesh ref={flashRef} position={[0.3, 1.4, -0.5]} visible={false}>
          <planeGeometry args={[0.3, 0.3]} />
          <meshBasicMaterial color="#ffe08a" transparent blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      </group>
    </group>
  );
}

function GhostBot({ index, url, weaponUrl }: { index: number; url: string; weaponUrl: string | null }) {
  const base = useGhostBase(url);
  const weaponBase = useNv4Base(weaponUrl);
  return <BotBody index={index} base={base} weaponBase={weaponBase} />;
}

function StandInBot({ index, weaponUrl }: { index: number; weaponUrl: string | null }) {
  const body = useMemo(() => ghostStandIn(), []);
  const weaponBase = useNv4Base(weaponUrl);
  return <BotBody index={index} base={body} weaponBase={weaponBase} />;
}

export function BotsView() {
  useSyncExternalStore(subscribeBots, getBotsVersion);
  const ghost = MODEL_STATE.ghost;
  const nv4 = MODEL_STATE.nv4;
  const useGLB = ghost.ok && !ghost.placeholder;
  const weaponUrl = nv4.ok && !nv4.placeholder ? nv4.url : null;
  const count = bots.length || 4;

  return (
    <group>
      {Array.from({ length: count }, (_, i) =>
        useGLB ? (
          <Suspense key={`g${i}`} fallback={<StandInBot index={i} weaponUrl={weaponUrl} />}>
            <GhostBot index={i} url={ghost.url} weaponUrl={weaponUrl} />
          </Suspense>
        ) : (
          <StandInBot key={`s${i}`} index={i} weaponUrl={weaponUrl} />
        ),
      )}
    </group>
  );
}
