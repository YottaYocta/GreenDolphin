import { createEngine } from "./engine";
import type { Audio } from "./interfaces";

export type { Audio, AudioEngine, Hertz, LinearGain, Semitones } from "./interfaces";

export const audio: Audio = { createEngine };
