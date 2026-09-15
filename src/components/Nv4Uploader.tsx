// Live NV4 swap: .glb → IndexedDB → re-probe → next match / next weapon tick uses it.
import { useRef, useState } from 'react';
import { idbSetNv4, idbClearNv4, invalidateNv4Cache } from '../game/scene/modelStorage';
import { probeModels } from '../game/utils/GLBProbe';

export function Nv4Uploader() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState('');

  return (
    <div className="w-[300px] rounded-xl border border-white/10 bg-black/30 p-3">
      <div className="text-[11px] font-bold tracking-[2px] text-amber-300 mb-2">NV-4 WEAPON (OPTIONAL)</div>
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
            await idbSetNv4(f);
            invalidateNv4Cache();
            await probeModels(); // refresh MODEL_STATE so viewmodel picks it up
            setStatus(`Stored "${f.name}" — applies next deploy / match.`);
          } catch {
            setStatus('Storage failed (private mode?).');
          }
          if (fileRef.current) fileRef.current.value = '';
        }}
      />
      <div className="flex gap-2">
        <button
          className="flex-1 rounded-lg bg-amber-400/90 px-3 py-2 text-[12px] font-bold text-black hover:bg-amber-300"
          onClick={() => fileRef.current?.click()}
        >
          UPLOAD .GLB
        </button>
        <button
          className="rounded-lg bg-white/10 px-3 py-2 text-[12px] font-bold text-slate-200 hover:bg-white/20"
          onClick={async () => {
            await idbClearNv4();
            invalidateNv4Cache();
            await probeModels();
            setStatus('Cleared — using bundled model / stand-in.');
          }}
        >
          CLEAR
        </button>
      </div>
      {status && <div className="mt-2 text-[11px] text-slate-400">{status}</div>}
      <div className="mt-2 text-[10px] leading-4 text-slate-500">
        Drop a custom carbine GLB (no Draco). Used for first-person view and bot guns.
      </div>
    </div>
  );
}
