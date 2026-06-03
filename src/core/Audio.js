/**
 * Tiny Web Audio synth — all sound effects are generated procedurally, so the
 * game ships with zero audio assets. The AudioContext is created lazily on the
 * first user gesture (browser autoplay policy) via `resume()`.
 */
export class AudioFx {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = localStorage.getItem('snake3d.muted') === '1';
  }

  /** Must be called from a user gesture (button click / keypress). */
  resume() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  toggleMute() {
    this.muted = !this.muted;
    localStorage.setItem('snake3d.muted', this.muted ? '1' : '0');
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }

  /** Core voice: an oscillator with an exponential gain envelope. */
  _tone(freq, dur, { type = 'sine', gain = 0.3, sweep = 0, delay = 0 } = {}) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (sweep) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freq + sweep), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  /** Pickup blip; pitch rises with the orb's energy. */
  eat(energy = 1) {
    const base = 520 + energy * 90;
    this._tone(base, 0.12, { type: 'triangle', gain: 0.25, sweep: 180 });
    this._tone(base * 1.5, 0.1, { type: 'sine', gain: 0.12, delay: 0.04 });
  }

  powerup(type) {
    if (type === 'shield') {
      this._tone(440, 0.18, { type: 'sine', gain: 0.25, sweep: 220 });
      this._tone(660, 0.22, { type: 'sine', gain: 0.18, delay: 0.08 });
    } else {
      this._tone(300, 0.16, { type: 'sawtooth', gain: 0.22, sweep: 500 });
      this._tone(600, 0.18, { type: 'square', gain: 0.12, delay: 0.06 });
    }
  }

  death() {
    this._tone(320, 0.5, { type: 'sawtooth', gain: 0.3, sweep: -260 });
    this._tone(160, 0.6, { type: 'triangle', gain: 0.22, sweep: -120, delay: 0.05 });
  }

  jump() {
    this._tone(280, 0.18, { type: 'sine', gain: 0.2, sweep: 320 });
  }

  turn() {
    this._tone(220, 0.05, { type: 'square', gain: 0.04 });
  }
}
