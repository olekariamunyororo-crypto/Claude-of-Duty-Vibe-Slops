// Bot rendering: GLB animation clips when available, else procedural gait + NV4.
//
// v2.4 — animation integration:
//   - Loads ghost GLB with its AnimationClip[] (SCI-FI SuperSoldier, Mixamo, etc.)
//   - Per-bot AnimationMixer on a SkeletonUtils clone
//   - Maps bot state + speed → idle / walk / run / death clips by name heuristic
//   - Crossfades between actions; timeScale tracks ground speed
//   - Falls back to procedural leg swing / lean if the model has no clips
import { Suspense, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { bots, subscribeBots, getBotsVersion } from '../ai/bots';
import { MODEL_STATE } from '../utils/GLBProbe';
import { registerSpecGlossExtension } from '../utils/GLTFSpecGloss';
import { cloneScene, ghostStandIn, nv4StandIn, useNormalizedModel } from '../utils/ProceduralGeometry';
import { T } from '../store/transient';

const FLASH_COLOR = new THREE.Color('#ff5040');
const WEAPON_ANCHOR = new THREE.Vector3(0.28, 1.28, -0.24);
const PATROL_SPEED = 3.2;
const FADE = 0.22;

type ClipKind = 'idle' | 'walk' | 'run' | 'death' | 'other';

function classifyClip(name: string): ClipKind {
  const n = name.toLowerCase();
  if (/death|die|dead|ragdoll/.test(n)) return 'death';
  if (/run|sprint|jog/.test(n)) return 'run';
  if (/walk|locomotion|move|stride/.test(n)) return 'walk';
  if (/idle|stand|breath|wait|tpose|t-pose|rest/.test(n)) return 'idle';
  if (n.includes('walk')) return 'walk';
  if (n.includes('run')) return 'run';
  if (n.includes('idle')) return 'idle';
  return 'other';
}

function pickClips(clips: THREE.AnimationClip[]) {
  const by: Record<ClipKind, THREE.AnimationClip | null> = {
    idle: null, walk: null, run: null, death: null, other: null,
  };
  for (const c of clips) {
    const k = classifyClip(c.name);
    if (k !== 'other' && !by[k]) by[k] = c;
    else if (k === 'other' && !by.other) by.other = c;
  }
  if (!by.walk) by.walk = by.run ?? by.other;
  if (!by.run) by.run = by.walk;
  if (!by.idle) by.idle = by.walk ?? by.other;
  return by;
}

function normalizeRoot(root: THREE.Object3D, targetHeight = 1.8, yOffset = -0.12) {
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const h = Math.max(size.y, 1e-6);
  root.scale.setScalar(targetHeight / h);
  const box2 = new THREE.Box3().setFromObject(root);
  const c = box2.getCenter(new THREE.Vector3());
  root.position.x -= c.x;
  root.position.z -= c.z;
  root.position.y -= box2.min.y + yOffset;
}

function useGhostGltf(url: string) {
  return useGLTF(url, true, true, registerSpecGlossExtension) as {
    scene: THREE.Group;
    animations: THREE.AnimationClip[];
  };
}

function useNv4Base(url: string | null): THREE.Group | null {
  if (!url) return null;
  const gltf = useGLTF(url, true, true, registerSpecGlossExtension) as { scene: THREE.Group };
  return useNormalizedModel(gltf.scene, 0.62, 0, true);
}

interface LegRig {
  leftThigh: THREE.Object3D | null;
  rightThigh: THREE.Object3D | null;
  hips: THREE.Object3D | null;
}

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

type ActionMap = Partial<Record<'idle' | 'walk' | 'run' | 'death', THREE.AnimationAction>>;

function BotBody({
  index,
  body,
  clips,
  weaponBase,
}: {
  index: number;
  body: THREE.Group;
  clips: THREE.AnimationClip[];
  weaponBase: THREE.Group | null;
}) {
  const group = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Group>(null);
  const weapon = useRef<THREE.Group>(null);
  const flashRef = useRef<THREE.Mesh>(null);

  const mixer = useMemo(() => (clips.length > 0 ? new THREE.AnimationMixer(body) : null), [body, clips]);
  const actions = useMemo<ActionMap>(() => {
    if (!mixer || clips.length === 0) return {};
    const picked = pickClips(clips);
    const map: ActionMap = {};
    (['idle', 'walk', 'run', 'death'] as const).forEach((k) => {
      const clip = picked[k];
      if (clip) {
        const a = mixer.clipAction(clip);
        a.enabled = true;
        a.setEffectiveWeight(0);
        a.play();
        map[k] = a;
      }
    });
    return map;
  }, [mixer, clips]);

  const hasClips = Object.keys(actions).length > 0;
  const current = useRef<'idle' | 'walk' | 'run' | 'death' | null>(null);
  const wasAlive = useRef(true);

  const rig = useMemo(() => findLegPairs(body), [body]);
  const isSkinned = !!(rig.leftThigh && rig.rightThigh);
  const phaseOffset = useMemo(() => Math.random() * Math.PI * 2, []);
  const restRot = useMemo(() => ({
    l: rig.leftThigh ? rig.leftThigh.rotation.x : 0,
    r: rig.rightThigh ? rig.rightThigh.rotation.x : 0,
  }), [rig]);
  const walkPhase = useRef(0);

  const weaponObj = useMemo(() => {
    if (!weaponBase) return nv4StandIn();
    const c = cloneScene(weaponBase);
    c.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.material) {
        m.material = Array.isArray(m.material)
          ? m.material.map((mm) => mm.clone())
          : m.material.clone();
      }
    });
    return c;
  }, [weaponBase]);

  const fadeTo = (next: 'idle' | 'walk' | 'run' | 'death') => {
    if (current.current === next) return;
    const nextAct = actions[next];
    if (!nextAct) return;
    const prev = current.current ? actions[current.current] : null;
    nextAct.reset();
    nextAct.setEffectiveWeight(1);
    nextAct.play();
    if (prev && prev !== nextAct) prev.crossFadeTo(nextAct, FADE, false);
    else nextAct.fadeIn(FADE);
    current.current = next;
  };

  useEffect(() => {
    return () => { mixer?.stopAllAction(); };
  }, [mixer]);

  useFrame((_, dt) => {
    const b = bots[index];
    const g = group.current;
    if (!b || !g) return;

    g.position.lerpVectors(b.prevPos, b.pos, T.alpha);
    g.rotation.y = b.yaw;

    const speed = Math.hypot(b.vel.x, b.vel.z);
    const norm = Math.min(1, speed / PATROL_SPEED);

    if (hasClips && mixer) {
      if (!b.alive) {
        if (wasAlive.current) {
          wasAlive.current = false;
          if (actions.death) fadeTo('death');
        }
        mixer.update(dt);
      } else {
        wasAlive.current = true;
        if (speed < 0.35) fadeTo('idle');
        else if (speed < 2.4 || !actions.run) fadeTo('walk');
        else fadeTo('run');

        const act = current.current ? actions[current.current] : null;
        if (act && current.current !== 'idle' && current.current !== 'death') {
          const base = current.current === 'run' ? 4.5 : 3.2;
          act.timeScale = THREE.MathUtils.clamp(speed / Math.max(base, 0.1), 0.55, 1.6);
        } else if (act) {
          act.timeScale = 1;
        }
        mixer.update(dt);
      }

      if (!b.alive && !actions.death && inner.current) {
        const age = T.time - b.deathT;
        inner.current.rotation.x = Math.min(Math.PI / 2, age * 5);
        inner.current.position.y = -Math.min(0.5, Math.max(0, age - 2.5) * 0.5);
      } else if (b.alive && inner.current) {
        inner.current.rotation.x = 0;
        inner.current.rotation.z = 0;
        inner.current.position.y = 0;
      }
      g.visible = true;
    } else {
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
            const ph2 = walkPhase.current * 1.8 + phaseOffset;
            const lean = -0.14 * norm;
            const sway = Math.sin(ph2) * 0.11 * norm;
            const bob = Math.abs(Math.sin(ph2)) * 0.07 * norm;
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
      }
    }

    if (inner.current) {
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
      weapon.current.rotation.y = Math.sin((walkPhase.current || T.time * 3) * 1.6 + phaseOffset) * 0.05 * norm;
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
  const gltf = useGhostGltf(url);
  const weaponBase = useNv4Base(weaponUrl);

  const { body, clips } = useMemo(() => {
    const cloned = SkeletonUtils.clone(gltf.scene) as THREE.Group;
    normalizeRoot(cloned, 1.8, -0.12);
    cloned.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.material) {
        m.material = Array.isArray(m.material)
          ? m.material.map((mm) => mm.clone())
          : m.material.clone();
      }
    });
    const clips = (gltf.animations ?? []).map((c) => c.clone());
    return { body: cloned, clips };
  }, [gltf.scene, gltf.animations, index]);

  return <BotBody index={index} body={body} clips={clips} weaponBase={weaponBase} />;
}

function StandInBot({ index, weaponUrl }: { index: number; weaponUrl: string | null }) {
  const body = useMemo(() => ghostStandIn(), []);
  const weaponBase = useNv4Base(weaponUrl);
  return <BotBody index={index} body={body} clips={[]} weaponBase={weaponBase} />;
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
          <Suspense key={`g${i}-${ghost.url}`} fallback={<StandInBot index={i} weaponUrl={weaponUrl} />}>
            <GhostBot index={i} url={ghost.url} weaponUrl={weaponUrl} />
          </Suspense>
        ) : (
          <StandInBot key={`s${i}`} index={i} weaponUrl={weaponUrl} />
        ),
      )}
    </group>
  );
}
