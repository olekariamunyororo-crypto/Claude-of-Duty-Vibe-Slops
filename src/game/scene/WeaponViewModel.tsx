// First-person NV4. NOT parented to the camera — world transform composed from
// T.cam each frame. useGLTF lives in its own component so hook order is stable.
import { Suspense, useMemo, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { T } from '../store/transient';
import { P } from '../player/playerState';
import { NV4 } from '../weapons/weaponData';
import { MODEL_STATE } from '../utils/GLBProbe';
import { registerSpecGlossExtension } from '../utils/GLTFSpecGloss';
import { cloneScene, nv4StandIn } from '../utils/ProceduralGeometry';

// Local-space offsets relative to the camera. Tuned for a ~0.7–0.9 m carbine.
const HIP = new THREE.Vector3(0.22, -0.28, -0.48);
const ADS = new THREE.Vector3(0.0, -0.175, -0.38);
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _euler = new THREE.Euler();

/**
 * Load + orient the Sketchfab NV4 so the barrel points down local −Z
 * (standard FPS convention). Many asset packs face +Z or +X by default.
 */
function Nv4Model({ url }: { url: string }) {
  const gltf = useGLTF(url, true, true, registerSpecGlossExtension) as { scene: THREE.Group };

  const model = useMemo(() => {
    const root = cloneScene(gltf.scene);

    // Normalize scale to a comfortable first-person length (~0.78 m).
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const longest = Math.max(size.x, size.y, size.z, 1e-6);
    const targetLen = 0.78;
    root.scale.setScalar(targetLen / longest);

    // Re-measure after scale.
    const box2 = new THREE.Box3().setFromObject(root);
    const c = box2.getCenter(new THREE.Vector3());
    root.position.sub(c); // center at origin

    // Orient: longest axis → −Z (barrel forward in FPS space).
    if (size.x >= size.z && size.x >= size.y) {
      root.rotation.y = -Math.PI / 2;
    } else if (size.z >= size.x && size.z >= size.y) {
      root.rotation.y = Math.PI;
    }

    // Final re-center after rotation so grip sits near origin.
    const box3 = new THREE.Box3().setFromObject(root);
    const c3 = box3.getCenter(new THREE.Vector3());
    root.position.x -= c3.x;
    root.position.y -= box3.min.y + 0.04;
    root.position.z -= c3.z;

    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = false;
        m.receiveShadow = false;
        if (m.material) {
          const mats = Array.isArray(m.material) ? m.material : [m.material];
          for (const mat of mats) {
            const std = mat as THREE.MeshStandardMaterial;
            if (std.isMeshStandardMaterial) {
              std.metalness = Math.min(std.metalness ?? 0.4, 0.55);
              std.roughness = Math.max(std.roughness ?? 0.5, 0.35);
              std.envMapIntensity = 0.6;
            }
          }
        }
      }
    });

    const wrap = new THREE.Group();
    wrap.add(root);
    return wrap;
  }, [gltf.scene]);

  return <primitive object={model} />;
}

export function WeaponViewModel() {
  const group = useRef<THREE.Group>(null);
  const flash = useRef<THREE.Mesh>(null);
  const light = useRef<THREE.PointLight>(null);
  const standIn = useMemo(() => nv4StandIn(), []);
  const nv4 = MODEL_STATE.nv4;
  const useGLB = nv4.ok && !nv4.placeholder;

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const tp = T.player;
    const rl = P.reloading ? Math.min(1, (T.time - P.reloadStart) / NV4.reloadTime) : 0;
    const rlDip = Math.sin(rl * Math.PI) * 0.12;
    const rlRot = Math.sin(rl * Math.PI) * 0.55;
    const bobAmt = (1 - tp.ads * 0.85) * Math.min(1, Math.hypot(tp.vel.x, tp.vel.z) / 5);
    const bx = Math.sin(tp.bobPhase) * 0.012 * bobAmt;
    const by = Math.abs(Math.cos(tp.bobPhase)) * 0.01 * bobAmt;
    const kick = T.viewmodel.kick;

    const fs = THREE.MathUtils.clamp(75 / T.cam.fov, 0.9, 1.15);

    _pos.set(
      THREE.MathUtils.lerp(HIP.x, ADS.x, tp.ads) + bx,
      THREE.MathUtils.lerp(HIP.y, ADS.y, tp.ads) + by - rlDip,
      THREE.MathUtils.lerp(HIP.z, ADS.z, tp.ads) + kick,
    ).applyQuaternion(T.cam.quat).multiplyScalar(fs).add(T.cam.pos);
    g.position.copy(_pos);

    _euler.set(kick * 1.4 + rlRot, 0, 0);
    _quat.setFromEuler(_euler).premultiply(T.cam.quat);
    g.quaternion.copy(_quat);

    g.updateWorldMatrix(true, false);
    T.viewmodel.muzzle.set(0, 0.04, -0.55).applyMatrix4(g.matrixWorld);

    const flashing = T.time - T.viewmodel.flash < 0.04;
    if (flash.current) flash.current.visible = flashing;
    if (light.current) light.current.intensity = flashing ? 22 : 0;
  });

  return (
    <group ref={group} scale={1}>
      {useGLB ? (
        <Suspense fallback={<primitive object={standIn} />}>
          <Nv4Model url={nv4.url} />
        </Suspense>
      ) : (
        <primitive object={standIn} />
      )}
      <mesh ref={flash} position={[0, 0.04, -0.62]} visible={false}>
        <planeGeometry args={[0.18, 0.18]} />
        <meshBasicMaterial color="#ffd77a" transparent opacity={0.95} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <pointLight ref={light} position={[0, 0.08, -0.55]} intensity={0} distance={7} color="#ffca66" />
    </group>
  );
}
