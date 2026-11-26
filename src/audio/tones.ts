import type { Tones } from "./interfaces";
import { audioContext } from "./recording";

const LEVEL = 10 ** (-10 / 20);

export function tonePlayer(ctx: AudioContext, destination: AudioNode): Tones["playTone"] {
  let tone: OscillatorNode | null = null;
  return (frequency) => {
    tone?.stop();
    tone = null;
    if (frequency === null) return;
    void ctx.resume();
    const level = ctx.createGain();
    level.gain.value = LEVEL;
    tone = Object.assign(ctx.createOscillator(), { type: "sine" as const });
    tone.frequency.value = frequency;
    tone.connect(level).connect(destination);
    tone.start();
  };
}

let play: Tones["playTone"] | null = null;
export const tones: Tones = { playTone: (frequency) => (play ??= tonePlayer(audioContext(), audioContext().destination))(frequency) };
