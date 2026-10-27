import { createEngine } from "./engine";
import type { Audio } from "./interfaces";
import { createFreezeVocoder } from "./vocoder";

export type * from "./interfaces";

export const audio: Audio = { createEngine, createFreezeVocoder };
