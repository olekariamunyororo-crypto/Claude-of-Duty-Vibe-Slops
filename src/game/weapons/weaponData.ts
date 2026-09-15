import { DEG } from '../utils/MathUtils';

export interface WeaponDef {
  name: string; rpm: number; magSize: number; reserveMax: number;
  damageBody: number; damageHead: number;
  spreadHip: number; spreadAds: number; bloomPerShot: number; bloomMax: number;
  reloadTime: number;
  recoilPitch: [number, number]; recoilYaw: [number, number];
}

export const NV4: WeaponDef = {
  name: 'NV-4',
  rpm: 750, magSize: 30, reserveMax: 120,
  damageBody: 26, damageHead: 42,
  spreadHip: 1.8 * DEG, spreadAds: 0.22 * DEG,
  bloomPerShot: 0.10 * DEG, bloomMax: 1.6 * DEG,
  reloadTime: 1.9,
  // Reduced recoil — controllable full-auto, still readable feedback
  recoilPitch: [0.22, 0.40], recoilYaw: [0.06, 0.20],
};
