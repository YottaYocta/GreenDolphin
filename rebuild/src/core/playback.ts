import type { Section } from "./transport";
import type { ClockSeconds, RecordingSeconds, SpeedRatio } from "./units";

export type PlaybackMode = "silent" | "playing" | "frozen" | "scrubbing";

export interface Playback {
  mode: PlaybackMode;
  anchorPosition: RecordingSeconds;
  anchorTime: ClockSeconds;
  rate: SpeedRatio;
  loop: Section;
  loopWraps: boolean;
}

export function positionAt(playback: Playback, time: ClockSeconds): RecordingSeconds {
  const { mode, anchorPosition, anchorTime, rate, loop, loopWraps } = playback;
  if (mode !== "playing") return anchorPosition;
  const raw = anchorPosition + (time - anchorTime) * rate;
  if (raw < loop.end || anchorPosition >= loop.end) return raw;
  return loopWraps ? loop.start + ((raw - loop.start) % (loop.end - loop.start)) : loop.end;
}

export const continues = (prev: Playback, next: Playback) =>
  prev.mode === next.mode && positionAt(prev, next.anchorTime) === next.anchorPosition;
