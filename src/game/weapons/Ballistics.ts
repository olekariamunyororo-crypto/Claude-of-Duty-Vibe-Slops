// Analytic hitscan: world AABBs vs head spheres / body cylinders. Deterministic.
import * as THREE from 'three';
import { rayWorld } from '../scene/Map';
import { rayCylinder, raySphere, coneDir } from '../utils/MathUtils';
import { T } from '../store/transient';
import { P, damagePlayer } from '../player/playerState';
import { bots, type Bot } from '../ai/bots';
import { useGame } from '../store/gameStore';
import { bus } from '../utils/Bus';
import { FX } from '../scene/fx';
import { SFX, spatial } from '../audio/AudioEngine';

function hitBot(o: THREE.Vector3, d: THREE.Vector3, bot: Bot, maxT: number): { t: number; head: boolean } | null {
  if (!bot.alive) return null;
  const th = raySphere(o.x, o.y, o.z, d.x, d.y, d.z, bot.pos.x, bot.pos.y + 1.62, bot.pos.z, 0.26, maxT);
  if (th >= 0) return { t: th, head: true };
  const tb = rayCylinder(o.x, o.y, o.z, d.x, d.y, d.z, bot.pos.x, bot.pos.z, bot.pos.y + 0.1, bot.pos.y + 1.52, 0.38, maxT);
  if (tb >= 0) return { t: tb, head: false };
  return null;
}

function damageMult(dist: number): number {
  if (dist >= 50) return 0.7;
  if (dist >= 32) return 0.85;
  return 1;
}

const _end = new THREE.Vector3();

export function playerFire(o: THREE.Vector3, dir: THREE.Vector3, dmgBody: number, dmgHead: number): void {
  const wallT = rayWorld(o, dir, 120);
  let best: Bot | null = null, bestT = wallT >= 0 ? wallT : 120, bestHead = false;
  for (const b of bots) {
    const h = hitBot(o, dir, b, bestT);
    if (h) { best = b; bestT = h.t; bestHead = h.head; }
  }

  _end.copy(dir).multiplyScalar(bestT).add(o);
  FX.tracer(T.viewmodel.muzzle.lengthSq() > 0 ? T.viewmodel.muzzle : o, _end);

  if (best) {
    const dmg = (bestHead ? dmgHead : dmgBody) * damageMult(bestT);
    best.hp -= dmg;
    best.hitFlashT = T.time;
    FX.impact(_end.x, _end.y, _end.z, 'blood');
    if (best.hp <= 0) {
      best.alive = false; best.deathT = T.time; best.respawnT = T.time + 4;
      useGame.getState().pushKill('YOU', best.name, 'NV-4', bestHead, true);
      bus.emit('kill', { name: best.name, headshot: bestHead });
      FX.confettiBurst(_end, 30);
      SFX.play('kill', { gain: 0.8 });
    } else {
      bus.emit('hit', { kill: false, dmg });
      bus.emit('dmg', dmg);
      SFX.play('hit', { gain: 0.55 });
    }
    return;
  }

  if (wallT >= 0) FX.impact(_end.x, _end.y, _end.z, 'spark');
}

export function botFire(bot: Bot, o: THREE.Vector3, aimAt: THREE.Vector3, spread: number): void {
  const dir = new THREE.Vector3().subVectors(aimAt, o).normalize();
  coneDir(dir, spread, dir);
  const wallT = rayWorld(o, dir, 90);
  const maxT = wallT >= 0 ? wallT : 90;

  let hitPlayerT = -1, hitPlayerHead = false;
  if (P.alive && T.time - P.spawnProtT > 1.2) {
    const tp = T.player.pos;
    const th = raySphere(o.x, o.y, o.z, dir.x, dir.y, dir.z, tp.x, tp.y + 1.62, tp.z, 0.26, maxT);
    const tb = rayCylinder(o.x, o.y, o.z, dir.x, dir.y, dir.z, tp.x, tp.z, tp.y + 0.1, tp.y + 1.52, 0.38, maxT);
    if (th >= 0) { hitPlayerT = th; hitPlayerHead = true; }
    else if (tb >= 0) hitPlayerT = tb;
  }
  let hitOther: Bot | null = null, hitOtherT = maxT, hitOtherHead = false;
  for (const other of bots) {
    if (other === bot) continue;
    const h = hitBot(o, dir, other, hitOtherT);
    if (h) { hitOther = other; hitOtherT = h.t; hitOtherHead = h.head; }
  }

  _end.copy(dir).multiplyScalar(Math.min(maxT, 90)).add(o);
  FX.tracer(o, _end);
  bot.flashT = T.time;
  const sp = spatial(o);
  SFX.play('shot', { gain: 0.45 * sp.gain, pan: sp.pan });
  SFX.play('shotFar', { gain: 0.5 * sp.gain, pan: sp.pan });

  if (hitPlayerT >= 0 && (!hitOther || hitPlayerT < hitOtherT)) {
    damagePlayer(hitPlayerHead ? 22 : 14, o, bot.name);
    FX.impact(T.player.pos.x, T.player.pos.y + 1.3, T.player.pos.z, 'blood');
  } else if (hitOther) {
    hitOther.hp -= hitOtherHead ? 24 : 15;
    hitOther.hitFlashT = T.time;
    FX.impact(_end.x, _end.y, _end.z, 'blood');
    if (hitOther.hp <= 0) {
      hitOther.alive = false; hitOther.deathT = T.time; hitOther.respawnT = T.time + 4;
      bot.score += 1;
      useGame.getState().pushKill(bot.name, hitOther.name, 'NV-4', hitOtherHead, false);
    }
  } else if (wallT >= 0) {
    FX.impact(_end.x, _end.y, _end.z, 'spark');
  }
}
