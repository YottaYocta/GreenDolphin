import { createEngine } from "./engine";
import type { Audio } from "./interfaces";
import { decode } from "./recording";

export type { Audio, AudioEngine, Hertz, LinearGain, Recording, Semitones } from "./interfaces";

export const audio: Audio = { decode, createEngine };
