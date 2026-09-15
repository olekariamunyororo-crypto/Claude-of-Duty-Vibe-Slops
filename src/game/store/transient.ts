// Per-frame mutable channel. Systems write, renderers read. Nothing in React
// subscribes to this — high-frequency data bypasses the reactive system.
import * as THREE from 'three';

export const T = {
  time: 0,
  alpha: 0,
  fps: 60,
  shake: 0,
  cam: { pos: new THREE.Vector3(0, 5.04, -25), quat: new THREE.Quaternion(), yaw: Math.PI, pitch: 0, fov: 75 },
  player: {
    pos: new THREE.Vector3(0, 3.42, -25),
    prevPos: new THREE.Vector3(0, 3.42, -25),
    vel: new THREE.Vector3(),
    grounded: true, sprint: false, ads: 0,
    bobPhase: 0, bobY: 0, landDip: 0, stepAcc: 0, inWater: false,
  },
  viewmodel: { kick: 0, flash: -99, muzzle: new THREE.Vector3() },
  weapon: { spread: 0.04 },
};

export function resetT(): void {
  T.time = 0; T.alpha = 0; T.fps = 60; T.shake = 0;
  T.cam.pos.set(0, 5.04, -25); T.cam.yaw = Math.PI; T.cam.pitch = 0; T.cam.fov = 75;
  T.cam.quat.identity();
  T.player.pos.set(0, 3.42, -25); T.player.prevPos.copy(T.player.pos);
  T.player.vel.set(0, 0, 0);
  T.player.grounded = true; T.player.sprint = false; T.player.ads = 0;
  T.player.bobPhase = 0; T.player.bobY = 0; T.player.landDip = 0; T.player.stepAcc = 0;
  T.viewmodel.kick = 0; T.viewmodel.flash = -99;
  T.weapon.spread = 0.04;
}
