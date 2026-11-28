/*
 * All sounds are made on the spot with the Web Audio API: no sound files. If the browser has no audio
 * (or blocks it) every call quietly does nothing.
 */
export type SoundName = "click" | "bowl" | "hit" | "four" | "six" | "wicket";

type Ctor = typeof AudioContext;

export class Sound {
  enabled: boolean;
  private ctx: AudioContext | null = null;
  private crowd: { src: AudioBufferSourceNode; gain: GainNode } | null = null;

  constructor(enabled: boolean) {
    this.enabled = enabled;
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
    } catch {
      this.ctx = null;
    }
    void this.ctx?.resume?.();
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    if (!on) this.stopCrowd();
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
    if (!c) return;
    const t0 = c.currentTime + at;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(c.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  private noiseBuffer(sec: number): AudioBuffer | null {
    const c = this.ctx;
    if (!c) return null;
    const b = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * sec)), c.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  private noise(dur: number, gain: number, freq: number, type: BiquadFilterType, swell = false) {
    const c = this.ctx;
    const buf = this.noiseBuffer(dur);
    if (!c || !buf) return;
    const t0 = c.currentTime;
    const s = c.createBufferSource();
    s.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(swell ? 0.0001 : gain, t0);
    if (swell) g.gain.exponentialRampToValueAtTime(gain, t0 + dur * 0.35);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f).connect(g).connect(c.destination);
    s.start(t0);
  }

  play(name: SoundName) {
    if (!this.enabled || !this.ctx) return;
    switch (name) {
      case "click":
        this.tone(700, 0.04, "sine", 0.08);
        break;
      case "bowl":
        this.noise(0.18, 0.05, 1800, "highpass");
        break;
      case "hit":
        this.noise(0.07, 0.25, 2200, "bandpass");
        this.tone(190, 0.1, "triangle", 0.25, 90);
        break;
      case "four":
        this.play("hit");
        this.noise(0.7, 0.12, 900, "bandpass", true);
        break;
      case "six":
        this.play("hit");
        this.noise(1.1, 0.18, 800, "bandpass", true);
        this.tone(440, 0.5, "triangle", 0.08, 880, 0.1);
        break;
      case "wicket":
        this.noise(0.12, 0.3, 1500, "bandpass");
        this.tone(130, 0.35, "sawtooth", 0.15, 55);
        break;
    }
  }

  /** A quiet crowd murmur while a game is on. */
  startCrowd() {
    const c = this.ctx;
    if (!this.enabled || !c || this.crowd) return;
    const buf = this.noiseBuffer(2);
    if (!buf) return;
    const src = c.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 450;
    const gain = c.createGain();
    gain.gain.value = 0.025;
    src.connect(f).connect(gain).connect(c.destination);
    src.start();
    this.crowd = { src, gain };
  }

  stopCrowd() {
    try {
      this.crowd?.src.stop();
    } catch {
      /* already stopped */
    }
    this.crowd = null;
  }

  dispose() {
    this.stopCrowd();
    void this.ctx?.close?.();
    this.ctx = null;
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
