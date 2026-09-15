# Claude of Duty: Vibe Slops II 🛥️🔫 (WEB)

Unofficial browser FPS vs Ghost bots on a Hijacked-style yacht.
Vite 6 · React 19 · three.js + R3F · Tailwind · 100% procedural audio/props.

## Run locally
npm install
npm run dev        # http://localhost:5173

## Deploy to Render.com
Option A: commit `render.yaml` → Render → **New + → Blueprint**.
Option B: Render → **New + → Static Site** →
- Build: `npm install && npm run build` · Publish dir: `dist`

Works unchanged on Vercel / Netlify / Cloudflare Pages / GitHub Pages (`base: './'`).

## Optional models → `public/models/`
- yacht.glb — Frickie's Yacht
  https://sketchfab.com/3d-models/frickies-yacht-a5b72f2a23cd4e1f9eaf49059606c7a3
- nv4.glb — Custom Carbine NV4 (COD)
  https://sketchfab.com/3d-models/custom-carbine-rifle-nv4-cod-195d2de670b24e22a98cf9d47607e646
- ghost.glb — Ghost COD Soldier Guy
  https://sketchfab.com/3d-models/ghost-cod-soldier-guy-950353636244443c833de4137f660538

GLB, no Draco · yacht<15MB · nv4<3MB · ghost<5MB. Live yacht swap: Menu → Credits →
Upload (IndexedDB). Respect each CC license — attribution in Credits.

## Controls
Desktop: click to lock pointer · WASD · Shift sprint · Space jump · LMB fire · RMB ADS ·
R reload · P pause. Mobile: left stick (full-forward sprint) · right drag look ·
double-tap look = jump · FIRE/ADS/JUMP/RELOAD buttons. First to 30 kills wins.
