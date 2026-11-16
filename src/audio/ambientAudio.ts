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

  private victoryTimer: number | null = null;
  private victoryCrowdGain: GainNode | null = null;
  private victoryCrowdSource: AudioBufferSourceNode | null = null;
  private victoryAnthemGain: GainNode | null = null;

  public startVictoryAudio(isChampionship: boolean) {
    this.stopVictoryAudio();
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;

    // 1. Stadium crowd roar & applause (bandpass + highshelf filtered pink noise)
    const bufLen = ctx.sampleRate * 4;
    const crowdBuf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = crowdBuf.getChannelData(0);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    for (let i = 0; i < bufLen; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.997 * b0 + white * 0.08;
      b1 = 0.955 * b1 + white * 0.28;
      b2 = 0.56 * b2 + white * 0.95;
      // Modulate applause texture slightly
      const ripple = 0.72 + 0.28 * Math.sin((i / ctx.sampleRate) * 28.0);
      data[i] = (b0 + b1 + b2 + white * 0.16) * 0.095 * ripple;
    }

    const crowdSource = ctx.createBufferSource();
    crowdSource.buffer = crowdBuf;
    crowdSource.loop = true;

    const crowdBp = ctx.createBiquadFilter();
    crowdBp.type = 'bandpass';
    crowdBp.frequency.value = isChampionship ? 1150 : 950;
    crowdBp.Q.value = 0.65;

    const crowdGain = ctx.createGain();
    crowdGain.gain.setValueAtTime(0.001, now);
    crowdGain.gain.linearRampToValueAtTime(
      isChampionship ? 0.42 : 0.28,
      now + 1.1,
    );

    crowdSource.connect(crowdBp);
    crowdBp.connect(crowdGain);
    crowdGain.connect(this.masterGain);
    crowdSource.start(now);

    this.victoryCrowdSource = crowdSource;
    this.victoryCrowdGain = crowdGain;

    // 2. Celebratory victory anthem progression
    const anthemGain = ctx.createGain();
    anthemGain.gain.setValueAtTime(0.001, now);
    anthemGain.gain.linearRampToValueAtTime(
      isChampionship ? 0.26 : 0.2,
      now + 0.5,
    );
    anthemGain.connect(this.masterGain);
    this.victoryAnthemGain = anthemGain;

    // Triumphant brassy/orchestral chord progression (D major -> A major -> B minor -> G -> A -> D)
    const chords: Array<{ bass: number; triad: number[]; dur: number }> = isChampionship
      ? [
          { bass: 73.42, triad: [293.66, 369.99, 440.0, 587.33], dur: 2.2 }, // D maj
          { bass: 55.0, triad: [220.0, 277.18, 329.63, 440.0], dur: 2.0 }, // A maj
          { bass: 61.74, triad: [246.94, 293.66, 369.99, 493.88], dur: 2.0 }, // Bm
          { bass: 98.0, triad: [196.0, 246.94, 293.66, 392.0], dur: 1.8 }, // G maj
          { bass: 110.0, triad: [220.0, 277.18, 329.63, 440.0], dur: 1.8 }, // A maj
          { bass: 73.42, triad: [293.66, 369.99, 440.0, 587.33], dur: 3.0 }, // D maj finale
        ]
      : [
          { bass: 73.42, triad: [293.66, 369.99, 440.0], dur: 2.0 },
          { bass: 98.0, triad: [196.0, 246.94, 293.66], dur: 1.9 },
          { bass: 110.0, triad: [220.0, 277.18, 329.63], dur: 1.9 },
          { bass: 73.42, triad: [293.66, 369.99, 440.0], dur: 2.6 },
        ];

    let stepIdx = 0;
    const playChord = () => {
      if (!this.ctx || !this.victoryAnthemGain) return;
      const t = this.ctx.currentTime;
      const chord = chords[stepIdx % chords.length];
      stepIdx += 1;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1400, t);
      filter.frequency.exponentialRampToValueAtTime(650, t + chord.dur * 0.9);
      filter.connect(this.victoryAnthemGain);

      // Warm sub bass note
      const bassOsc = this.ctx.createOscillator();
      const bassGain = this.ctx.createGain();
      bassOsc.type = 'triangle';
      bassOsc.frequency.setValueAtTime(chord.bass, t);
      bassGain.gain.setValueAtTime(0.001, t);
      bassGain.gain.linearRampToValueAtTime(0.28, t + 0.08);
      bassGain.gain.exponentialRampToValueAtTime(0.01, t + chord.dur);
      bassOsc.connect(bassGain);
      bassGain.connect(filter);
      bassOsc.start(t);
      bassOsc.stop(t + chord.dur + 0.05);

      // Harmonic brass/pad voices
      chord.triad.forEach((freq, idx) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const voiceGain = this.ctx.createGain();
        osc.type = idx % 2 === 0 ? 'sawtooth' : 'triangle';
        osc.frequency.setValueAtTime(freq, t);
        const peak = 0.08 / chord.triad.length;
        voiceGain.gain.setValueAtTime(0.001, t);
        voiceGain.gain.linearRampToValueAtTime(peak, t + 0.14);
        voiceGain.gain.setValueAtTime(peak * 0.85, t + chord.dur * 0.7);
        voiceGain.gain.exponentialRampToValueAtTime(0.001, t + chord.dur);
        osc.connect(voiceGain);
        voiceGain.connect(filter);
        osc.start(t);
        osc.stop(t + chord.dur + 0.05);
      });
    };

    playChord();
    this.victoryTimer = window.setInterval(() => {
      if (!this.victoryAnthemGain) return;
      playChord();
      if (this.victoryCrowdGain && this.ctx) {
        const t = this.ctx.currentTime;
        const swell = isChampionship ? 0.52 : 0.34;
        this.victoryCrowdGain.gain.setTargetAtTime(swell, t, 0.35);
      }
    }, isChampionship ? 2100 : 2000);
  }

  public playCelebrationBurst() {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    // Confetti cannon pop + celebratory chime chord
    const popBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.35), ctx.sampleRate);
    const ch = popBuf.getChannelData(0);
    for (let i = 0; i < ch.length; i++) {
      const env = Math.exp((-i / ctx.sampleRate) * 14);
      ch[i] = (Math.random() * 2 - 1) * env * 0.45;
    }
    const popSrc = ctx.createBufferSource();
    popSrc.buffer = popBuf;
    const popFilter = ctx.createBiquadFilter();
    popFilter.type = 'lowpass';
    popFilter.frequency.setValueAtTime(1800, now);
    popFilter.frequency.exponentialRampToValueAtTime(220, now + 0.32);

    const popGain = ctx.createGain();
    popGain.gain.setValueAtTime(0.55, now);

    popSrc.connect(popFilter);
    popFilter.connect(popGain);
    popGain.connect(this.masterGain);
    popSrc.start(now);

    [587.33, 739.99, 880.0, 1174.66].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.04);
      g.gain.setValueAtTime(0.001, now + idx * 0.04);
      g.gain.linearRampToValueAtTime(0.11, now + idx * 0.04 + 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.04 + 0.85);
      osc.connect(g);
      g.connect(this.masterGain!);
      osc.start(now + idx * 0.04);
      osc.stop(now + idx * 0.04 + 0.9);
    });
  }

  public stopVictoryAudio() {
    if (this.victoryTimer !== null) {
      clearInterval(this.victoryTimer);
      this.victoryTimer = null;
    }
    if (this.victoryCrowdSource) {
      try {
        this.victoryCrowdSource.stop();
        this.victoryCrowdSource.disconnect();
      } catch {
        // ignore already stopped
      }
      this.victoryCrowdSource = null;
    }
    if (this.victoryCrowdGain && this.ctx) {
      try {
        this.victoryCrowdGain.disconnect();
      } catch {
        // ignore
      }
      this.victoryCrowdGain = null;
    }
    if (this.victoryAnthemGain) {
      try {
        this.victoryAnthemGain.disconnect();
      } catch {
        // ignore
      }
      this.victoryAnthemGain = null;
    }
  }

  public dispose() {
    this.stopVictoryAudio();
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
