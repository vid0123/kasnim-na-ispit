import { AUDIO } from "../config";

/**
 * Jednostavni zvukovi generirani Web Audio API-jem, bez vanjskih datoteka.
 * AudioContext se smije stvoriti tek nakon korisnickog klika, pa ga pravimo
 * lijeno pri prvom pozivu unlock().
 */
export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = false;

  /** Mora se zvati iz obrade klika ili dodira. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return;
    }
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;

    try {
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = AUDIO.MASTER_VOLUME;
      this.master.connect(this.ctx.destination);
    } catch {
      // Bez zvuka igra i dalje radi.
      this.ctx = null;
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  /** Otkucaj sata u zadnjim sekundama. */
  tick(urgent: boolean): void {
    this.beep(urgent ? 1180 : 880, 0.06, "square", 0.5);
  }

  /** Pokupljena kava. */
  coffee(): void {
    this.beep(660, 0.09, "triangle", 0.8);
    this.beep(990, 0.12, "triangle", 0.7, 0.08);
  }

  /** Sudar sa studentom. */
  bump(): void {
    this.beep(140, 0.14, "sawtooth", 0.5);
  }

  /** Kriva dvorana. */
  wrongRoom(): void {
    this.beep(320, 0.13, "square", 0.6);
    this.beep(200, 0.2, "square", 0.6, 0.12);
  }

  /** Pobjeda. */
  win(): void {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => this.beep(f, 0.16, "triangle", 0.8, i * 0.11));
  }

  /** Poraz. */
  lose(): void {
    const notes = [392, 330, 262];
    notes.forEach((f, i) => this.beep(f, 0.26, "sawtooth", 0.6, i * 0.2));
  }

  dispose(): void {
    void this.ctx?.close();
    this.ctx = null;
    this.master = null;
  }

  private beep(
    frequency: number,
    duration: number,
    type: OscillatorType,
    gain: number,
    delay = 0,
  ): void {
    if (this.muted || !this.ctx || !this.master) return;

    const start = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, start);

    // Kratka ovojnica da zvuk ne pukne na pocetku i kraju.
    env.gain.setValueAtTime(0.0001, start);
    env.gain.exponentialRampToValueAtTime(gain, start + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    osc.connect(env);
    env.connect(this.master);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }
}
