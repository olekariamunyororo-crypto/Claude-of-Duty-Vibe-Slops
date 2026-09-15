// Camera rig: eye from T.player + bob + land dip + shake; recoil-additive angles.
import * as THREE from 'three';
import { T } from '../store/transient';
import { P } from './playerState';
import { useGame } from '../store/gameStore';
import { damp } from '../utils/MathUtils';

let shakeSeed = 0;
let fovCurrent = 75;

export function applyCamera(cam: THREE.Camera, dt: number): void {
  const tp = T.player;
  cam.position.set(tp.pos.x, tp.pos.y + 1.62 + tp.bobY - tp.landDip, tp.pos.z);

  T.shake = Math.max(0, T.shake - dt * 0.12);
  shakeSeed += dt * 60;
  if (T.shake > 0.0005) {
    cam.position.x += Math.sin(shakeSeed * 1.3) * T.shake;
    cam.position.y += Math.cos(shakeSeed * 1.7) * T.shake;
  }

  const pitch = T.cam.pitch + P.recoilP;
  const yaw = T.cam.yaw + P.recoilY;
  cam.rotation.order = 'YXZ';
  cam.rotation.y = yaw;
  cam.rotation.x = pitch;
  const hSpeed = Math.hypot(tp.vel.x, tp.vel.z);
  cam.rotation.z = tp.grounded ? Math.sin(tp.bobPhase) * 0.012 * Math.min(1, hSpeed / 5) : 0;

  cam.updateMatrixWorld();
  T.cam.pos.copy(cam.position);
  T.cam.quat.copy(cam.quaternion);
  T.cam.yaw = yaw; T.cam.pitch = pitch;

  const base = useGame.getState().settings.fov;
  const target = base + (55 - base) * tp.ads;
  fovCurrent = damp(fovCurrent, target, 14, dt);
  const pc = cam as THREE.PerspectiveCamera;
  if (pc.isPerspectiveCamera) { pc.fov = fovCurrent; pc.updateProjectionMatrix(); }
  T.cam.fov = fovCurrent;
}

export function viewDir(out: THREE.Vector3): THREE.Vector3 {
  const pitch = T.cam.pitch + P.recoilP;
  const yaw = T.cam.yaw + P.recoilY;
  const cp = Math.cos(pitch);
  return out.set(-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp).normalize();
}
