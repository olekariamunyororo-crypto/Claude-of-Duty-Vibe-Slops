import * as THREE from 'three';

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const damp = (a: number, b: number, lambda: number, dt: number) => lerp(a, b, 1 - Math.exp(-lambda * dt));
export const randRange = (a: number, b: number) => a + Math.random() * (b - a);
export const DEG = Math.PI / 180;

export interface AABB { min: [number, number, number]; max: [number, number, number] }

/** Ray vs axis-aligned box (slab). Returns entry t or -1. */
export function rayBox(
  ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, b: AABB, maxT: number,
): number {
  let tmin = 0, tmax = maxT;
  if (Math.abs(dx) < 1e-8) { if (ox < b.min[0] || ox > b.max[0]) return -1; }
  else { let t1 = (b.min[0] - ox) / dx, t2 = (b.max[0] - ox) / dx; if (t1 > t2) { const t = t1; t1 = t2; t2 = t; } tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2); if (tmin > tmax) return -1; }
  if (Math.abs(dy) < 1e-8) { if (oy < b.min[1] || oy > b.max[1]) return -1; }
  else { let t1 = (b.min[1] - oy) / dy, t2 = (b.max[1] - oy) / dy; if (t1 > t2) { const t = t1; t1 = t2; t2 = t; } tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2); if (tmin > tmax) return -1; }
  if (Math.abs(dz) < 1e-8) { if (oz < b.min[2] || oz > b.max[2]) return -1; }
  else { let t1 = (b.min[2] - oz) / dz, t2 = (b.max[2] - oz) / dz; if (t1 > t2) { const t = t1; t1 = t2; t2 = t; } tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2); if (tmin > tmax) return -1; }
  return tmin;
}

/** Ray vs vertical cylinder. Returns t or -1. */
export function rayCylinder(
  ox: number, oy: number, oz: number, dx: number, dy: number, dz: number,
  cx: number, cz: number, y0: number, y1: number, r: number, maxT: number,
): number {
  const mx = ox - cx, mz = oz - cz;
  const a = dx * dx + dz * dz;
  const b = 2 * (mx * dx + mz * dz);
  const c = mx * mx + mz * mz - r * r;
  if (a < 1e-8) return -1;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return -1;
  const sq = Math.sqrt(disc);
  let t = (-b - sq) / (2 * a);
  if (t < 0) t = (-b + sq) / (2 * a);
  if (t < 0 || t > maxT) return -1;
  const y = oy + dy * t;
  if (y < y0 || y > y1) return -1;
  return t;
}

/** Ray vs sphere (dir must be normalized). Returns t or -1. */
export function raySphere(
  ox: number, oy: number, oz: number, dx: number, dy: number, dz: number,
  cx: number, cy: number, cz: number, r: number, maxT: number,
): number {
  const mx = ox - cx, my = oy - cy, mz = oz - cz;
  const b = 2 * (mx * dx + my * dy + mz * dz);
  const c = mx * mx + my * my + mz * mz - r * r;
  const disc = b * b - 4 * c;
  if (disc < 0) return -1;
  const sq = Math.sqrt(disc);
  let t = (-b - sq) / 2;
  if (t < 0) t = (-b + sq) / 2;
  if (t < 0 || t > maxT) return -1;
  return t;
}

const _u = new THREE.Vector3();
const _v = new THREE.Vector3();
/** Jitter dir into a cone of half-angle `spread` (radians). */
export function coneDir(dir: THREE.Vector3, spread: number, out: THREE.Vector3): THREE.Vector3 {
  out.copy(dir).normalize();
  if (spread <= 0) return out;
  if (Math.abs(out.y) < 0.99) _u.set(0, 1, 0).cross(out).normalize();
  else _u.set(1, 0, 0).cross(out).normalize();
  _v.crossVectors(out, _u);
  const ang = Math.random() * Math.PI * 2;
  const rad = Math.sqrt(Math.random()) * spread;
  out.addScaledVector(_u, Math.cos(ang) * rad).addScaledVector(_v, Math.sin(ang) * rad).normalize();
  return out;
}
