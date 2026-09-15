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
  spreadHip: 2.2 * DEG, spreadAds: 0.3 * DEG,
  bloomPerShot: 0.16 * DEG, bloomMax: 2.4 * DEG,
  reloadTime: 1.9,
  recoilPitch: [0.55, 0.95], recoilYaw: [0.15, 0.55],
};
