// Instanced tracers + confetti, pooled impact billboards, explosion light.
import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { FX } from './fx';
import { T } from '../store/transient';

const DUMMY = new THREE.Object3D();
const MAX_TRACERS = 32;
const MAX_CONFETTI = 90;
const MAX_IMPACTS = 16;

export function Effects() {
  const tracers = useRef<THREE.InstancedMesh>(null);
  const confetti = useRef<THREE.InstancedMesh>(null);
  const sparks = useRef<(THREE.Mesh | null)[]>([]);
  const light = useRef<THREE.PointLight>(null);
  const camera = useThree((s) => s.camera);

  const sparkGeo = useMemo(() => new THREE.PlaneGeometry(0.35, 0.35), []);
  const sparkMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#ffd27a', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
    [],
  );

  useFrame(() => {
    const t = T.time;

    // ---- tracers
    const tm = tracers.current;
    if (tm) {
      const n = Math.min(FX.tracers.length, MAX_TRACERS);
      for (let i = 0; i < n; i++) {
        const s = FX.tracers[i];
        DUMMY.position.set((s.ax + s.bx) / 2, (s.ay + s.by) / 2, (s.az + s.bz) / 2);
        DUMMY.lookAt(s.bx, s.by, s.bz);
        const len = Math.hypot(s.bx - s.ax, s.by - s.ay, s.bz - s.az);
        const fade = Math.max(0, 1 - (t - s.t0) / 0.09);
        DUMMY.scale.set(fade, fade, len);
        DUMMY.updateMatrix();
        tm.setMatrixAt(i, DUMMY.matrix);
      }
      tm.count = n;
      tm.instanceMatrix.needsUpdate = true;
    }

    // ---- confetti
    const cm = confetti.current;
    if (cm) {
      const n = Math.min(FX.confetti.length, MAX_CONFETTI);
      for (let i = 0; i < n; i++) {
        const c = FX.confetti[i];
        DUMMY.position.copy(c.p);
        DUMMY.rotation.set(c.rot, c.rot * 0.7, c.rot * 1.3);
        DUMMY.scale.setScalar(0.09);
        DUMMY.updateMatrix();
        cm.setMatrixAt(i, DUMMY.matrix);
        cm.setColorAt(i, c.c);
      }
      cm.count = n;
      cm.instanceMatrix.needsUpdate = true;
      if (cm.instanceColor) cm.instanceColor.needsUpdate = true;
    }

    // ---- impact billboards (newest first)
    const im = FX.impacts;
    for (let i = 0; i < MAX_IMPACTS; i++) {
      const mesh = sparks.current[i];
      if (!mesh) continue;
      const e = im[im.length - 1 - i];
      if (!e) { mesh.visible = false; continue; }
      const age = (t - e.t0) / 0.4;
      mesh.visible = true;
      mesh.position.set(e.x, e.y, e.z);
      mesh.quaternion.copy(camera.quaternion);
      const scale = e.kind === 'explosion' ? 1 + age * 9 : e.kind === 'blood' ? 0.6 + age * 1.2 : 0.4 + age * 1.6;
      mesh.scale.setScalar(scale);
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, 1 - age);
      mat.color.set(e.kind === 'blood' ? '#d23030' : e.kind === 'explosion' ? '#ffb347' : '#ffd27a');
    }

    // ---- explosion light
    if (light.current) {
      const on = t - FX.explosionT < 0.18;
      light.current.intensity = on ? 90 : 0;
      if (on && im.length) {
        const last = im[im.length - 1];
        light.current.position.set(last.x, last.y + 0.5, last.z);
      }
    }
  });

  return (
    <group>
      <instancedMesh ref={tracers} args={[undefined, undefined, MAX_TRACERS]} frustumCulled={false}>
        <boxGeometry args={[0.025, 0.025, 1]} />
        <meshBasicMaterial color="#aef0ff" transparent opacity={0.9} blending={THREE.AdditiveBlending} depthWrite={false} />
      </instancedMesh>
      <instancedMesh ref={confetti} args={[undefined, undefined, MAX_CONFETTI]} frustumCulled={false}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial side={THREE.DoubleSide} />
      </instancedMesh>
      {Array.from({ length: MAX_IMPACTS }, (_, i) => (
        <mesh key={i} ref={(r) => { sparks.current[i] = r; }} geometry={sparkGeo} material={sparkMat} visible={false} frustumCulled={false} />
      ))}
      <pointLight ref={light} intensity={0} distance={24} color="#ffb35c" />
    </group>
  );
}
