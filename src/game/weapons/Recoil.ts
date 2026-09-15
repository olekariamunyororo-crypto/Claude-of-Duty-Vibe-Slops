import { NV4, type WeaponDef } from './weaponData';
import { DEG, randRange } from '../utils/MathUtils';
import { P } from '../player/playerState';
import { T } from '../store/transient';

export function recoilShot(def: WeaponDef = NV4): void {
  const amp = T.player.ads > 0.5 ? 0.75 : 1;
  P.recoilP += randRange(def.recoilPitch[0], def.recoilPitch[1]) * DEG * amp;
  P.recoilY += (Math.random() < 0.5 ? -1 : 1) * randRange(def.recoilYaw[0], def.recoilYaw[1]) * DEG * amp;
}

export function resetRecoil(): void {
  P.recoilP = 0; P.recoilY = 0;
}
