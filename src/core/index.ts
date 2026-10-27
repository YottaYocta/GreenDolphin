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
  PlaybackMode,
  Player,
  PlayerOptions,
  PlayState,
  RecordingSeconds,
  Section,
  SpeedRatio,
  TransportEvent,
  TransportState,
} from "./interfaces";

export const core: Core = { positionAt, continues, createPlayer };
