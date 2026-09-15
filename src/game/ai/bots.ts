// 4 FFA Ghost clones: staggered LOS perception, BFS patrol, strafe combat, respawn.
//
// v2.3 fixes:
//  - Patrol 3.2 u/s, combat 2.6 u/s (was 4.4 / 3.6). The static mesh read as
//    "gliding" at the old speeds; the procedural gait in BotsView is tuned to
//    this range.
//  - respawn() depenetrates the spawn point so a bot never starts inside a box.
//  - On hitWall: kill most horizontal velocity and force a repath so bots do not
//    keep driving into geometry.
import * as THREE from 'three';
import { NAV, SPAWNS, BOXES, nearestNode, bfsPath, losBlocked } from '../scene/Map';
import { collideMove, PLAYER } from '../player/Movement';
import { botFire } from '../weapons/Ballistics';
import { T } from '../store/transient';
import { P } from '../player/playerState';
import { randRange, clamp } from '../utils/MathUtils';

export interface Bot {
  id: number; name: string;
  pos: THREE.Vector3; prevPos: THREE.Vector3; vel: THREE.Vector3; yaw: number;
  hp: number; alive: boolean; respawnT: number; deathT: number;
  state: 'patrol' | 'combat';
  path: number[]; repathT: number;
  seeT: number; reactT: number; fireT: number; burst: number;
  strafe: number; strafeT: number;
  score: number; flashT: number; hitFlashT: number;
}

export const bots: Bot[] = [];

const NAMES = ['GHOST_01', 'GHOST_02', 'GHOST_03', 'GHOST_04'];
const moveOut = { grounded: false, hitWall: false, landed: false };
const eye = new THREE.Vector3();
const targetEye = new THREE.Vector3();
const aim = new THREE.Vector3();

let version = 0;
const listeners = new Set<() => void>();
export function subscribeBots(cb: () => void): () => void { listeners.add(cb); return () => { listeners.delete(cb); }; }
export function getBotsVersion(): number { return version; }
function bump() { version++; listeners.forEach((l) => l()); }

function pickSpawn(self?: Bot): THREE.Vector3 {
  let best = SPAWNS[0], bestD = -1;
  for (let i = 0; i < 3; i++) {
    const s = SPAWNS[(Math.random() * SPAWNS.length) | 0];
    let minD = 1e9;
    if (T.player.pos) minD = Math.min(minD, s.pos.distanceToSquared(T.player.pos));
    for (const b of bots) if (b !== self && b.alive) minD = Math.min(minD, s.pos.distanceToSquared(b.pos));
    if (minD > bestD) { bestD = minD; best = s; }
  }
  return best.pos.clone();
}

function freshBot(i: number): Bot {
  return {
    id: i, name: NAMES[i % NAMES.length],
    pos: new THREE.Vector3(), prevPos: new THREE.Vector3(), vel: new THREE.Vector3(), yaw: 0,
    hp: 100, alive: true, respawnT: 0, deathT: -99,
    state: 'patrol', path: [], repathT: 0,
    seeT: -99, reactT: 0, fireT: 0, burst: 0,
    strafe: 1, strafeT: 0,
    score: 0, flashT: -99, hitFlashT: -99,
  };
}

export function resetBots(count = 4): void {
  bots.length = 0;
  for (let i = 0; i < count; i++) {
    const b = freshBot(i);
    b.pos.copy(pickSpawn());
    b.prevPos.copy(b.pos);
    b.yaw = Math.atan2(T.player.pos.x - b.pos.x, T.player.pos.z - b.pos.z) + Math.PI;
    bots.push(b);
  }
  bump();
}

function respawn(bot: Bot): void {
  bot.pos.copy(pickSpawn(bot));
  // Safety net: if a spawn point resolves inside a box (deck-height mismatch,
  // stairwell overlap), lift the bot on top of it.
  for (const b of BOXES) {
    if (bot.pos.x + PLAYER.radius > b.min[0] && bot.pos.x - PLAYER.radius < b.max[0] &&
        bot.pos.z + PLAYER.radius > b.min[2] && bot.pos.z - PLAYER.radius < b.max[2] &&
        bot.pos.y + PLAYER.height > b.min[1] && bot.pos.y < b.max[1]) {
      bot.pos.y = b.max[1] + 0.01;
    }
  }
  bot.prevPos.copy(bot.pos);
  bot.vel.set(0, 0, 0);
  bot.hp = 100; bot.alive = true; bot.state = 'patrol';
  bot.path = []; bot.seeT = -99; bot.repathT = 0;
}

