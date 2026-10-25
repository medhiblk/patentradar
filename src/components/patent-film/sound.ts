/** Original synthesized score: no external samples, downloads or licensed recordings. */
export class FilmSound {
  private context: AudioContext;
  private bus: GainNode;
  constructor() {
    this.context = new AudioContext();
    this.bus = this.context.createGain();
    this.bus.gain.value = 0;
    this.bus.connect(this.context.destination);
    // A quiet, open fifth. Narration is deliberately much louder than the bed.
    [110, 164.81, 220.25].forEach((frequency) => {
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.frequency.value = frequency;
      gain.gain.value = 0.012;
      oscillator.connect(gain).connect(this.bus);
      oscillator.start();
    });
  }
  async resume() {
    await this.context.resume();
  }
  active(on: boolean) {
    this.bus.gain.setTargetAtTime(on ? 1 : 0, this.context.currentTime, 0.08);
  }
  cue(final = false) {
    const now = this.context.currentTime;
    (final ? [440, 659.25, 880] : [660]).forEach((frequency, i) => {
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      const start = now + i * 0.18;
      oscillator.frequency.setValueAtTime(frequency, start);
      oscillator.frequency.exponentialRampToValueAtTime(
        frequency * 0.8,
        start + 0.5,
      );
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.025, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.7);
      oscillator.connect(gain).connect(this.bus);
      oscillator.start(start);
      oscillator.stop(start + 0.75);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };
    });
  }
  close() {
    void this.context.close();
  }
}
