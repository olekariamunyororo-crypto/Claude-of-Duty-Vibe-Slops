import { MODEL_STATE } from '../game/utils/GLBProbe';

export function LoadingScreen() {
  return (
    <div className="flex h-full items-center justify-center bg-[#0b1622]">
      <div className="text-center">
        <div className="text-amber-300 font-bold tracking-[5px] text-[16px] mb-6">BOOTING VIBE ENGINE…</div>
        {(['yacht', 'nv4', 'ghost'] as const).map((k) => {
          const m = MODEL_STATE[k];
          const state = !m.ok ? '⚠ MISSING — stand-in' : m.placeholder ? '◐ PLACEHOLDER — swap the .glb' : `✓ ${Math.round(m.tris)} tris`;
          return <div key={k} className="text-slate-300 text-[12px] mb-1">{k.toUpperCase().padEnd(6)} {state}</div>;
        })}
      </div>
    </div>
  );
}
