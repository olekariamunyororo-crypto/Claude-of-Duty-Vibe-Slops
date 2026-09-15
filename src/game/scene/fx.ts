// Pooled one-shot effects. Systems push, fxTick ages/integrates, Effects draws.
import * as THREE from 'three';
import { T } from '../store/transient';

export interface Tracer { ax: number; ay: number; az: number; bx: number; by: number; bz: number; t0: number }
export interface Impact { x: number; y: number; z: number; t0: number; kind: 'spark' | 'blood' | 'explosion' }
export interface Confetti { p: THREE.Vector3; v: THREE.Vector3; rot: number; rv: number; c: THREE.Color; t0: number }

const CONFETTI_COLORS = ['#ffd23d', '#ff5340', '#41d67c', '#41a8ff', '#c86bff', '#ff8ac2'].map((c) => new THREE.Color(c));

export const FX = {
  tracers: [] as Tracer[],
  impacts: [] as Impact[],
  confetti: [] as Confetti[],
  explosionT: -99,

  tracer(a: THREE.Vector3, b: THREE.Vector3) {
    this.tracers.push({ ax: a.x, ay: a.y, az: a.z, bx: b.x, by: b.y, bz: b.z, t0: T.time });
    if (this.tracers.length > 32) this.tracers.shift();
  },
  impact(x: number, y: number, z: number, kind: Impact['kind']) {
    this.impacts.push({ x, y, z, t0: T.time, kind });
    if (this.impacts.length > 40) this.impacts.shift();
  },
  confettiBurst(p: THREE.Vector3, n = 26) {
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.9, Math.random() - 0.5)
        .normalize().multiplyScalar(3 + Math.random() * 5);
      v.y += 2.5;
      this.confetti.push({
        p: p.clone(), v, rot: Math.random() * 6.28, rv: (Math.random() - 0.5) * 14,
        c: CONFETTI_COLORS[(Math.random() * CONFETTI_COLORS.length) | 0], t0: T.time,
      });
    }
    if (this.confetti.length > 90) this.confetti.splice(0, this.confetti.length - 90);
  },
  reset() {
    this.tracers.length = 0; this.impacts.length = 0; this.confetti.length = 0;
    this.explosionT = -99;
  },
};

export function fxTick(dt: number): void {
  const t = T.time;
  while (FX.tracers.length && t - FX.tracers[0].t0 > 0.09) FX.tracers.shift();
  while (FX.impacts.length && t - FX.impacts[0].t0 > 0.4) FX.impacts.shift();
  for (let i = FX.confetti.length - 1; i >= 0; i--) {
    const c = FX.confetti[i];
    if (t - c.t0 > 2.4) { FX.confetti.splice(i, 1); continue; }
    c.v.y -= 12 * dt;
    c.v.multiplyScalar(1 - 1.4 * dt);
    c.p.addScaledVector(c.v, dt);
    c.rot += c.rv * dt;
  }
}
