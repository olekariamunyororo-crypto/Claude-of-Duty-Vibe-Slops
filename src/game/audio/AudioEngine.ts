// One AudioContext → master → {sfx, music, amb}. Unlocked on first gesture.
// Every call is failure-tolerant; the game never dies on audio.
import * as DSP from './DSP';
import * as THREE from 'three';
import { T } from '../store/transient';

export type SfxName =
  | 'shot' | 'shotFar' | 'hit' | 'kill' | 'reloadA' | 'reloadB'
  | 'step' | 'step2' | 'jump' | 'land' | 'empty' | 'explode' | 'hurt' | 'ui';

export interface SpatialParams { gain: number; pan: number }

/** Distance falloff + stereo pan relative to listener yaw. */
export function spatial(src: THREE.Vector3): SpatialParams {
  const e = T.cam;
  const dx = src.x - e.pos.x, dy = src.y - e.pos.y, dz = src.z - e.pos.z;
  const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const gain = 1 / (1 + 0.09 * d);
  const rx = Math.cos(e.yaw), rz = -Math.sin(e.yaw);
  const pan = Math.max(-1, Math.min(1, ((dx * rx + dz * rz) / Math.max(d, 0.5)) * 0.8));
  return { gain, pan };
}

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfx!: GainNode;
  private music!: GainNode;
  private amb!: GainNode;
  private buffers = new Map<SfxName, AudioBuffer[]>();
  private noiseBuf: AudioBuffer | null = null;
  private ambSource: AudioBufferSourceNode | null = null;
  private musicTimer: number | null = null;
  private musicBar = 0;
  private volume = 0.8;
  ready = false;

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.ctx) this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05);
  }

  unlock(): void {
    if (this.ready) { void this.ctx?.resume(); return; }
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx();
      const ctx = this.ctx;
      this.master = ctx.createGain(); this.master.gain.value = this.volume; this.master.connect(ctx.destination);
      this.sfx = ctx.createGain(); this.sfx.gain.value = 1.0; this.sfx.connect(this.master);
      this.music = ctx.createGain(); this.music.gain.value = 0.32; this.music.connect(this.master);
      this.amb = ctx.createGain(); this.amb.gain.value = 0.5; this.amb.connect(this.master);

      const make = (data: Float32Array): AudioBuffer => {
        const buf = ctx.createBuffer(1, data.length, DSP.SR);
        buf.copyToChannel(data as Float32Array<ArrayBuffer>, 0);
        return buf;
      };
      const put = (name: SfxName, data: Float32Array, pool = 2) => {
        this.buffers.set(name, Array.from({ length: pool }, () => make(data)));
      };
      put('shot', DSP.synthGunshot(1), 6);
      put('shotFar', DSP.synthShotFar(), 4);
      put('hit', DSP.synthTick(1700, 0.05));
      put('kill', DSP.synthKill());
      put('reloadA', DSP.synthReloadClick(false));
      put('reloadB', DSP.synthReloadClick(true));
      put('step', DSP.synthStep(3), 4);
      put('step2', DSP.synthStep(5), 4);
      put('jump', DSP.synthJump());
      put('land', DSP.synthLand());
      put('empty', DSP.synthTick(1200, 0.035, true));
      put('explode', DSP.synthExplosion());
      put('hurt', DSP.synthHurt());
      put('ui', DSP.synthTick(880, 0.06));

      this.noiseBuf = make(DSP.noiseBuffer(2));
      this.ready = true;
      this.startAmbience();
      this.startMusic();
    } catch { this.ready = false; }
  }

  play(name: SfxName, opts: { gain?: number; pan?: number; rate?: number } = {}): void {
    const ctx = this.ctx;
    const pool = this.buffers.get(name);
    if (!ctx || !pool || !pool.length) return;
    try {
      const src = ctx.createBufferSource();
      src.buffer = pool[(Math.random() * pool.length) | 0];
      src.playbackRate.value = opts.rate ?? 1;
      const g = ctx.createGain();
      g.gain.value = Math.max(0, Math.min(1.4, opts.gain ?? 1));
      let node: AudioNode = g;
      src.connect(g);
      if (opts.pan !== undefined && 'createStereoPanner' in ctx) {
        const p = ctx.createStereoPanner();
        p.pan.value = Math.max(-1, Math.min(1, opts.pan));
        g.connect(p); node = p;
      }
      node.connect(this.sfx);
      src.start();
      src.onended = () => { src.disconnect(); g.disconnect(); };
    } catch { /* swallow */ }
  }

  private startAmbience(): void {
    const ctx = this.ctx;
    if (!ctx || !this.noiseBuf || this.ambSource) return;
    try {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      src.loop = true;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 420;
      const g = ctx.createGain(); g.gain.value = 0.05;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.09;
      const lfoGain = ctx.createGain(); lfoGain.gain.value = 0.025;
      lfo.connect(lfoGain); lfoGain.connect(g.gain);
      src.connect(lp); lp.connect(g); g.connect(this.amb);
      src.start(); lfo.start();
      this.ambSource = src;
    } catch { /* swallow */ }
  }

  // 56 BPM ambient pad: Cmaj7 → Am7 → Fmaj7 → G6, one chord per 8.5 s bar.
  private startMusic(): void {
    if (this.musicTimer !== null || !this.ctx) return;
    const ctx = this.ctx;
    const CHORDS: number[][] = [
      [261.63, 329.63, 392.0, 493.88],
      [220.0, 261.63, 329.63, 392.0],
      [174.61, 220.0, 261.63, 329.63],
      [196.0, 246.94, 293.66, 329.63],
    ];
    const BELLS = [523.25, 587.33, 659.25, 783.99, 880.0];
    const BAR = 8.5;

    const delay = ctx.createDelay(1);
    delay.delayTime.value = 0.42;
    const fb = ctx.createGain(); fb.gain.value = 0.35;
    delay.connect(fb); fb.connect(delay); delay.connect(this.music);

    const scheduleBar = () => {
      if (!this.ctx) return;
      const t0 = this.ctx.currentTime + 0.05;
      const chord = CHORDS[this.musicBar % CHORDS.length];
      for (const f of chord) {
        for (const det of [-4, 4]) {
          const o = ctx.createOscillator();
          o.type = 'sine'; o.frequency.value = f; o.detune.value = det;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0, t0);
          g.gain.linearRampToValueAtTime(0.05, t0 + 1.6);
          g.gain.setValueAtTime(0.05, t0 + BAR - 2.2);
          g.gain.linearRampToValueAtTime(0, t0 + BAR - 0.2);
          o.connect(g); g.connect(this.music); g.connect(delay);
          o.start(t0); o.stop(t0 + BAR);
        }
      }
      if (Math.random() < 0.75) {
        const bf = BELLS[(Math.random() * BELLS.length) | 0];
        const bo = ctx.createOscillator();
        bo.type = 'triangle'; bo.frequency.value = bf;
        const bg = ctx.createGain();
        const bt = t0 + 2 + Math.random() * (BAR - 4);
        bg.gain.setValueAtTime(0, bt);
        bg.gain.linearRampToValueAtTime(0.05, bt + 0.02);
        bg.gain.exponentialRampToValueAtTime(0.0001, bt + 1.4);
        bo.connect(bg); bg.connect(this.music); bg.connect(delay);
        bo.start(bt); bo.stop(bt + 1.5);
      }
      this.musicBar++;
      this.musicTimer = window.setTimeout(scheduleBar, BAR * 1000 - 120);
    };
    scheduleBar();
  }
}

export const SFX = new AudioEngine();