export function botsTick(dt: number): void {
  const t = T.time;

  for (const bot of bots) {
    if (!bot.alive) {
      if (t >= bot.respawnT) respawn(bot);
      continue;
    }
    bot.prevPos.copy(bot.pos);

    if ((bot.id + Math.floor(t * 4)) % 2 === 0) {
      let saw = false;
      if (P.alive && t - P.spawnProtT > 1.2) {
        eye.set(bot.pos.x, bot.pos.y + 1.6, bot.pos.z);
        targetEye.set(T.player.pos.x, T.player.pos.y + 1.5, T.player.pos.z);
        if (eye.distanceTo(targetEye) < 46 && !losBlocked(eye, targetEye)) {
          bot.seeT = t; saw = true;
        }
      }
      if (saw) bot.state = 'combat';
      else if (t - bot.seeT > 2.2) bot.state = 'patrol';
    }

    let wishX = 0, wishZ = 0, speed = 3.2;   // was 4.4
    let faceX = 0, faceZ = 0;

    if (bot.state === 'combat') {
      const dx = T.player.pos.x - bot.pos.x, dz = T.player.pos.z - bot.pos.z;
      const d = Math.hypot(dx, dz) || 1;
      faceX = dx / d; faceZ = dz / d;

      bot.strafeT -= dt;
      if (bot.strafeT <= 0) { bot.strafe *= -1; bot.strafeT = randRange(0.7, 1.7); }
      wishX = -faceZ * bot.strafe * 0.8;
      wishZ = faceX * bot.strafe * 0.8;
      if (d > 26) { wishX += faceX; wishZ += faceZ; }
      else if (d < 7) { wishX -= faceX; wishZ -= faceZ; }
      const wl = Math.hypot(wishX, wishZ) || 1;
      wishX /= wl; wishZ /= wl; speed = 2.6;   // was 3.6

      if (t - bot.seeT < 0.6 && t > bot.reactT) {
        bot.fireT -= dt;
        if (bot.burst > 0 && bot.fireT <= 0) {
          eye.set(bot.pos.x, bot.pos.y + 1.45, bot.pos.z);
          targetEye.set(T.player.pos.x, T.player.pos.y + randRange(0.9, 1.6), T.player.pos.z);
          if (!losBlocked(eye, targetEye)) {
            bot.burst -= 1;
            bot.fireT = 0.14;
            aim.copy(targetEye);
            botFire(bot, eye, aim, 0.045 + eye.distanceTo(targetEye) * 0.0012);
          } else bot.burst = 0;
          if (bot.burst <= 0) bot.reactT = t + randRange(0.5, 1.0);
        } else if (bot.burst <= 0) {
          bot.burst = 3 + ((Math.random() * 4) | 0);
          bot.reactT = t + randRange(0.35, 0.6);
        }
      }
    } else {
      if (bot.path.length === 0 && t > bot.repathT) {
        bot.repathT = t + randRange(3, 6);
        bot.path = bfsPath(nearestNode(bot.pos), (Math.random() * NAV.length) | 0);
      }
      const node = bot.path.length ? NAV[bot.path[0]] : null;
      if (node) {
        const dx = node.p.x - bot.pos.x, dz = node.p.z - bot.pos.z;
        const d = Math.hypot(dx, dz);
        if (d < 1.2) bot.path.shift();
        else { wishX = dx / d; wishZ = dz / d; }
      }
      if (Math.hypot(bot.vel.x, bot.vel.z) < 0.4 && t > bot.repathT - 2.5) {
        bot.repathT = Math.min(bot.repathT, t + 0.5);
        bot.path = [];
      }
      faceX = wishX; faceZ = wishZ;
    }

    const wl2 = Math.hypot(wishX, wishZ);
    const tvx = wl2 > 0.01 ? (wishX / wl2) * speed : 0;
    const tvz = wl2 > 0.01 ? (wishZ / wl2) * speed : 0;
    bot.vel.x += (tvx - bot.vel.x) * Math.min(1, 8 * dt);
    bot.vel.z += (tvz - bot.vel.z) * Math.min(1, 8 * dt);
    bot.vel.y -= PLAYER.gravity * dt;

    collideMove(bot.pos, bot.vel, dt, moveOut);

    // If we hit a wall, stop pushing into it and force a repath soon.
    if (moveOut.hitWall) {
      bot.vel.x *= 0.15;
      bot.vel.z *= 0.15;
      if (bot.state === 'patrol') {
        bot.path = [];
        bot.repathT = Math.min(bot.repathT, t + 0.4);
      }
    }

    if (faceX !== 0 || faceZ !== 0) {
      const want = Math.atan2(-faceX, -faceZ);
      let diff = want - bot.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      bot.yaw += clamp(diff, -6 * dt, 6 * dt);
    }
  }
}
