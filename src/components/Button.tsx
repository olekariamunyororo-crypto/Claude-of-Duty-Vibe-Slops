import type { ReactNode } from 'react';

export function Button({ title, onClick, wide, subtle }: {
  title: ReactNode; onClick: () => void; wide?: boolean; subtle?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl px-6 py-3.5 mb-3 font-bold tracking-widest text-[15px] transition active:scale-[0.98] ${
        subtle ? 'bg-white/10 text-slate-100 hover:bg-white/20' : 'bg-amber-400 text-black hover:bg-amber-300'
      } ${wide ? 'w-[280px]' : ''}`}
    >
      {title}
    </button>
  );
}
