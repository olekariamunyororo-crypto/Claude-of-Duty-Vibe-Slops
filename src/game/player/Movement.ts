// Deterministic kinematic solver: depenetration + per-axis AABB sweeps +
// step-up + ground snap.
//
// Fix history: bots were clipping walls/floors because the per-axis sweep
// early-returned on `delta === 0`, which meant a collider that started a tick
// already overlapping geometry never got pushed out. depenetrate() below
// guarantees the invariant the sweep assumed: never begin a tick inside a box.
import * as THREE from 'three';
import { BOXES } from '../scene/Map';
import { T } from '../store/transient';
import { P } from './playerState';
import { Input, consumeJump, consumeLook } from '../input/InputManager';
import { useGame } from '../store/gameStore';
import { clamp } from '../utils/MathUtils';
import { SFX } from '../audio/AudioEngine';
import { bots } from '../ai/bots';

export const PLAYER = {
  radius: 0.4, height: 1.8,
  speedWalk: 5.2, speedSprint: 8.0, speedAds: 2.7,
  accelGround: 55, accelAir: 11, friction: 10,
  jumpVel: 5.6, gravity: 18, stepHeight: 0.55,
};

export interface MoveOut { grounded: boolean; hitWall: boolean; landed: boolean }
const out: MoveOut = { grounded: false, hitWall: false, landed: false };

function overlaps(px: number, py: number, pz: number, b: { min: [number, number, number]; max: [number, number, number] }): boolean {
  const r = PLAYER.radius, h = PLAYER.height;
  return px + r > b.min[0] && px - r < b.max[0] && py + h > b.min[1] && py < b.max[1] && pz + r > b.min[2] && pz - r < b.max[2];
}

/**
 * Push a collider out of any box it currently overlaps, along the axis of
 * least penetration. Two passes to handle corner cases where one push lands
 * the collider in another box. Runs before the per-axis sweeps so the sweep's
 * "delta === 0 → skip" shortcut can never let a stuck collider tunnel.
 */
function depenetrate(pos: THREE.Vector3, vel: THREE.Vector3): boolean {
  const r = PLAYER.radius, h = PLAYER.height;
  let moved = false;

  for (let pass = 0; pass < 2; pass++) {
    let deepest: { pen: number; axis: 0 | 1 | 2; sign: number } | null = null;

    for (const b of BOXES) {
      const dxPos = b.min[0] - (pos.x + r);
      const dxNeg = b.max[0] - (pos.x - r);
      const dyPos = b.min[1] - (pos.y + h);
      const dyNeg = b.max[1] - pos.y;
      const dzPos = b.min[2] - (pos.z + r);
      const dzNeg = b.max[2] - (pos.z - r);

      if (dxPos > 0 || dxNeg < 0) continue;
      if (dyPos > 0 || dyNeg < 0) continue;
      if (dzPos > 0 || dzNeg < 0) continue;

      const cands: [number, 0 | 1 | 2, number][] = [
        [Math.abs(dxPos), 0, +1],
        [Math.abs(dxNeg), 0, -1],
        [Math.abs(dyPos), 1, +1],
        [Math.abs(dyNeg), 1, -1],
        [Math.abs(dzPos), 2, +1],
        [Math.abs(dzNeg), 2, -1],
      ];
      for (const [pen, axis, sign] of cands) {
        if (!deepest || pen < deepest.pen) deepest = { pen, axis, sign };
      }
    }

    if (!deepest) break;
    const { axis, sign, pen } = deepest;
    if (axis === 0) { pos.x += sign * (pen + 0.001); vel.x = 0; }
    else if (axis === 1) { pos.y += sign * (pen + 0.001); vel.y = 0; }
    else { pos.z += sign * (pen + 0.001); vel.z = 0; }
    moved = true;
  }
  return moved;
}

export function collideMove(pos: THREE.Vector3, vel: THREE.Vector3, dt: number, o: MoveOut): void {
  const r = PLAYER.radius, step = PLAYER.stepHeight;
  o.grounded = false; o.hitWall = false; o.landed = false;

  depenetrate(pos, vel);

  const sweep = (axis: 'x' | 'z', delta: number) => {
    if (Math.abs(delta) < 1e-8) return;
    const np = pos[axis] + delta;
    for (const b of BOXES) {
      const nx = axis === 'x' ? np : pos.x, nz = axis === 'z' ? np : pos.z;
      if (!overlaps(nx, pos.y + 0.02, nz, b)) continue;
      let stepped = false;
      if (pos.y + step >= b.max[1] && pos.y < b.max[1] - 0.01) {
        let free = true;
        for (const c of BOXES) if (overlaps(nx, b.max[1] + 0.01, nz, c)) { free = false; break; }
        if (free) { pos.y = b.max[1] + 0.01; stepped = true; }
      }
      if (!stepped) {
        pos[axis] = axis === 'x'
          ? (delta > 0 ? b.min[0] - r - 0.001 : b.max[0] + r + 0.001)
          : (delta > 0 ? b.min[2] - r - 0.001 : b.max[2] + r + 0.001);
        vel[axis] = 0; o.hitWall = true;
        return;
      }
    }
    pos[axis] = np;
  };

  sweep('x', vel.x * dt);
  sweep('z', vel.z * dt);

  // Second depenetrate after horizontal move (catches residual overlaps).
  depenetrate(pos, vel);

  const ny = pos.y + vel.y * dt;
  if (vel.y <= 0) {
    let groundY = -100;
    for (const b of BOXES) {
      if (pos.x + r <= b.min[0] || pos.x - r >= b.max[0]) continue;
      if (pos.z + r <= b.min[2] || pos.z - r >= b.max[2]) continue;
      if (b.max[1] <= pos.y + 0.05 && b.max[1] >= ny - 0.3) groundY = Math.max(groundY, b.max[1]);
    }
    if (groundY > -99) {
      if (vel.y < -6) o.landed = true;
      pos.y = groundY; vel.y = 0; o.grounded = true;
    } else pos.y = ny;
  } else {
    let hitCeil = false;
    for (const b of BOXES) {
      if (!overlaps(pos.x, ny, pos.z, b)) continue;
      pos.y = b.min[1] - PLAYER.height - 0.001; vel.y = 0; hitCeil = true; break;
    }
    if (!hitCeil) pos.y = ny;
  }
  if (!o.grounded) {
    for (const b of BOXES) {
      if (pos.x + r <= b.min[0] || pos.x - r >= b.max[0]) continue;
      if (pos.z + r <= b.min[2] || pos.z - r >= b.max[2]) continue;
      if (Math.abs(pos.y - b.max[1]) < 0.02) { o.grounded = true; break; }
    }
  }
}

