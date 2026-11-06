// Procedural horror audio — no assets, pure WebAudio synthesis.
export class HorrorAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private droneNodes: AudioNode[] = [];
  private droneGain: GainNode | null = null;
  private heartbeatTimer: number | null = null;
  muted = false;
  private started = false;

  constructor() {
    try {
      this.muted = localStorage.getItem('dreadlight_muted') === '1';
    } catch { /* noop */ }
  }

  private ensure(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.85;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  unlock() {
    this.ensure();
    if (!this.started) {
      this.started = true;
      this.startDrone();
    }
  }

  setMuted(m: boolean) {
    this.muted = m;
    try { localStorage.setItem('dreadlight_muted', m ? '1' : '0'); } catch { /* noop */ }
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.85, this.ctx.currentTime, 0.03);
    }
  }

  private startDrone() {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    // stop old
    this.stopDrone();
    const g = ctx.createGain();
    g.gain.value = 0.0;
    g.connect(this.master);
    g.gain.setTargetAtTime(0.16, ctx.currentTime, 3.0);
    this.droneGain = g;

    // low ominous oscillators
    const freqs = [41.2, 55, 55.7, 82.4];
    freqs.forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = i % 2 === 0 ? 'sawtooth' : 'sine';
      o.frequency.value = f;
      const og = ctx.createGain();
      og.gain.value = i < 2 ? 0.5 : 0.22;
      const flt = ctx.createBiquadFilter();
      flt.type = 'lowpass';
      flt.frequency.value = 220;
      flt.Q.value = 2;
      o.connect(flt); flt.connect(og); og.connect(g);
      o.start();
      // slow LFO on frequency for unease
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.05 + i * 0.03;
      const lfoG = ctx.createGain();
      lfoG.gain.value = 3 + i;
      lfo.connect(lfoG); lfoG.connect(o.frequency);
      lfo.start();
      this.droneNodes.push(o, lfo);
    });

    // wind noise
    const bufLen = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) d[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;
    const nf = ctx.createBiquadFilter();
    nf.type = 'bandpass';
    nf.frequency.value = 480;
    nf.Q.value = 0.6;
    const ng = ctx.createGain();
    ng.gain.value = 0.12;
    noise.connect(nf); nf.connect(ng); ng.connect(g);
    noise.start();
    this.droneNodes.push(noise);
    // slow sweep of wind
    const windLfo = ctx.createOscillator();
    windLfo.frequency.value = 0.07;
    const wg = ctx.createGain();
    wg.gain.value = 260;
    windLfo.connect(wg); wg.connect(nf.frequency);
    windLfo.start();
    this.droneNodes.push(windLfo);
  }

  private stopDrone() {
    for (const n of this.droneNodes) {
      try { (n as OscillatorNode).stop?.(); } catch { /* noop */ }
      try { n.disconnect(); } catch { /* noop */ }
    }
    this.droneNodes = [];
    try { this.droneGain?.disconnect(); } catch { /* noop */ }
    this.droneGain = null;
  }

  setIntensity(v: number) {
    // v 0..1 — raise drone filter / gain as waves progress
    if (!this.ctx || !this.droneGain) return;
    const t = this.ctx.currentTime;
    this.droneGain.gain.setTargetAtTime(0.14 + v * 0.12, t, 1.2);
  }

  setHeartbeat(on: boolean) {
    if (on && this.heartbeatTimer == null) {
      const beat = () => {
        this.thump(58, 0.5);
        window.setTimeout(() => this.thump(52, 0.4), 180);
        this.heartbeatTimer = window.setTimeout(beat, 950) as unknown as number;
      };
      beat();
    } else if (!on && this.heartbeatTimer != null) {
      clearTimeout(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private thump(freq: number, vol: number) {
    const ctx = this.ensure();
    if (!ctx || !this.master || this.muted) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq * 1.6, t);
    o.frequency.exponentialRampToValueAtTime(freq * 0.6, t + 0.16);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + 0.25);
  }

  private blip(freqA: number, freqB: number, dur: number, type: OscillatorType, vol: number, delay = 0) {
    const ctx = this.ensure();
    if (!ctx || !this.master || this.muted) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freqA, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, freqB), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  private noiseBurst(dur: number, vol: number, filterFreq: number, type: BiquadFilterType = 'lowpass') {
    const ctx = this.ensure();
    if (!ctx || !this.master || this.muted) return;
    const t = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, Math.max(1, len), ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t);
  }

  pulse() {
    this.blip(180, 1400, 0.28, 'sawtooth', 0.22);
    this.blip(90, 500, 0.32, 'sine', 0.3);
    this.noiseBurst(0.25, 0.25, 2400, 'highpass');
  }
  kill(combo = 0) {
    const p = 1 + Math.min(combo, 12) * 0.06;
    this.blip(700 * p, 120, 0.22, 'square', 0.12);
    this.noiseBurst(0.18, 0.2, 900);
    this.blip(1400 * p, 2400 * p, 0.12, 'sine', 0.1, 0.03);
  }
  hit() {
    this.blip(160, 40, 0.4, 'sawtooth', 0.4);
    this.noiseBurst(0.3, 0.35, 500);
    this.thump(48, 0.6);
  }
  pickup() {
    this.blip(880, 1760, 0.14, 'sine', 0.16);
    this.blip(1320, 1980, 0.12, 'sine', 0.1, 0.06);
  }
  oil() {
    this.blip(220, 660, 0.2, 'triangle', 0.22);
    this.blip(330, 990, 0.18, 'triangle', 0.15, 0.08);
  }
  heart() {
    this.blip(520, 780, 0.25, 'sine', 0.2);
    this.blip(780, 1040, 0.2, 'sine', 0.14, 0.1);
  }
  wave() {
    this.blip(98, 65, 0.9, 'sawtooth', 0.3);
    this.blip(147, 98, 0.9, 'sawtooth', 0.18, 0.05);
    this.noiseBurst(0.7, 0.12, 300);
  }
  uiClick() {
    this.blip(600, 900, 0.07, 'square', 0.08);
  }
  gameOver() {
    this.blip(220, 38, 1.4, 'sawtooth', 0.32);
    this.blip(110, 30, 1.6, 'triangle', 0.3, 0.15);
    this.noiseBurst(1.0, 0.2, 400);
  }
  dawn() { // not used but kept
    this.blip(440, 880, 0.5, 'sine', 0.15);
  }
}

export const audio = new HorrorAudio();
