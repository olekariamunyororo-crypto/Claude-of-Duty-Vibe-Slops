// DOM HUD. Per-frame widgets (crosshair/minimap/compass/vignette/fps) run in one
// rAF loop writing styles/canvas directly; discrete widgets subscribe to store/bus.
import { useEffect, useMemo, useRef, useState } from 'react';
import { T } from '../game/store/transient';
import { useGame, KILL_TARGET, memeKill } from '../game/store/gameStore';
import { bus } from '../game/utils/Bus';
import { BOXES } from '../game/scene/Map';
import { bots } from '../game/ai/bots';

const MM_R = 66;
const MM_SCALE = 2.1;
const LABELS: [number, string][] = [[0, 'N'], [45, 'NE'], [90, 'E'], [135, 'SE'], [180, 'S'], [225, 'SW'], [270, 'W'], [315, 'NW']];

interface Marker { id: number; kill: boolean }
interface FloatDmg { id: number; amount: number }
interface Popup { id: number; text: string }
let uid = 1;

export function Hud() {
  const hud = useGame((s) => s.hud);
  const feed = useGame((s) => s.killfeed);
  const score = useGame((s) => s.score);
  const best = useGame((s) => s.best);
  const death = useGame((s) => s.death);
  const showFps = useGame((s) => s.settings.showFps);

  const [markers, setMarkers] = useState<Marker[]>([]);
  const [dmgs, setDmgs] = useState<FloatDmg[]>([]);
  const [popups, setPopups] = useState<Popup[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  const gapRef = useRef<HTMLDivElement>(null);
  const vignetteRef = useRef<HTMLDivElement>(null);
  const fpsRef = useRef<HTMLDivElement>(null);
  const minimapRef = useRef<HTMLCanvasElement>(null);
  const compassRefs = useRef<(HTMLSpanElement | null)[]>([]);

  // minimap bake (once)
  const baked = useMemo(() => {
    const cv = document.createElement('canvas');
    const S = MM_R * 2;
    cv.width = cv.height = S * 2;
    const ctx = cv.getContext('2d')!;
    ctx.scale(2, 2);
    const c = MM_R;
    for (const b of BOXES) {
      if (b.kind !== 'wall' && b.kind !== 'crate' && b.kind !== 'metal') continue;
      ctx.fillStyle = b.deck === 2 ? '#8b9aae' : b.deck === 1 ? '#64748b' : '#3f4b5e';
      ctx.fillRect(c + b.min[0] * MM_SCALE, c + b.min[2] * MM_SCALE,
        Math.max(1.5, (b.max[0] - b.min[0]) * MM_SCALE), Math.max(1.5, (b.max[2] - b.min[2]) * MM_SCALE));
    }
    return cv;
  }, []);

  useEffect(() => {
    const offs = [
      bus.on('hit', (p) => {
        const { kill } = (p ?? {}) as { kill?: boolean };
        const id = uid++;
        setMarkers((m) => [...m.slice(-3), { id, kill: !!kill }]);
        setTimeout(() => setMarkers((m) => m.filter((x) => x.id !== id)), 260);
      }),
      bus.on('dmg', (p) => {
        const id = uid++;
        setDmgs((d) => [...d.slice(-5), { id, amount: Math.round((p as number) ?? 0) }]);
        setTimeout(() => setDmgs((d) => d.filter((x) => x.id !== id)), 820);
      }),
      bus.on('kill', (p) => {
        const { headshot } = (p ?? {}) as { headshot?: boolean };
        const id = uid++;
        setPopups((ps) => [...ps.slice(-2), { id, text: memeKill(!!headshot) }]);
        setTimeout(() => setPopups((ps) => ps.filter((x) => x.id !== id)), 1400);
      }),
      bus.on('toast', (p) => {
        setToast(String(p ?? ''));
        setTimeout(() => setToast(null), 2200);
      }),
    ];
    return () => offs.forEach((o) => o());
  }, []);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);

      // crosshair
      if (gapRef.current) {
        const gap = 6 + T.weapon.spread * 57.3 * 2.6;
        gapRef.current.style.setProperty('--gap', `${gap.toFixed(1)}px`);
        gapRef.current.style.opacity = hud.alive ? String(1 - T.player.ads * 0.35) : '0';
      }
      // vignette
      if (vignetteRef.current) {
        vignetteRef.current.style.opacity = String(Math.max(0, 1 - hud.hp / 45) * 0.55);
      }
      // minimap
      const cv = minimapRef.current;
      if (cv) {
        const ctx = cv.getContext('2d')!;
        const S = MM_R * 2, c = MM_R;
        ctx.clearRect(0, 0, S, S);
        ctx.save();
        ctx.beginPath(); ctx.arc(c, c, c - 2, 0, 7); ctx.clip();
        ctx.fillStyle = 'rgba(4,10,16,0.72)';
        ctx.fillRect(0, 0, S, S);
        ctx.translate(c, c);
        ctx.rotate(T.cam.yaw);
        ctx.drawImage(baked, -(c + T.player.pos.x * MM_SCALE), -(c + T.player.pos.z * MM_SCALE), S, S);
        ctx.fillStyle = '#ff5340';
        for (const b of bots) {
          if (!b.alive) continue;
          ctx.beginPath();
          ctx.arc((b.pos.x - T.player.pos.x) * MM_SCALE, (b.pos.z - T.player.pos.z) * MM_SCALE, 3.4, 0, 7);
          ctx.fill();
        }
        ctx.restore();
        ctx.save();
        ctx.translate(c, c);
        ctx.fillStyle = '#7fe8ff';
        ctx.beginPath();
        ctx.moveTo(0, -8); ctx.lineTo(5.5, 6); ctx.lineTo(0, 3); ctx.lineTo(-5.5, 6);
        ctx.closePath(); ctx.fill();
        ctx.restore();
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(c, c, c - 2, 0, 7); ctx.stroke();
      }
      // compass
      const heading = ((-T.cam.yaw * 180 / Math.PI) % 360 + 360) % 360;
      compassRefs.current.forEach((el, i) => {
        if (!el) return;
        let d = LABELS[i][0] - heading;
        while (d > 180) d -= 360;
        while (d < -180) d += 360;
        const x = window.innerWidth / 2 + d * 2.2;
        el.style.opacity = Math.abs(d) < 42 ? String(1 - Math.abs(d) / 50) : '0';
        el.style.transform = `translate(${x}px, 0) translateX(-50%)`;
      });
      // fps (cheap write every frame is fine; text tiny)
      if (fpsRef.current) fpsRef.current.textContent = `FPS ${T.fps}`;
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [baked, hud.alive, hud.hp]);

  return (
    <div className="pointer-events-none absolute inset-0 z-10 select-none">
      <div ref={vignetteRef} className="absolute inset-0 opacity-0"
        style={{ background: 'radial-gradient(ellipse at center, transparent 42%, rgba(180,10,10,0.85) 100%)' }} />

      {/* crosshair */}
      <div ref={gapRef} className="absolute left-1/2 top-1/2" style={{ ['--gap' as never]: '12px' }}>
        <div className="absolute rounded-full bg-white" style={{ width: 3, height: 3, left: -1.5, top: -1.5 }} />
        {([[0, -1], [0, 1], [-1, 0], [1, 0]] as const).map(([dx, dy], i) => (
          <div key={i} className="absolute bg-white"
            style={{
              width: dx === 0 ? 2 : 8, height: dx === 0 ? 8 : 2,
              left: dx === 0 ? -1 : dx * 8, top: dy === 0 ? -1 : dy * 8,
              transform: dx === 0
                ? `translate(0, calc(${dy} * var(--gap)${dy < 0 ? ' - 8px' : ''}))`
                : `translate(calc(${dx} * var(--gap)${dx < 0 ? ' - 8px' : ''}), 0)`,
            }} />
        ))}
      </div>

      {/* hitmarkers */}
      {markers.map((m) => (
        <div key={m.id} className="hitmarker absolute left-1/2 top-1/2">
          {([[1, 1], [1, -1], [-1, 1], [-1, -1]] as const).map(([sx, sy], i) => (
            <div key={i} className="absolute" style={{
              width: 9, height: 2.5, background: m.kill ? '#ff4a3d' : '#fff',
              left: sx * 6 - (sx < 0 ? 9 : 0), top: sy * 6 - 1,
              transform: `rotate(${sx * sy * 45}deg)`,
            }} />
          ))}
        </div>
      ))}

      {/* damage numbers */}
      {dmgs.map((d) => (
        <div key={d.id} className="dmgnum absolute left-1/2 top-1/2 text-red-300 font-extrabold text-[17px]"
          style={{ marginLeft: 22, marginTop: 10, textShadow: '0 1px 3px #000' }}>
          {d.amount}
        </div>
      ))}

      {/* minimap */}
      <canvas ref={minimapRef} width={MM_R * 2} height={MM_R * 2}
        className="absolute" style={{ left: 18, top: 18 }} />

      {/* compass */}
      <div className="absolute top-2 left-0 right-0 h-6">
        {LABELS.map(([, label], i) => (
          <span key={label} ref={(el) => { compassRefs.current[i] = el; }}
            className="absolute top-0 text-[12px] font-bold text-cyan-100/90"
            style={{ left: 0, transform: 'translate(-999px,0)', opacity: 0 }}>
            {label}
          </span>
        ))}
      </div>
      <div className="absolute top-8 left-1/2 -translate-x-1/2 text-[12px] font-bold text-slate-300">
        YOU {score} / {KILL_TARGET} — LEADER {best.score}
      </div>

      {showFps && (
        <div ref={fpsRef} className="absolute text-[11px] text-slate-400" style={{ left: 18, top: MM_R * 2 + 26 }}>FPS 60</div>
      )}

      {/* health */}
      <div className="absolute bottom-5 left-5 w-[190px]">
        <div className="text-[13px] font-black text-slate-100 mb-1 drop-shadow">{Math.max(0, hud.hp)}</div>
        <div className="h-3 rounded bg-black/60 overflow-hidden">
          <div className="h-full rounded transition-[width] duration-150"
            style={{
              width: `${Math.max(0, Math.min(100, hud.hp))}%`,
              background: hud.hp > 45 ? 'linear-gradient(90deg,#4ade80,#a3e635)' : 'linear-gradient(90deg,#ef4444,#f97316)',
            }} />
        </div>
      </div>

      {/* ammo */}
      <div className="absolute bottom-5 right-5 text-right">
        <div className="text-[11px] font-bold tracking-[3px] text-amber-300/90">{hud.weapon}{hud.reloading ? ' · RELOADING' : ''}</div>
        <div className="font-black text-white leading-none" style={{ fontSize: 34, textShadow: '0 2px 6px #000' }}>
          {hud.mag}<span className="text-[16px] text-slate-400 font-bold"> / {hud.reserve}</span>
        </div>
      </div>

      {/* killfeed */}
      <div className="absolute top-14 right-4 flex flex-col items-end gap-1">
        {feed.map((k) => (
          <div key={k.id} className="feedin rounded bg-black/60 px-2.5 py-1 text-[11px] font-bold">
            <span className={k.killer === 'YOU' ? 'text-cyan-300' : 'text-red-400'}>{k.killer}</span>
            <span className="text-slate-300"> {k.weapon}{k.headshot ? ' ⌖' : ''} </span>
            <span className={k.victim === 'YOU' ? 'text-cyan-300' : 'text-red-400'}>{k.victim}</span>
          </div>
        ))}
      </div>

      {/* meme popups */}
      <div className="absolute left-0 right-0 top-[30%] flex flex-col items-center gap-1">
        {popups.map((p) => (
          <div key={p.id} className="killpop font-black text-amber-300 text-[30px] drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">
            {p.text}
          </div>
        ))}
      </div>

      {toast && (
        <div className="absolute left-1/2 top-[20%] -translate-x-1/2 rounded bg-black/70 px-4 py-2 text-[13px] font-bold text-cyan-200">
          {toast}
        </div>
      )}

      {/* death overlay */}
      {!hud.alive && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-950/30">
          <div className="text-[36px] font-black text-red-300 drop-shadow">ELIMINATED</div>
          <div className="text-[14px] text-slate-200 mt-1">by {death?.killer ?? 'GHOST'} — redeploying…</div>
        </div>
      )}

      {/* pause button */}
      <button
        className="pointer-events-auto absolute top-2 right-3 rounded-lg bg-black/50 px-3 py-1 text-[20px] text-white/80 hover:bg-black/70"
        onClick={() => useGame.getState().setPhase('paused')}
      >☰</button>
    </div>
  );
}