export function inPool(x: number, y: number, z: number): boolean {
  return x > 1.2 && x < 5.2 && z > -3.5 && z < 3.5 && y < 3.0 && y > 1.9;
}

/** Fixed-tick player update: look, wish-vel, gravity/jump, collide, bob, recoil decay. */
export function playerMove(dt: number): void {
  const tp = T.player;
  tp.prevPos.copy(tp.pos);

  if (P.pendingTeleport) {
    tp.pos.copy(P.pendingTeleport);
    tp.prevPos.copy(tp.pos);
    tp.vel.set(0, 0, 0);
    T.cam.yaw = P.pendingYaw; T.cam.pitch = 0;
    P.pendingTeleport = null;
    return;
  }

  const look = consumeLook();
  const sens = 0.0022 * (useGame.getState().settings.sens / 5) * (tp.ads > 0.5 ? 0.55 : 1);
  T.cam.yaw -= look.x * sens;
  T.cam.pitch = clamp(T.cam.pitch - look.y * sens, -1.45, 1.45);

  const adsTarget = Input.ads && !P.reloading && P.alive ? 1 : 0;
  tp.ads += (adsTarget - tp.ads) * Math.min(1, dt / 0.09);
  tp.sprint = !Input.ads && !Input.fire && (Input.sprint || Input.moveY() > 0.85);

  const sy = Math.sin(T.cam.yaw), cy = Math.cos(T.cam.yaw);
  const mx = Input.moveX(), my = Input.moveY();
  const mag = Math.min(1, Math.hypot(mx, my));
  const wishX = -sy * my + cy * mx;
  const wishZ = -cy * my - sy * mx;
  const wl = Math.hypot(wishX, wishZ) || 1;

  tp.inWater = inPool(tp.pos.x, tp.pos.y, tp.pos.z);
  let speed = tp.sprint ? PLAYER.speedSprint : tp.ads > 0.5 ? PLAYER.speedAds : PLAYER.speedWalk;
  if (tp.inWater) speed *= 0.55;

  const targetX = (wishX / wl) * speed * mag;
  const targetZ = (wishZ / wl) * speed * mag;
  const t = Math.min(1, ((tp.grounded ? PLAYER.accelGround : PLAYER.accelAir) * dt) / Math.max(speed, 0.001));
  if (mag > 0.01) {
    tp.vel.x += (targetX - tp.vel.x) * t;
    tp.vel.z += (targetZ - tp.vel.z) * t;
  } else if (tp.grounded) {
    const f = Math.max(0, 1 - PLAYER.friction * dt);
    tp.vel.x *= f; tp.vel.z *= f;
  }

  tp.vel.y -= PLAYER.gravity * dt;
  if (consumeJump() && tp.grounded && P.alive) {
    tp.vel.y = PLAYER.jumpVel;
    tp.grounded = false;
    SFX.play('jump', { gain: 0.4 });
  }

  const fallSpeed = tp.vel.y;
  collideMove(tp.pos, tp.vel, dt, out);
  tp.grounded = out.grounded;
  if (out.landed) {
    tp.landDip = Math.min(0.16, -fallSpeed * 0.018);
    SFX.play('land', { gain: 0.5 });
    T.shake = Math.max(T.shake, 0.02);
  }
  tp.landDip = Math.max(0, tp.landDip - dt * 0.8);

  const hSpeed = Math.hypot(tp.vel.x, tp.vel.z);
  if (tp.grounded && hSpeed > 0.5) {
    tp.bobPhase += hSpeed * dt * 1.7;
    tp.bobY = Math.sin(tp.bobPhase * 2) * 0.028;
    tp.stepAcc += hSpeed * dt;
    if (tp.stepAcc > 2.2) {
      tp.stepAcc = 0;
      SFX.play(Math.random() < 0.5 ? 'step' : 'step2', { gain: hSpeed > 6 ? 0.55 : 0.38 });
    }
  } else tp.bobY *= 0.8;

  // soft push-out vs bots
  for (const b of bots) {
    if (!b.alive) continue;
    const dx = tp.pos.x - b.pos.x, dz = tp.pos.z - b.pos.z;
    const d2 = dx * dx + dz * dz;
    if (d2 < 0.64 && d2 > 1e-6) {
      const d = Math.sqrt(d2), push = (0.8 - d) * 0.5;
      tp.pos.x += (dx / d) * push; tp.pos.z += (dz / d) * push;
    }
  }

  P.recoilP *= Math.max(0, 1 - 10 * dt);
  P.recoilY *= Math.max(0, 1 - 10 * dt);
  P.bloom = Math.max(0, P.bloom - dt * 6);
  T.viewmodel.kick *= Math.max(0, 1 - 14 * dt);
}
