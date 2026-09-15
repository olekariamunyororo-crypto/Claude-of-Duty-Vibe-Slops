// Bot rendering: ghost.glb clones (or capsule stand-ins) with interpolated
// transforms, procedural bob, hit-flash tint, muzzle flash, death topple.
import { Suspense, useMemo, useRef, useSyncExternalStore } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { bots, subscribeBots, getBotsVersion } from '../ai/bots';
import { MODEL_STATE } from '../utils/GLBProbe';
import { registerSpecGlossExtension } from '../utils/GLTFSpecGloss';
import { cloneScene, ghostStandIn, useNormalizedModel } from '../utils/ProceduralGeometry';
import { T } from '../store/transient';

const FLASH_COLOR = new THREE.Color('#ff5040');

function useGhostBase(url: string): THREE.Group {
  const gltf = useGLTF(url, true, true, registerSpecGlossExtension) as { scene: THREE.Group };
  return useNormalizedModel(gltf.scene, 1.8, 0, true); // skipAutoRotate: avoids a humanoid false-positive (see useNormalizedModel)
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

function BotBody({ index, base }: { index: number; base: THREE.Group }) {
  const group = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Group>(null);
  const flashRef = useRef<THREE.Mesh>(null);

  const body = useClonedBody(base);

  useFrame(() => {
    const b = bots[index];
    const g = group.current;
    if (!b || !g) return;
    g.position.lerpVectors(b.prevPos, b.pos, T.alpha);
    g.rotation.y = b.yaw;

    if (inner.current) {
      if (b.alive) {
        const hs = Math.hypot(b.vel.x, b.vel.z);
        inner.current.position.y = Math.abs(Math.sin(T.time * 9 + b.id)) * 0.05 * Math.min(1, hs / 4);
        inner.current.rotation.x = THREE.MathUtils.lerp(inner.current.rotation.x, 0, 0.15);
        inner.current.rotation.z = THREE.MathUtils.lerp(inner.current.rotation.z, 0, 0.15);
        g.visible = true;
      } else {
        const age = T.time - b.deathT;
        inner.current.rotation.x = Math.min(Math.PI / 2, age * 5);
        inner.current.position.y = -Math.min(0.5, Math.max(0, age - 2.5) * 0.5);
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
    if (flashRef.current) flashRef.current.visible = T.time - b.flashT < 0.05;
  });

  return (
    <group ref={group}>
      <group ref={inner}>
        <primitive object={body} />
        <mesh ref={flashRef} position={[0.3, 1.4, -0.5]} visible={false}>
          <planeGeometry args={[0.3, 0.3]} />
          <meshBasicMaterial color="#ffe08a" transparent blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      </group>
    </group>
  );
}

function GhostBot({ index, url }: { index: number; url: string }) {
  const base = useGhostBase(url);
  return <BotBody index={index} base={base} />;
}

function StandInBot({ index }: { index: number }) {
  const body = useMemo(() => ghostStandIn(), []);
  return <BotBody index={index} base={body} />;
}

export function BotsView() {
  useSyncExternalStore(subscribeBots, getBotsVersion);
  const ghost = MODEL_STATE.ghost;
  const useGLB = ghost.ok && !ghost.placeholder;
  const count = bots.length || 4;

  return (
    <group>
      {Array.from({ length: count }, (_, i) =>
        useGLB ? (
          <Suspense key={`g${i}`} fallback={<StandInBot index={i} />}>
            <GhostBot index={i} url={ghost.url} />
          </Suspense>
        ) : (
          <StandInBot key={`s${i}`} index={i} />
        ),
      )}
    </group>
  );
}
