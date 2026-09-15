// Mobile web controls: virtual stick, look zone, action buttons (pointer events).
import { useRef } from 'react';
import { Input, addTouchLook, IS_TOUCH } from './InputManager';

export { IS_TOUCH };

const STICK_R = 52;

export function TouchControls() {
  if (!IS_TOUCH) return null;
  return (
    <div className="absolute inset-0 z-20" style={{ touchAction: 'none' }}>
      <LookZone />
      <MoveStick />
      <Buttons />
    </div>
  );
}

function LookZone() {
  const last = useRef<{ id: number; x: number; y: number } | null>(null);
  const tapT = useRef(0);
  return (
    <div
      className="absolute right-0 top-0 bottom-0"
      style={{ width: '58%', touchAction: 'none' }}
      onPointerDown={(e) => {
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        last.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
        const now = performance.now();
        if (now - tapT.current < 280) Input.jumpQ = true;
        tapT.current = now;
      }}
      onPointerMove={(e) => {
        if (last.current && last.current.id === e.pointerId) {
          addTouchLook(e.clientX - last.current.x, e.clientY - last.current.y);
          last.current.x = e.clientX; last.current.y = e.clientY;
        }
      }}
      onPointerUp={() => { last.current = null; }}
      onPointerCancel={() => { last.current = null; }}
    />
  );
}

function MoveStick() {
  const base = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLDivElement>(null);
  const active = useRef(false);
  const center = useRef({ x: 0, y: 0 });

  const setKnob = (x: number, y: number) => {
    if (knob.current) knob.current.style.transform = `translate(${x}px, ${y}px)`;
  };

  return (
    <div
      ref={base}
      className="absolute rounded-full border-2 border-white/25 bg-white/10"
      style={{ left: 26, bottom: 26, width: STICK_R * 2, height: STICK_R * 2, touchAction: 'none' }}
      onPointerDown={(e) => {
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        const r = base.current!.getBoundingClientRect();
        center.current = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        active.current = true;
      }}
      onPointerMove={(e) => {
        if (!active.current) return;
        let dx = e.clientX - center.current.x;
        let dy = e.clientY - center.current.y;
        const len = Math.hypot(dx, dy);
        const cl = len > STICK_R ? STICK_R / len : 1;
        dx *= cl; dy *= cl;
        Input.touchMoveX = dx / STICK_R;
        Input.touchMoveY = -dy / STICK_R;
        setKnob(dx, dy);
      }}
      onPointerUp={() => { active.current = false; Input.touchMoveX = 0; Input.touchMoveY = 0; setKnob(0, 0); }}
      onPointerCancel={() => { active.current = false; Input.touchMoveX = 0; Input.touchMoveY = 0; setKnob(0, 0); }}
    >
      <div ref={knob} className="absolute rounded-full bg-white/40"
        style={{ width: 46, height: 46, left: STICK_R - 23, top: STICK_R - 23 }} />
    </div>
  );
}

function Btn({ label, onDown, onUp, className }: {
  label: string; onDown?: () => void; onUp?: () => void; className?: string;
}) {
  return (
    <button
      className={`rounded-xl border-2 border-white/30 bg-black/50 text-white font-extrabold text-[13px] tracking-wider active:bg-white/25 ${className ?? ''}`}
      style={{ touchAction: 'none' }}
      onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); onDown?.(); }}
      onPointerUp={() => onUp?.()}
      onPointerCancel={() => onUp?.()}
    >
      {label}
    </button>
  );
}

function Buttons() {
  return (
    <div className="absolute" style={{ right: 18, bottom: 18 }}>
      <div className="flex items-end gap-2.5">
        <div className="flex flex-col gap-2.5">
          <Btn label="ADS" className="w-16 h-14"
            onDown={() => { Input.ads = true; }} onUp={() => { Input.ads = false; }} />
          <Btn label="JUMP" className="w-16 h-12" onDown={() => { Input.jumpQ = true; }} />
        </div>
        <div className="flex flex-col gap-2.5">
          <Btn label="FIRE" className="w-24 h-24 rounded-full !border-red-300/60 !bg-red-600/55"
            onDown={() => { Input.fire = true; }} onUp={() => { Input.fire = false; }} />
          <Btn label="RELOAD" className="w-24 h-11" onDown={() => { Input.reloadQ = true; }} />
        </div>
      </div>
    </div>
  );
}
