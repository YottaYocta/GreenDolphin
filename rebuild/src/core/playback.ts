import type { Section } from "./transport";

export type PlaybackMode = "silent" | "playing" | "frozen" | "scrubbing";

export interface Playback {
  mode: PlaybackMode;
  anchorPosition: number;
  anchorTime: number;
  rate: number;
  loop: Section;
  loopWraps: boolean;
}

export function positionAt(playback: Playback, time: number): number {
  const { mode, anchorPosition, anchorTime, rate, loop, loopWraps } = playback;
  if (mode !== "playing") return anchorPosition;
  const raw = anchorPosition + (time - anchorTime) * rate;
  if (raw < loop.end || anchorPosition >= loop.end) return raw;
  return loopWraps ? loop.start + ((raw - loop.start) % (loop.end - loop.start)) : loop.end;
}

export const continues = (prev: Playback, next: Playback) =>
  prev.mode === next.mode && positionAt(prev, next.anchorTime) === next.anchorPosition;
