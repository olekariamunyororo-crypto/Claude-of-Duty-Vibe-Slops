import { resetT } from '../store/transient';
import { resetP } from '../player/playerState';
import { resetBots } from '../ai/bots';
import { FX } from './fx';
import { resetWeapon } from '../weapons/WeaponState';

export function resetMatch(): void {
  resetT();
  resetP();
  resetBots(4);
  FX.reset();
  resetWeapon();
}
