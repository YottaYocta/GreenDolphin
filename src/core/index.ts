import type { Core } from "./interfaces";
import { createPlayer } from "./player";
import { continues, positionAt } from "./playback";

export type {
  ClockSeconds,
  Core,
  DurationSeconds,
  LoopMode,
  Output,
  Playback,
  Player,
  PlayerOptions,
  PlayState,
  RecordingSeconds,
  Section,
  SpeedRatio,
  TransportEvent,
} from "./interfaces";

export const core: Core = { positionAt, continues, createPlayer };
