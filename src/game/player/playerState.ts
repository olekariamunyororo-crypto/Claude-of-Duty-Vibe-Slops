// P: discrete player combat state + damage/respawn + 8 Hz HUD sync (matchTick).
import * as THREE from 'three';
import { T } from '../store/transient';
import { useGame, KILL_TARGET } from '../store/gameStore';
import { SPAWNS } from '../scene/Map';
import { bots } from '../ai/bots';
import { bus } from '../utils/Bus';
import { SFX } from '../audio/AudioEngine';
import { resetRecoil } from '../weapons/Recoil';
import { resetWeapon } from '../weapons/WeaponState';

export const P = {
  hp: 100, maxHp: 100, alive: true, deadT: 0,
  lastDamageT: -99, spawnProtT: -99,
  mag: 30, reserve: 120,
  reloading: false, reloadStart: 0, reloadEnd: 0,
  bloom: 0, recoilP: 0, recoilY: 0,
  pendingTeleport: null as THREE.Vector3 | null,
  pendingYaw: 0,
};

export function damagePlayer(amount: number, fromPos: { x: number; y: number; z: number }, killer: string): void {
  const st = useGame.getState();
  if (!P.alive || st.phase !== 'playing') return;
  if (T.time - P.spawnProtT < 1.2) return;
  P.hp -= amount;
  P.lastDamageT = T.time;
  T.shake = Math.max(T.shake, 0.035);
  bus.emit('hurt', Math.atan2(fromPos.x - T.player.pos.x, -(fromPos.z - T.player.pos.z)) + T.cam.yaw);
  SFX.play('hurt', { gain: 0.7 });
  if (P.hp <= 0) {
    P.hp = 0; P.alive = false; P.deadT = T.time;
    const bot = bots.find((b) => b.name === killer);
    if (bot) bot.score += 1;
    st.pushKill(killer, 'YOU', 'NV-4', false, false);
    st.setDeath(killer);
    SFX.play('explode', { gain: 0.3, rate: 1.7 });
  }
}

export function respawnPlayer(): void {
  let best = SPAWNS[0], bestD = -1;
  for (const s of SPAWNS) {
    let minD = 1e9;
    for (const b of bots) if (b.alive) minD = Math.min(minD, s.pos.distanceToSquared(b.pos));
    if (minD > bestD) { bestD = minD; best = s; }
  }
  P.pendingTeleport = best.pos.clone();
  P.pendingYaw = best.yaw;
  P.hp = P.maxHp; P.alive = true;
  P.mag = 30; P.reserve = 120;
  P.reloading = false; P.bloom = 0;
  P.spawnProtT = T.time;
  resetRecoil(); resetWeapon();
  useGame.getState().setDeath(null);
}

let hudAcc = 0;
let lastSig = '';

/** matchTick: respawn timing, feed expiry, HUD throttle (8 Hz), victory. */
export function matchTick(dt: number): void {
  const st = useGame.getState();

  if (!P.alive && st.death && T.time - P.deadT > 3.4) respawnPlayer();
  st.expireFeed();

  hudAcc += dt;
  if (hudAcc < 0.125) return;
  hudAcc = 0;

  let bestName = st.best.name, bestScore = st.best.score;
  for (const b of bots) if (b.score > bestScore) { bestName = b.name; bestScore = b.score; }
  if (bestName !== st.best.name || bestScore !== st.best.score) st.setBest(bestName, bestScore);
  if (st.score >= KILL_TARGET || bestScore >= KILL_TARGET) { st.setPhase('results'); return; }

  const sig = `${Math.round(P.hp)}|${P.mag}|${P.reserve}|${P.alive}|${P.reloading}`;
  if (sig !== lastSig) {
    lastSig = sig;
    st.setHud({
      hp: Math.round(P.hp), mag: P.mag, reserve: P.reserve,
      alive: P.alive, weapon: 'NV-4', reloading: P.reloading,
    });
  }
}

export function resetP(): void {
  P.hp = P.maxHp; P.alive = true; P.deadT = 0;
  P.lastDamageT = -99; P.spawnProtT = -99;
  P.mag = 30; P.reserve = 120;
  P.reloading = false; P.bloom = 0; P.recoilP = 0; P.recoilY = 0;
  P.pendingTeleport = null; P.pendingYaw = 0;
  useGame.getState().setDeath(null);
}
