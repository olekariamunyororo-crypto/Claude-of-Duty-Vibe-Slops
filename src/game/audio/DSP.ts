// DSP kitchen — every sound synthesized to Float32Array at 22.05 kHz.
export const SR = 22050;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normalize(buf: Float32Array, peak = 0.92): Float32Array {
  let m = 1e-6;
  for (let i = 0; i < buf.length; i++) m = Math.max(m, Math.abs(buf[i]));
  const g = peak / m;
  for (let i = 0; i < buf.length; i++) buf[i] *= g;
  return buf;
}

export function synthGunshot(seed = 1): Float32Array {
  const rnd = mulberry32(seed);
  const n = Math.floor(SR * 0.32);
  const out = new Float32Array(n);
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const noise = rnd() * 2 - 1;
    lp += (noise - lp) * (0.05 + 0.45 * Math.exp(-t * 28));
    out[i] = lp * Math.exp(-t * 17) * 1.5
      + Math.sin(2 * Math.PI * (72 - 40 * t) * t) * Math.exp(-t * 10) * 0.9
      + (t < 0.004 ? noise * 0.8 : 0);
  }
  return normalize(out);
}

export function synthShotFar(): Float32Array {
  const src = synthGunshot(7);
  const out = new Float32Array(src.length);
  let lp = 0;
  for (let i = 0; i < src.length; i++) { lp += (src[i] - lp) * 0.06; out[i] = lp * 1.8; }
  return normalize(out);
}

export function synthExplosion(): Float32Array {
  const rnd = mulberry32(99);
  const n = Math.floor(SR);
  const out = new Float32Array(n);
  let brown = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    brown += (rnd() * 2 - 1) * 0.08; brown *= 0.994;
    out[i] = brown * Math.exp(-t * 3.4) * 3 + Math.sin(2 * Math.PI * 44 * t) * Math.exp(-t * 4) * 0.5;
  }
  return normalize(out);
}

export function synthStep(seed = 3): Float32Array {
  const rnd = mulberry32(seed);
  const n = Math.floor(SR * 0.085);
  const out = new Float32Array(n);
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    lp += ((rnd() * 2 - 1) - lp) * 0.09;
    out[i] = lp * Math.exp(-t * 42) * 1.6 + Math.sin(2 * Math.PI * 95 * t) * Math.exp(-t * 55) * 0.5;
  }
  return normalize(out, 0.7);
}

export function synthTick(freq: number, dur: number, square = false): Float32Array {
  const n = Math.floor(SR * dur);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const ph = (t * freq) % 1;
    out[i] = (square ? (ph < 0.5 ? 1 : -1) : Math.sin(2 * Math.PI * freq * t)) * Math.exp(-t * 26);
  }
  return normalize(out, 0.55);
}

export function synthKill(): Float32Array {
  const notes = [660, 880, 1188];
  const seg = Math.floor(SR * 0.075);
  const out = new Float32Array(seg * notes.length + Math.floor(SR * 0.05));
  notes.forEach((f, k) => {
    const s = synthTick(f, 0.11, true);
    for (let i = 0; i < s.length && k * seg + i < out.length; i++) out[k * seg + i] += s[i];
  });
  return normalize(out, 0.6);
}

export function synthReloadClick(hi: boolean): Float32Array {
  const rnd = mulberry32(hi ? 41 : 42);
  const n = Math.floor(SR * 0.06);
  const out = new Float32Array(n);
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const x = rnd() * 2 - 1;
    lp += (x - lp) * (hi ? 0.5 : 0.2);
    out[i] = (x - lp) * Math.exp(-t * 70) + (hi ? Math.sin(2 * Math.PI * 2300 * t) : 0) * Math.exp(-t * 50) * 0.4;
  }
  return normalize(out, 0.6);
}

export function synthHurt(): Float32Array {
  const rnd = mulberry32(77);
  const n = Math.floor(SR * 0.22);
  const out = new Float32Array(n);
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    lp += ((rnd() * 2 - 1) - lp) * 0.12;
    out[i] = (lp * 1.4 + Math.sin(2 * Math.PI * (110 + 40 * Math.sin(t * 30)) * t) * 0.6) * Math.exp(-t * 12);
  }
  return normalize(out, 0.7);
}

export function synthJump(): Float32Array {
  const n = Math.floor(SR * 0.12);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    out[i] = Math.sin(2 * Math.PI * (280 + 350 * (t / 0.12)) * t) * Math.exp(-t * 14) * 0.6;
  }
  return normalize(out, 0.4);
}

export function synthLand(): Float32Array {
  const s = synthStep(11);
  for (let i = 0; i < s.length; i++) s[i] += Math.sin(2 * Math.PI * 70 * (i / SR)) * Math.exp(-(i / SR) * 30) * 0.8;
  return normalize(s, 0.65);
}

export function noiseBuffer(seconds = 2): Float32Array {
  const rnd = mulberry32(1234);
  const n = Math.floor(SR * seconds);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = rnd() * 2 - 1;
  return out;
}
