import { createEngine } from "./engine";
import type { Audio } from "./interfaces";
import { decode } from "./recording";
import { createSynth } from "./synth";

export type { Audio, AudioEngine, Hertz, LinearGain, NoteSynth, Recording, Semitones } from "./interfaces";

export const audio: Audio = { decode, createEngine, createSynth };
