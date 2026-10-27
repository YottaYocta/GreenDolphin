import type { Core } from "./interfaces";
import { createPlayer } from "./player";
import { continues, positionAt } from "./playback";
import { inLoop, loopDelay, transition } from "./transport";

export type * from "./interfaces";

export const core: Core = { transition, inLoop, loopDelay, positionAt, continues, createPlayer };
