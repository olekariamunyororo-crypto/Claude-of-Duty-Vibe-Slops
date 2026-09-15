import * as THREE from 'three';
import { NV4 } from './weaponData';
import { recoilShot } from './Recoil';
import { playerFire } from './Ballistics';
import { viewDir } from '../player/Camera';
import { P } from '../player/playerState';
import { T } from '../store/transient';
import { Input, consumeReload, consumeNade } from '../input/InputManager';
import { coneDir } from '../utils/MathUtils';
import { bus } from '../utils/Bus';
import { SFX } from '../audio/AudioEngine';

let nextShot = 0;
const _o = new THREE.Vector3();
const _d = new THREE.Vector3();

export function weaponTick(dt: number): void {
  void dt;
  if (!P.alive) return;

  if (consumeNade()) bus.emit('toast', 'Frags unlock in Vibe Slops III 😤');

  if (P.reloading) {
    if (T.time >= P.reloadEnd) {
      const take = Math.min(NV4.magSize - P.mag, P.reserve);
      P.mag += take; P.reserve -= take;
      P.reloading = false;
      SFX.play('reloadB', { gain: 0.6 });
    }
    return;
  }

  if (consumeReload()) tryReload();

  if (Input.fire && T.time >= nextShot) {
    if (P.mag <= 0) {
      SFX.play('empty', { gain: 0.5 });
      nextShot = T.time + 0.3;
      tryReload();
      return;
    }
    P.mag -= 1;
    nextShot = T.time + 60 / NV4.rpm;
    _o.copy(T.cam.pos);
    viewDir(_d);
    const spread = (T.player.ads > 0.5 ? NV4.spreadAds : NV4.spreadHip) + P.bloom;
    T.weapon.spread = spread;
    coneDir(_d, spread, _d);
    playerFire(_o, _d, NV4.damageBody, NV4.damageHead);
    recoilShot();
    P.bloom = Math.min(NV4.bloomMax, P.bloom + NV4.bloomPerShot);
    // Milder viewmodel kick so the gun stays readable in ADS
    T.viewmodel.kick = Math.min(0.032, T.viewmodel.kick + 0.014);
    T.viewmodel.flash = T.time;
    T.shake = Math.max(T.shake, T.player.ads > 0.5 ? 0.006 : 0.012);
    SFX.play('shot', { gain: 0.85, rate: 0.96 + Math.random() * 0.08 });
  } else {
    T.weapon.spread = (T.player.ads > 0.5 ? NV4.spreadAds : NV4.spreadHip) + P.bloom;
  }
}

export function tryReload(): void {
  if (P.reloading || P.mag >= NV4.magSize || P.reserve <= 0) return;
  P.reloading = true;
  P.reloadStart = T.time;
  P.reloadEnd = T.time + NV4.reloadTime;
  SFX.play('reloadA', { gain: 0.6 });
}

export function resetWeapon(): void {
  nextShot = 0;
}
