// Source model: Fable 5
// WebAudio 程序化音效：无外部素材。首次用户交互后才创建 AudioContext。

export class AudioFX {
  private ctx: AudioContext | null = null;
  private chargeOsc: OscillatorNode | null = null;
  private chargeGain: GainNode | null = null;
  private windGain: GainNode | null = null;
  muted = false;

  ensure(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    try {
      this.ctx = new AudioContext();
      this.startWind();
    } catch {
      this.ctx = null;
    }
  }

  private blip(
    freq: number,
    dur: number,
    type: OscillatorType,
    gain: number,
    slideTo?: number
  ): void {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  // ---- 风声环境音：过滤白噪声 ----
  private startWind(): void {
    if (!this.ctx) return;
    const len = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0.02;
    src.connect(filter).connect(this.windGain).connect(this.ctx.destination);
    src.start();
  }

  /** 根据当前风力调整风声强度 */
  setWindLevel(level01: number): void {
    if (!this.ctx || !this.windGain) return;
    const target = this.muted ? 0 : 0.015 + 0.05 * Math.min(1, Math.max(0, level01));
    this.windGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.4);
  }

  chargeStart(): void {
    if (!this.ctx || this.muted) return;
    this.chargeStop();
    this.chargeOsc = this.ctx.createOscillator();
    this.chargeGain = this.ctx.createGain();
    this.chargeOsc.type = 'triangle';
    this.chargeOsc.frequency.value = 120;
    this.chargeGain.gain.value = 0.03;
    this.chargeOsc.connect(this.chargeGain).connect(this.ctx.destination);
    this.chargeOsc.start();
  }

  chargeUpdate(ratio: number): void {
    if (!this.ctx || !this.chargeOsc) return;
    this.chargeOsc.frequency.setTargetAtTime(120 + 380 * ratio, this.ctx.currentTime, 0.03);
  }

  chargeStop(): void {
    if (this.chargeOsc) {
      try {
        this.chargeOsc.stop();
      } catch {
        // already stopped
      }
      this.chargeOsc.disconnect();
      this.chargeOsc = null;
    }
    if (this.chargeGain) {
      this.chargeGain.disconnect();
      this.chargeGain = null;
    }
  }

  jump(ratio: number): void {
    this.chargeStop();
    this.blip(220 + 260 * ratio, 0.22, 'square', 0.05, 520 + 300 * ratio);
  }

  land(hard: boolean): void {
    this.blip(hard ? 90 : 140, hard ? 0.18 : 0.1, 'sine', hard ? 0.09 : 0.045, 45);
  }

  wallHit(): void {
    this.blip(180, 0.08, 'square', 0.04, 90);
  }

  spring(): void {
    this.blip(330, 0.3, 'triangle', 0.07, 990);
  }

  crumble(): void {
    this.blip(160, 0.25, 'sawtooth', 0.045, 55);
  }

  collect(): void {
    this.blip(880, 0.12, 'sine', 0.06, 1320);
    setTimeout(() => this.blip(1175, 0.16, 'sine', 0.05, 1568), 70);
  }

  checkpoint(): void {
    this.blip(523, 0.2, 'triangle', 0.06);
    setTimeout(() => this.blip(784, 0.3, 'triangle', 0.06), 130);
  }

  fall(): void {
    this.blip(300, 0.4, 'sawtooth', 0.05, 70);
  }

  finish(): void {
    const notes = [523, 659, 784, 1047, 784, 1047];
    notes.forEach((f, i) => setTimeout(() => this.blip(f, 0.35, 'triangle', 0.07), i * 160));
  }
}
