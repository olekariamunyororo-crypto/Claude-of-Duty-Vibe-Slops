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
import { nv4StandIn, useNormalizedModel } from '../utils/ProceduralGeometry';

const HIP = new THREE.Vector3(0.26, -0.3, -0.55);
const ADS = new THREE.Vector3(0, -0.185, -0.42);
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _euler = new THREE.Euler();

function Nv4Model({ url }: { url: string }) {
  const gltf = useGLTF(url, true, true, registerSpecGlossExtension) as { scene: THREE.Group };
  const normalized = useNormalizedModel(gltf.scene, 0.85);
  return <primitive object={normalized} />;
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
    const rlDip = Math.sin(rl * Math.PI) * 0.16;
    const rlRot = Math.sin(rl * Math.PI) * 0.7;
    const bobAmt = (1 - tp.ads * 0.8) * Math.min(1, Math.hypot(tp.vel.x, tp.vel.z) / 5);
    const bx = Math.sin(tp.bobPhase) * 0.014 * bobAmt;
    const by = Math.abs(Math.cos(tp.bobPhase)) * 0.012 * bobAmt;
    const kick = T.viewmodel.kick;

    // FOV-size compensation keeps the gun visually consistent across ADS zoom
    const fs = THREE.MathUtils.clamp(75 / T.cam.fov, 0.9, 1.15);

    _pos.set(
      THREE.MathUtils.lerp(HIP.x, ADS.x, tp.ads) + bx,
      THREE.MathUtils.lerp(HIP.y, ADS.y, tp.ads) + by - rlDip,
      THREE.MathUtils.lerp(HIP.z, ADS.z, tp.ads) + kick,
    ).applyQuaternion(T.cam.quat).multiplyScalar(fs).add(T.cam.pos);
    g.position.copy(_pos);

    _euler.set(kick * 2 + rlRot, 0, 0);
    _quat.setFromEuler(_euler).premultiply(T.cam.quat);
    g.quaternion.copy(_quat);

    g.updateWorldMatrix(true, false);
    T.viewmodel.muzzle.set(0, 0.06, -0.5).applyMatrix4(g.matrixWorld);

    const flashing = T.time - T.viewmodel.flash < 0.045;
    if (flash.current) flash.current.visible = flashing;
    if (light.current) light.current.intensity = flashing ? 30 : 0;
  });

  return (
    <group ref={group} scale={0.92}>
      {useGLB ? <Suspense fallback={null}><Nv4Model url={nv4.url} /></Suspense> : <primitive object={standIn} />}
      <mesh ref={flash} position={[0, 0.06, -0.58]} visible={false}>
        <planeGeometry args={[0.22, 0.22]} />
        <meshBasicMaterial color="#ffd77a" transparent opacity={0.95} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <pointLight ref={light} position={[0, 0.1, -0.6]} intensity={0} distance={9} color="#ffca66" />
    </group>
  );
}
