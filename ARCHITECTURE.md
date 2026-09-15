# ARCHITECTURE.md — Claude of Duty: Vibe Slops II (WEB)

Browser FPS: Vite 6, React 19, TS strict, Tailwind 3.4, @react-three/fiber v9 + drei v10.
Procedural recreation of BO2 Hijacked (yacht). Only external art: three optional GLBs.

- **Lifecycle**: `main.tsx` mounts `<App/>` with NO StrictMode. Phases: menu → playing
  ⇄ paused → results. GameCanvas mounts only in match phases.
- **Fixed timestep**: GameLoop runs a 60 Hz tick list, max 5 catch-up ticks, exposes
  `T.alpha` for interpolation. Ticks: playerMove → weaponTick → botsTick → fxTick → matchTick.
- **State**: `gameStore` (zustand+persist) for discrete UI; `T` (transient.ts) for
  per-frame transforms — nothing in React subscribes to T; `bus` for one-shot events.
- **Physics deviation**: bespoke deterministic kinematic AABB solver (`Movement.ts`,
  0.55 m step-up, ground snap). `depenetrate()` runs before every sweep so a collider
  can never start a tick inside geometry (this was the bot wall-clipping root cause).
  Identical player/bot movement, zero WASM payload.
- **Map**: `BOXES` (~110 boxes) merged per material → ~8 draw calls; the same list drives
  collision, LOS, radar. NAV: 34 nodes + BFS.
- **Weapons**: data-driven NV4 (750 RPM, bloom, ADS FOV 55, falloff).
- **AI**: 4 FFA Ghost bots. Patrol 3.2 u/s, combat 2.6 u/s (was 4.4 / 3.6 — too fast for
  the static mesh and read as "gliding"). Legs swing procedurally if the ghost GLB is
  skinned; otherwise lean+sway+bob sells the gait. NV4 is cloned and mounted at the
  right-hand anchor per bot.
- **Audio**: 100% procedural WebAudio (master→sfx/music/amb).
- **Input**: desktop pointer-lock KB/M; touch stick + look zone + buttons.
- **Legal**: unofficial fan parody; MIT for original code; GLBs remain property of their
  CC-licensed authors (attribution in Menu → Credits).
