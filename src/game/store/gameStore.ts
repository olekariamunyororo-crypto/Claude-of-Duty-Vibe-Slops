import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type Phase = 'menu' | 'playing' | 'paused' | 'results';
export type Quality = 'low' | 'med' | 'high';
export type MenuScreen = 'main' | 'settings' | 'credits';

export interface KillfeedEntry { id: number; killer: string; victim: string; weapon: string; headshot: boolean; t: number }
export interface Hud { hp: number; mag: number; reserve: number; alive: boolean; weapon: string; reloading: boolean }
export interface Settings { sens: number; volume: number; fov: number; quality: Quality; showFps: boolean }

export const KILL_TARGET = 30;
const MEMES = ['VIBE SLOP!', 'GET CLAUDED', 'PROMPT INJECTED', 'HALLUCINATED!', 'TOKENS SPENT', 'FRICKIE APPROVES', 'SKIBIDI DOWNED', 'MAX CONTEXT KILL'];
export const memeKill = (headshot: boolean) => MEMES[(Math.random() * MEMES.length) | 0] + (headshot ? ' 💀HEADSHOT' : '');

let feedId = 1;

interface GameState {
  phase: Phase;
  menuScreen: MenuScreen;
  settings: Settings;
  primary: 'ar';
  hud: Hud;
  killfeed: KillfeedEntry[];
  score: number;
  best: { name: string; score: number };
  death: { killer: string } | null;
  deployTick: number;
  setPhase: (p: Phase) => void;
  setMenuScreen: (s: MenuScreen) => void;
  setSettings: (p: Partial<Settings>) => void;
  setHud: (h: Partial<Hud>) => void;
  pushKill: (killer: string, victim: string, weapon: string, headshot: boolean, byPlayer: boolean) => void;
  expireFeed: () => void;
  setBest: (name: string, score: number) => void;
  setDeath: (killer: string | null) => void;
  bumpDeploy: () => void;
  startMatch: () => void;
  quitToMenu: () => void;
}

const DEFAULT_HUD: Hud = { hp: 100, mag: 30, reserve: 120, alive: true, weapon: 'NV-4', reloading: false };

export const useGame = create<GameState>()(
  persist(
    (set, get) => ({
      phase: 'menu',
      menuScreen: 'main',
      settings: { sens: 5, volume: 0.8, fov: 75, quality: 'med', showFps: false },
      primary: 'ar',
      hud: { ...DEFAULT_HUD },
      killfeed: [],
      score: 0,
      best: { name: '', score: 0 },
      death: null,
      deployTick: 0,

      setPhase: (phase) => set({ phase }),
      setMenuScreen: (menuScreen) => set({ menuScreen }),
      setSettings: (p) => set((s) => ({ settings: { ...s.settings, ...p } })),
      setHud: (h) => {
        const cur = get().hud;
        const next = { ...cur, ...h };
        for (const k of Object.keys(h) as (keyof Hud)[]) {
          if (cur[k] !== next[k]) { set({ hud: next }); return; }
        }
      },
      pushKill: (killer, victim, weapon, headshot, byPlayer) => {
        const entry: KillfeedEntry = { id: feedId++, killer, victim, weapon, headshot, t: Date.now() };
        set((s) => ({
          killfeed: [entry, ...s.killfeed].slice(0, 5),
          score: byPlayer ? s.score + 1 : s.score,
        }));
      },
      expireFeed: () => {
        const now = Date.now();
        const kept = get().killfeed.filter((k) => now - k.t < 6000);
        if (kept.length !== get().killfeed.length) set({ killfeed: kept });
      },
      setBest: (name, score) => set({ best: { name, score } }),
      setDeath: (killer) => set({ death: killer ? { killer } : null }),
      bumpDeploy: () => set((s) => ({ deployTick: s.deployTick + 1 })),
      startMatch: () => set({
        phase: 'playing', hud: { ...DEFAULT_HUD }, killfeed: [], score: 0,
        best: { name: '', score: 0 }, death: null,
      }),
      quitToMenu: () => set({ phase: 'menu', killfeed: [], death: null }),
    }),
    {
      name: 'codv2',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ settings: s.settings, primary: s.primary }),
    },
  ),
);
