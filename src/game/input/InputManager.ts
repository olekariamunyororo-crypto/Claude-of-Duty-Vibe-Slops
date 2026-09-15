// Module-scope input singleton. Keyboard/mouse/pointer-lock; touch writes the
// same fields (summed on read). Edge-triggered actions are consumed by ticks.
import { useGame } from '../store/gameStore';

export const IS_TOUCH: boolean =
  (typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches) ||
  (typeof window !== 'undefined' && 'ontouchstart' in window);

class InputState {
  enabled = false;      // true only while phase === 'playing'
  locked = false;
  keys = new Set<string>();
  lookX = 0; lookY = 0;
  touchMoveX = 0; touchMoveY = 0;
  touchLookX = 0; touchLookY = 0;
  fire = false; ads = false; sprint = false;
  jumpQ = false; reloadQ = false; nadeQ = false;

  moveX(): number {
    let x = 0;
    if (this.enabled) {
      if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
      if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    }
    return Math.max(-1, Math.min(1, x + this.touchMoveX));
  }
  moveY(): number {
    let y = 0;
    if (this.enabled) {
      if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y -= 1;
      if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y += 1;
    }
    return Math.max(-1, Math.min(1, y + this.touchMoveY));
  }
  consumeLook(): { x: number; y: number } {
    const x = this.lookX + this.touchLookX;
    const y = this.lookY + this.touchLookY;
    this.lookX = 0; this.lookY = 0; this.touchLookX = 0; this.touchLookY = 0;
    return { x, y };
  }
  consumeJump(): boolean { const v = this.jumpQ; this.jumpQ = false; return v; }
  consumeReload(): boolean { const v = this.reloadQ; this.reloadQ = false; return v; }
  consumeNade(): boolean { const v = this.nadeQ; this.nadeQ = false; return v; }
  clearHeld(): void {
    this.keys.clear(); this.fire = false; this.ads = false; this.sprint = false;
    this.touchMoveX = 0; this.touchMoveY = 0;
  }
  resetAll(): void { this.clearHeld(); this.jumpQ = false; this.reloadQ = false; this.nadeQ = false; }
}

export const Input = new InputState();

export function consumeJump(): boolean { return Input.consumeJump(); }
export function consumeLook(): { x: number; y: number } { return Input.consumeLook(); }
export function consumeReload(): boolean { return Input.consumeReload(); }
export function consumeNade(): boolean { return Input.consumeNade(); }

export function addTouchLook(dx: number, dy: number): void {
  Input.touchLookX += dx * 2.4;
  Input.touchLookY += dy * 2.4;
}

export function requestLock(canvas: HTMLCanvasElement): void {
  if (IS_TOUCH) return;
  try { void canvas.requestPointerLock(); } catch { /* ignore */ }
}

export function releaseLock(): void {
  try { document.exitPointerLock(); } catch { /* ignore */ }
}

export function resetInput(): void { Input.resetAll(); }

let inited = false;

export function initInput(canvas: HTMLCanvasElement): void {
  if (inited) return;
  inited = true;

  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') e.preventDefault();
    if (!Input.enabled) return;
    Input.keys.add(e.code);
    if (e.code === 'Space') Input.jumpQ = true;
    if (e.code === 'KeyR') Input.reloadQ = true;
    if (e.code === 'KeyG') Input.nadeQ = true;
    if (e.code === 'KeyP') useGame.getState().setPhase('paused');
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') Input.sprint = true;
  });
  document.addEventListener('keyup', (e) => {
    Input.keys.delete(e.code);
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') Input.sprint = false;
  });

  document.addEventListener('mousemove', (e) => {
    if (Input.locked && Input.enabled) {
      Input.lookX += e.movementX;
      Input.lookY += e.movementY;
    }
  });
  document.addEventListener('mousedown', (e) => {
    if (!Input.enabled) return;
    if (e.button === 0) Input.fire = true;
    if (e.button === 2) Input.ads = true;
  });
  document.addEventListener('mouseup', (e) => {
    if (e.button === 0) Input.fire = false;
    if (e.button === 2) Input.ads = false;
  });

  document.addEventListener('pointerlockchange', () => {
    Input.locked = document.pointerLockElement === canvas;
    if (!Input.locked) {
      Input.clearHeld();
      // lost lock mid-match (ESC / tab-out) → pause
      if (useGame.getState().phase === 'playing') useGame.getState().setPhase('paused');
    }
  });

  // click canvas while playing but unlocked → re-lock
  canvas.addEventListener('click', () => {
    if (useGame.getState().phase === 'playing' && !Input.locked) requestLock(canvas);
  });

  window.addEventListener('blur', () => Input.clearHeld());
}
