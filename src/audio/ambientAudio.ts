class AmbientAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;

  // Procedural Formula engine synthesis nodes
  private engineOsc1: OscillatorNode | null = null;
  private engineOsc2: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private engineGain: GainNode | null = null;

  private isPlaying = false;
  private muted = true;
  private volume = 0.45;
  private lfoTimer: number | null = null;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public startAmbience() {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || this.isPlaying) return;
    this.isPlaying = true;

    // Soft coastal track breeze (filtered pink-ish noise)
    const bufferSize = ctx.sampleRate * 3;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + white * 0.099046;
      b1 = 0.963 * b1 + white * 0.2965164;
      b2 = 0.57 * b2 + white * 1.0526913;
      output[i] = (b0 + b1 + b2 + white * 0.1848) * 0.04;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 340;
    filter.Q.value = 0.7;
    this.windFilter = filter;

    const windGain = ctx.createGain();
    windGain.gain.value = 0.45;

    noise.connect(filter);
    filter.connect(windGain);
    windGain.connect(this.masterGain);
    noise.start();

    // Subtle warm pit-lane harmonic pad
    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.value = 65.41;
    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.value = 98.0;

    const padFilter = ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = 180;

    const padGain = ctx.createGain();
    padGain.gain.value = 0.05;

    osc1.connect(padFilter);
    osc2.connect(padFilter);
    padFilter.connect(padGain);
    padGain.connect(this.masterGain);
    osc1.start();
    osc2.start();

    // Formula engine synthesis (silent until driving active)
    const engOsc1 = ctx.createOscillator();
    engOsc1.type = 'sawtooth';
    engOsc1.frequency.value = 85;

    const engOsc2 = ctx.createOscillator();
    engOsc2.type = 'triangle';
    engOsc2.frequency.value = 170;

    const engFilter = ctx.createBiquadFilter();
    engFilter.type = 'lowpass';
    engFilter.frequency.value = 420;
    engFilter.Q.value = 2.2;

    const engGain = ctx.createGain();
    engGain.gain.value = 0;

    engOsc1.connect(engFilter);
    engOsc2.connect(engFilter);
    engFilter.connect(engGain);
    engGain.connect(this.masterGain);
    engOsc1.start();
    engOsc2.start();

    this.engineOsc1 = engOsc1;
    this.engineOsc2 = engOsc2;
    this.engineFilter = engFilter;
    this.engineGain = engGain;

    let phase = 0;
    this.lfoTimer = window.setInterval(() => {
      if (!this.ctx || !this.windFilter) return;
      phase += 0.12;
      const freq = 290 + Math.sin(phase) * 110;
      this.windFilter.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.25);
    }, 250);

    this.syncGain();
  }

  public updateDrivingAudio(
    active: boolean,
    rpmRatio: number,
    throttle: number,
  ) {
    if (!this.ctx || !this.engineGain || !this.engineOsc1 || !this.engineOsc2 || !this.engineFilter) {
      return;
    }
    const now = this.ctx.currentTime;
    if (!active || this.muted) {
      this.engineGain.gain.setTargetAtTime(0, now, 0.08);
      return;
    }

    const baseFreq = 72 + rpmRatio * 235;
    this.engineOsc1.frequency.setTargetAtTime(baseFreq, now, 0.04);
    this.engineOsc2.frequency.setTargetAtTime(baseFreq * 2.01, now, 0.04);
    this.engineFilter.frequency.setTargetAtTime(320 + rpmRatio * 1450 + throttle * 450, now, 0.05);
    this.engineGain.gain.setTargetAtTime(0.065 + throttle * 0.055 + rpmRatio * 0.035, now, 0.06);
  }

  public setMuted(muted: boolean) {
    this.muted = muted;
    if (!muted && !this.isPlaying) {
      this.startAmbience();
    }
    this.syncGain();
  }

  public setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
    this.syncGain();
  }

  private syncGain() {
    if (!this.ctx || !this.masterGain) return;
    const target = this.muted ? 0 : this.volume * 0.65;
    this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.12);
  }

  public playUiClick() {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(240, now + 0.055);

    gain.gain.setValueAtTime(0.11 * this.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.065);
  }

  public playRaceLightBeep(isLightsOut: boolean) {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = isLightsOut ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(isLightsOut ? 880 : 440, now);
    if (isLightsOut) {
      osc.frequency.setValueAtTime(1046.5, now + 0.09);
    }

    const dur = isLightsOut ? 0.24 : 0.11;
    gain.gain.setValueAtTime(0.14 * this.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + dur + 0.01);
  }

  public dispose() {
    if (this.lfoTimer !== null) {
      clearInterval(this.lfoTimer);
      this.lfoTimer = null;
    }
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
    this.isPlaying = false;
  }
}

export const ambientAudio = new AmbientAudioEngine();
