// Live Ghost / bot body swap: .glb → IndexedDB → re-probe → next match.
import { useRef, useState } from 'react';
import { idbSetGhost, idbClearGhost, invalidateGhostCache } from '../game/scene/modelStorage';
import { probeModels } from '../game/utils/GLBProbe';

export function GhostUploader() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState('');

  return (
    <div className="w-[300px] rounded-xl border border-white/10 bg-black/30 p-3">
      <div className="text-[11px] font-bold tracking-[2px] text-emerald-300 mb-2">GHOST / BOT BODY (OPTIONAL)</div>
      <input
        ref={fileRef}
        type="file"
        accept=".glb,model/gltf-binary"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          setStatus('Storing…');
          try {
            await idbSetGhost(f);
            invalidateGhostCache();
            await probeModels();
            setStatus(`Stored "${f.name}" — applies next deploy / match.`);
          } catch {
            setStatus('Storage failed (private mode?).');
          }
          if (fileRef.current) fileRef.current.value = '';
        }}
      />
      <div className="flex gap-2">
        <button
          className="flex-1 rounded-lg bg-emerald-400/90 px-3 py-2 text-[12px] font-bold text-black hover:bg-emerald-300"
          onClick={() => fileRef.current?.click()}
        >
          UPLOAD .GLB
        </button>
        <button
          className="rounded-lg bg-white/10 px-3 py-2 text-[12px] font-bold text-slate-200 hover:bg-white/20"
          onClick={async () => {
            await idbClearGhost();
            invalidateGhostCache();
            await probeModels();
            setStatus('Cleared — using bundled model / stand-in.');
          }}
        >
          CLEAR
        </button>
      </div>
      {status && <div className="mt-2 text-[11px] text-slate-400">{status}</div>}
      <div className="mt-2 text-[10px] leading-4 text-slate-500">
        Drop SCI-FI SuperSoldier or any skinned bot GLB (no Draco). Prefer models with walk animations.
      </div>
    </div>
  );
}
