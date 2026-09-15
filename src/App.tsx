import { useEffect, useState } from 'react';
import { useGame } from './game/store/gameStore';
import { MenuShell } from './components/MenuShell';
import { LoadingScreen } from './components/LoadingScreen';
import { GameCanvas } from './game/scene/GameCanvas';
import { Hud } from './hud/Hud';
import { TouchControls, IS_TOUCH } from './game/input/TouchControls';
import { resetMatch } from './game/scene/reset';
import { probeModels } from './game/utils/GLBProbe';
import { SFX } from './game/audio/AudioEngine';
import { requestLock, releaseLock, resetInput } from './game/input/InputManager';

export default function App() {
  const phase = useGame((s) => s.phase);
  const [booting, setBooting] = useState(false);

  useEffect(() => {
    const apply = (v: number) => SFX.setVolume(v);
    apply(useGame.getState().settings.volume);
    return useGame.subscribe((s, prev) => {
      if (s.settings.volume !== prev.settings.volume) apply(s.settings.volume);
    });
  }, []);

  useEffect(() => {
    const cm = (e: MouseEvent) => e.preventDefault(); // RMB is ADS
    document.addEventListener('contextmenu', cm);
    return () => document.removeEventListener('contextmenu', cm);
  }, []);

  const relock = () => {
    if (IS_TOUCH) return;
    const c = document.querySelector('canvas');
    if (c) requestLock(c as HTMLCanvasElement);
  };

  const onDeploy = async () => {
    if (booting) return;
    setBooting(true);
    SFX.unlock();
    await probeModels();
    resetMatch();
    useGame.getState().startMatch();
    setBooting(false);
    if (IS_TOUCH) resetInput(); else setTimeout(relock, 80);
  };

  const resume = () => { useGame.getState().setPhase('playing'); resetInput(); relock(); };
  const quit = () => { releaseLock(); useGame.getState().quitToMenu(); };
  const rematch = () => { resetMatch(); useGame.getState().startMatch(); relock(); };

  if (booting) return <LoadingScreen />;

  if (phase === 'menu') return <MenuShell screen="main" onDeploy={onDeploy} />;
  if (phase === 'paused') return <><GameCanvas /><MenuShell screen="pause" onResume={resume} onQuit={quit} /></>;
  if (phase === 'results') return <><GameCanvas /><MenuShell screen="results" onRematch={rematch} onQuit={quit} /></>;

  return (
    <>
      <GameCanvas />
      <Hud />
      {IS_TOUCH && <TouchControls />}
    </>
  );
}
