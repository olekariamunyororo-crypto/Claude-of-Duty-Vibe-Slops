// Live yacht swap: .glb file → IndexedDB → invalidate cache → next match uses it.
import { useRef, useState } from 'react';
import { idbSetYacht, idbClearYacht, invalidateYachtCache } from '../game/scene/yachtStorage';

export function YachtUploader() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState('');

  return (
    <div className="w-[300px] rounded-xl border border-white/10 bg-black/30 p-3">
      <div className="text-[11px] font-bold tracking-[2px] text-cyan-300 mb-2">YACHT MODEL (OPTIONAL)</div>
      <input
        ref={fileRef} type="file" accept=".glb,model/gltf-binary" className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          setStatus('Storing…');
          try {
            await idbSetYacht(f);
            invalidateYachtCache();
            setStatus(`Stored "${f.name}" — applies next match.`);
          } catch { setStatus('Storage failed (private mode?).'); }
        }}
      />
      <div className="flex gap-2">
        <button className="flex-1 rounded-lg bg-cyan-500/80 px-3 py-2 text-[12px] font-bold text-black hover:bg-cyan-400"
          onClick={() => fileRef.current?.click()}>UPLOAD .GLB</button>
        <button className="rounded-lg bg-white/10 px-3 py-2 text-[12px] font-bold text-slate-200 hover:bg-white/20"
          onClick={async () => { await idbClearYacht(); invalidateYachtCache(); setStatus('Cleared — using bundled placeholder.'); }}>
          CLEAR
        </button>
      </div>
      {status && <div className="mt-2 text-[11px] text-slate-400">{status}</div>}
    </div>
  );
}
