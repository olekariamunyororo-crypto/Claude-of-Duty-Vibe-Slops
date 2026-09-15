# ARCHITECTURE.md — Claude of Duty: Vibe Slops II (WEB)

Browser FPS: Vite 6, React 19, TS strict, Tailwind 3.4, @react-three/fiber v9 + drei v10.
Procedural recreation of BO2 **Hijacked** (yacht). Only external art: three optional GLBs.

- **Lifecycle**: `main.tsx` mounts `<App/>` with NO StrictMode (ticks would double-register).
  Phases: menu → playing ⇄ paused → results. GameCanvas mounts only in match phases.
- **Fixed timestep**: GameLoop runs a 60 Hz tick list (`systems.ts`), max 5 catch-up ticks,
  exposes `T.alpha` for interpolation. Ticks: playerMove → weaponTick → botsTick → fxTick →
  matchTick (8 Hz HUD throttle, respawn, victory, feed expiry). GameLoop toggles `Input.enabled`.
- **State**: `gameStore` (zustand+persist; persisted: settings, primary) for discrete UI;
  `T` (transient.ts) for per-frame transforms — nothing in React subscribes to T;
  `bus` for one-shot events (hit/dmg/kill/hurt/toast).
- **Physics deviation**: no Rapier/WASM. Bespoke deterministic kinematic AABB solver
  (`Movement.ts`, 0.55 m step-up, ground snap) + analytic raycasts (`Map.rayWorld`).
  Identical player/bot movement, zero WASM payload.
- **Map**: `BOXES` (~110 boxes) merged per material → ~8 draw calls; the same list drives
  collision, LOS, radar. NAV: 34 nodes + BFS. GLB yacht: IndexedDB upload → public/models/
  fallback; error boundary degrades to stand-in hull. Sky: FBM clouds + sun disk (dome
  follows camera). Ocean: sum-of-sines + specular + foam + haze. Pool: caustic shader.
- **Weapons**: data-driven NV4 (750 RPM, bloom, ADS FOV 55, falloff). Tracers originate at
  `T.viewmodel.muzzle` (gun tip), not the camera.
- **AI**: 4 FFA Ghost bots; staggered LOS perception, BFS patrol, strafe combat with burst
  fire + per-shot LOS re-check; farthest-of-3 spawn selection.
- **Audio**: 100% procedural WebAudio (master→sfx/music/amb), synthesized at 22.05 kHz.
  Menu music: 56 BPM pad loop with dotted-eighth feedback delay. Ambience: filtered noise.
- **Input**: desktop pointer-lock KB/M (lock loss auto-pauses; canvas click re-locks);
  touch stick + look zone + buttons; both sum onto the same fields.
- **HUD**: DOM. Per-frame widgets (crosshair/minimap/compass/vignette/fps) in one rAF loop
  writing styles/canvas directly; discrete widgets via store/bus at 8 Hz.
- **Legal**: unofficial fan parody; MIT for original code; GLBs remain property of their
  CC-licensed authors (attribution in Menu → Credits).
