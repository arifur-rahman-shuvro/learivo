/*
 * Sounds are made on the spot with the Web Audio API: no sound files. If the browser has no audio
 * (or blocks it) every call quietly does nothing, and the game plays on.
 */
export type SoundName =
  "click" | "tick" | "go" | "hit" | "perfect" | "smash" | "wall" | "point" | "lose" | "win";

type Ctor = typeof AudioContext;

export class Sound {
  enabled: boolean;
  volume: number;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;

  constructor(enabled: boolean, volume = 0.7) {
    this.enabled = enabled;
    this.volume = volume;
  }

  /** Must be called from a tap: browsers only allow audio after one. */
  unlock() {
    if (this.ctx || typeof window === "undefined") return;
    const C: Ctor | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext;
    if (!C) return;
    try {
      this.ctx = new C();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
      this.master = null;
    }
    void this.ctx?.resume?.();
  }

  setEnabled(on: boolean) {
    this.enabled = on;
  }
  setVolume(v: number) {
    this.volume = Math.min(1, Math.max(0, v));
    if (this.master) this.master.gain.value = this.volume;
  }

  private tone(
    freq: number,
    dur: number,
    type: OscillatorType,
    gain: number,
    slideTo?: number,
    at = 0,
  ) {
    const c = this.ctx;
    const out = this.master;
    if (!c || !out) return;
    const t0 = c.currentTime + at;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(out);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  private click(gain: number, freq: number) {
    const c = this.ctx;
    const out = this.master;
    if (!c || !out) return;
    const len = Math.floor(c.sampleRate * 0.04);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = c.createBufferSource();
    s.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = freq;
    const g = c.createGain();
    g.gain.value = gain;
    s.connect(f).connect(g).connect(out);
    s.start();
  }

  play(name: SoundName) {
    if (!this.enabled || !this.ctx) return;
    switch (name) {
      case "click":
        this.tone(700, 0.04, "sine", 0.1);
        break;
      case "tick":
        this.tone(520, 0.09, "sine", 0.18);
        break;
      case "go":
        this.tone(780, 0.22, "triangle", 0.2, 1040);
        break;
      case "hit":
        this.click(0.9, 2400);
        this.tone(320, 0.05, "triangle", 0.18, 200);
        break;
      case "perfect":
        this.click(1, 3200);
        this.tone(880, 0.12, "triangle", 0.16, 1320);
        break;
      case "smash":
        this.click(1.2, 1800);
        this.tone(160, 0.16, "sawtooth", 0.14, 70);
        break;
      case "wall":
        this.tone(240, 0.05, "sine", 0.12, 180);
        break;
      case "point":
        this.tone(520, 0.12, "triangle", 0.16);
        this.tone(660, 0.16, "triangle", 0.16, undefined, 0.1);
        break;
      case "lose":
        this.tone(330, 0.25, "triangle", 0.16, 200);
        break;
      case "win":
        this.tone(523, 0.14, "triangle", 0.18);
        this.tone(659, 0.14, "triangle", 0.18, undefined, 0.14);
        this.tone(784, 0.28, "triangle", 0.18, undefined, 0.28);
        break;
    }
  }

  dispose() {
    void this.ctx?.close?.();
    this.ctx = null;
    this.master = null;
  }
}

/** Short buzz on supported phones; silent elsewhere. */
export function buzz(ms: number | number[], on: boolean) {
  if (!on || typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate(ms);
  } catch {
    /* ignore */
  }
}
