import { audioContext } from "./recording";
import type { Audio, Hertz, NoteSynth } from "./interfaces";

const LEVEL = 0.25;
const ATTACK = 0.005;
const RELEASE = 0.06;
const HARMONICS = [0, 1, 0.4, 0.2, 0.1, 0.05];

interface Voice {
  oscillator: OscillatorNode;
  envelope: GainNode;
}

export class ToneSynth implements NoteSynth {
  private readonly ctx: AudioContext;
  private readonly destination: AudioNode;
  private readonly wave: PeriodicWave;
  private readonly notes = new Set<Voice>();
  private tone: Voice | null = null;

  constructor(ctx: AudioContext, destination: AudioNode) {
    this.ctx = ctx;
    this.destination = destination;
    this.wave = ctx.createPeriodicWave(new Float32Array(HARMONICS.length), Float32Array.from(HARMONICS));
  }

  playTone(frequency: Hertz | null) {
    if (this.tone) this.release(this.tone);
    this.tone = frequency === null ? null : this.voice(frequency, this.ctx.currentTime);
  }

  playNote(frequency: Hertz, delay: number, duration: number) {
    const at = this.ctx.currentTime + delay;
    const voice = this.voice(frequency, at);
    voice.envelope.gain.setValueAtTime(LEVEL, at + Math.max(ATTACK, duration - RELEASE));
    voice.envelope.gain.linearRampToValueAtTime(0, at + Math.max(ATTACK, duration));
    voice.oscillator.stop(at + Math.max(ATTACK, duration));
    this.notes.add(voice);
  }

  stopNotes() {
    this.notes.forEach((voice) => this.release(voice));
  }

  dispose() {
    this.playTone(null);
    this.stopNotes();
  }

  private voice(frequency: Hertz, at: number): Voice {
    void this.ctx.resume();
    const oscillator = this.ctx.createOscillator();
    oscillator.setPeriodicWave(this.wave);
    oscillator.frequency.value = frequency;
    const envelope = this.ctx.createGain();
    envelope.gain.setValueAtTime(0, at);
    envelope.gain.linearRampToValueAtTime(LEVEL, at + ATTACK);
    oscillator.connect(envelope).connect(this.destination);
    oscillator.start(at);
    const voice = { oscillator, envelope };
    oscillator.onended = () => {
      envelope.disconnect();
      this.notes.delete(voice);
    };
    return voice;
  }

  private release({ oscillator, envelope }: Voice) {
    const now = this.ctx.currentTime;
    envelope.gain.cancelScheduledValues(now);
    envelope.gain.setTargetAtTime(0, now, RELEASE / 4);
    oscillator.stop(now + RELEASE);
  }
}

export const createSynth: Audio["createSynth"] = () => new ToneSynth(audioContext(), audioContext().destination);
