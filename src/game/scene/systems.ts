import { T } from '../store/transient';

export type Tick = (dt: number) => void;
const ticks: Tick[] = [];

export function registerTick(t: Tick): () => void {
  ticks.push(t);
  return () => { const i = ticks.indexOf(t); if (i >= 0) ticks.splice(i, 1); };
}

export function runTicks(dt: number): void {
  T.time += dt;
  for (const t of ticks) t(dt);
}

export const STEP = 1 / 60;
