import type { ReactNode } from 'react';
import { useGame, KILL_TARGET } from '../game/store/gameStore';
import { bots } from '../game/ai/bots';
import { T } from '../game/store/transient';
import { Button } from './Button';
import { YachtUploader } from './YachtUploader';
import { Nv4Uploader } from './Nv4Uploader';
import { GhostUploader } from './GhostUploader';

interface Props {
  screen: 'main' | 'pause' | 'results';
  onDeploy?: () => void;
  onResume?: () => void;
  onQuit?: () => void;
  onRematch?: () => void;
}

export function MenuShell({ screen, onDeploy, onResume, onQuit, onRematch }: Props) {
  const menuScreen = useGame((s) => s.menuScreen);
  const setMenuScreen = useGame((s) => s.setMenuScreen);
  const settings = useGame((s) => s.settings);
  const setSettings = useGame((s) => s.setSettings);
  const score = useGame((s) => s.score);

  const Frame = ({ children }: { children: ReactNode }) => (
    <div className="flex h-full w-full items-center justify-center overflow-auto p-6"
      style={{ background: 'radial-gradient(1200px 700px at 50% 30%, #14344c 0%, #0b1622 60%, #05080d 100%)' }}>
      <div className="w-full max-w-[560px] text-center">{children}</div>
    </div>
  );

  const Title = () => (
    <>
      <div className="text-amber-300 text-[12px] tracking-[6px] mb-1">UNOFFICIAL FAN OPERATION</div>
      <div className="text-white font-black text-[42px] leading-[44px]">CLAUDE OF DUTY</div>
      <div className="text-cyan-300 font-black text-[19px] tracking-[5px] mb-7">VIBE SLOPS II</div>
    </>
  );

  if (screen === 'pause') {
    return (
      <Frame>
        <div className="text-white font-black text-[30px] mb-6">PAUSED</div>
        <Button title="RESUME" onClick={onResume ?? (() => {})} wide />
        <Button title="QUIT TO MENU" onClick={onQuit ?? (() => {})} wide subtle />
      </Frame>
    );
  }

  if (screen === 'results') {
    const rows = [
      { name: 'YOU', score },
      ...bots.map((b) => ({ name: b.name, score: b.score })),
    ].sort((a, b) => b.score - a.score);
    const won = rows[0]?.name === 'YOU';
    return (
      <Frame>
        <div className={`font-black text-[36px] mb-1 ${won ? 'text-amber-300' : 'text-red-400'}`}>
          {won ? 'VIBE CHAMPION' : 'OUT-VIBED'}
        </div>
        <div className="mb-6 mt-3">
          {rows.map((r, i) => (
            <div key={r.name} className={`text-[14px] ${r.name === 'YOU' ? 'text-cyan-300 font-bold' : 'text-slate-300'}`}>
              {i + 1}. {r.name} — {r.score}
            </div>
          ))}
        </div>
        <Button title="REMATCH" onClick={onRematch ?? (() => {})} wide />
        <Button title="MAIN MENU" onClick={onQuit ?? (() => {})} wide subtle />
        <div className="mt-2 text-[11px] text-slate-500">final fps {T.fps}</div>
      </Frame>
    );
  }

  if (menuScreen === 'settings') {
    return (
      <Frame>
        <div className="text-cyan-300 font-black tracking-[5px] text-[16px] mb-5">SETTINGS</div>
        <div className="mx-auto w-[360px] text-left">
          {([
            ['Sensitivity', 'sens', 1, 10, 0.5, (v: number) => v.toFixed(1)],
            ['Volume', 'volume', 0, 1, 0.1, (v: number) => `${Math.round(v * 100)}%`],
            ['FOV', 'fov', 60, 110, 5, (v: number) => String(v)],
          ] as const).map(([label, key, min, max, step, fmt]) => (
            <div key={key} className="flex items-center justify-between border-b border-white/10 py-2.5">
              <span className="text-slate-200 text-[14px]">{label}</span>
              <div className="flex items-center gap-2">
                <button className="rounded bg-white/10 px-3 py-1 font-bold text-white hover:bg-white/20"
                  onClick={() => setSettings({ [key]: Math.max(min, +(settings[key] - step).toFixed(2)) } as never)}>−</button>
                <span className="w-14 text-center font-bold text-cyan-300">{fmt(settings[key] as number)}</span>
                <button className="rounded bg-white/10 px-3 py-1 font-bold text-white hover:bg-white/20"
                  onClick={() => setSettings({ [key]: Math.min(max, +(settings[key] + step).toFixed(2)) } as never)}>+</button>
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between border-b border-white/10 py-2.5">
            <span className="text-slate-200 text-[14px]">Quality</span>
            <div className="flex gap-1">
              {(['low', 'med', 'high'] as const).map((q) => (
                <button key={q}
                  className={`rounded px-3 py-1.5 text-[12px] font-bold ${settings.quality === q ? 'bg-amber-400 text-black' : 'bg-white/10 text-white hover:bg-white/20'}`}
                  onClick={() => setSettings({ quality: q })}>{q.toUpperCase()}</button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between border-b border-white/10 py-2.5">
            <span className="text-slate-200 text-[14px]">FPS counter</span>
            <button
              className={`rounded px-4 py-1.5 text-[12px] font-bold ${settings.showFps ? 'bg-cyan-500 text-black' : 'bg-white/10 text-white'}`}
              onClick={() => setSettings({ showFps: !settings.showFps })}>
              {settings.showFps ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>
        <div className="mt-6">
          <Button title="◀ BACK" onClick={() => setMenuScreen('main')} wide />
        </div>
      </Frame>
    );
  }

  if (menuScreen === 'credits') {
    return (
      <Frame>
        <div className="text-cyan-300 font-black tracking-[5px] text-[16px] mb-5">CREDITS</div>
        <div className="mx-auto mb-5 w-[420px] text-left text-[12px] leading-5 text-slate-400">
          3D models via Sketchfab (Creative Commons). Swap yacht, NV-4, or bot body below
          (stored in IndexedDB). SCI-FI SuperSoldier works great for bots. Unofficial fan
          project — not affiliated with Activision, Treyarch, Microsoft, Anthropic or Zhipu AI.
        </div>
        <div className="mb-4 flex flex-col items-center gap-3">
          <YachtUploader />
          <Nv4Uploader />
          <GhostUploader />
        </div>
        <Button title="◀ BACK" onClick={() => setMenuScreen('main')} wide />
      </Frame>
    );
  }

  return (
    <Frame>
      <Title />
      <Button title="▶  TAP TO DEPLOY" onClick={onDeploy ?? (() => {})} wide />
      <Button title="LOADOUT · NV-4 CARBINE" onClick={() => {}} wide subtle />
      <Button title="SETTINGS" onClick={() => setMenuScreen('settings')} wide subtle />
      <Button title="CREDITS / MODEL SWAP" onClick={() => setMenuScreen('credits')} wide subtle />
      <div className="mt-6 text-[11px] text-slate-500">
        First to {KILL_TARGET} kills · desktop: click to lock pointer · mobile: landscape + touch
      </div>
      <div className="mt-2 text-[10px] text-slate-600">
        Not affiliated with Activision, Anthropic or Zhipu AI. CC model credits in Credits.
      </div>
    </Frame>
  );
}
