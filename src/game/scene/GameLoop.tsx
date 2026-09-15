// Fixed 60 Hz accumulator + tick registry + HUD throttle + perf watchdog.
import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { STEP, registerTick, runTicks } from './systems';
import { T } from '../store/transient';
import { Input } from '../input/InputManager';
import { useGame } from '../store/gameStore';
import { playerMove } from '../player/Movement';
import { weaponTick } from '../weapons/WeaponState';
import { botsTick } from '../ai/bots';
import { fxTick } from './fx';
import { matchTick } from '../player/playerState';
import { bus } from '../utils/Bus';

let fpsLowT = 0;
let downgraded = false;

export function GameLoop() {
  const acc = useRef(0);
  const fpsAcc = useRef(0);
  const fpsFrames = useRef(0);

  useEffect(() => {
    const un = [
      registerTick(playerMove),
      registerTick(weaponTick),
      registerTick(botsTick),
      registerTick(fxTick),
      registerTick(matchTick),
    ];
    return () => un.forEach((u) => u());
  }, []);

  // gate input on phase
  useEffect(() => {
    const apply = (p: ReturnType<typeof useGame.getState>) => { Input.enabled = p.phase === 'playing'; };
    apply(useGame.getState());
    return useGame.subscribe((s) => apply(s));
  }, []);

  useFrame((_, delta) => {
    const phase = useGame.getState().phase;

    fpsAcc.current += delta; fpsFrames.current++;
    if (fpsAcc.current >= 0.5) {
      T.fps = Math.round(fpsFrames.current / fpsAcc.current);
      fpsAcc.current = 0; fpsFrames.current = 0;
    }

    if (phase !== 'playing') { acc.current = 0; return; }

    // auto quality downgrade
    if (T.fps < 42) fpsLowT += delta; else fpsLowT = 0;
    if (fpsLowT > 6 && !downgraded && useGame.getState().settings.quality !== 'low') {
      downgraded = true;
      const q = useGame.getState().settings.quality;
      useGame.getState().setSettings({ quality: q === 'high' ? 'med' : 'low' });
      bus.emit('toast', 'Quality lowered to keep things buttery');
    }

    acc.current += Math.min(delta, 0.25);
    let n = 0;
    while (acc.current >= STEP && n < 5) { runTicks(STEP); acc.current -= STEP; n++; }
    T.alpha = Math.min(1, acc.current / STEP);
  });

  return null;
}
