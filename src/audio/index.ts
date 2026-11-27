import { createEngine } from "./engine";
import type { Audio } from "./interfaces";
import { decode, release } from "./recording";
import { tones } from "./tones";

export type { Audio, AudioEngine, LinearGain, Recording, Semitones, Tones } from "./interfaces";

export const audio: Audio = { decode, release, createEngine, tones };
