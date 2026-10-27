import type { Section } from "./transport";

export type PlaybackMode = "silent" | "playing" | "frozen" | "scrubbing";

/**
 * What an output should be doing right now. The playhead is described as a
 * trajectory: it was at `anchorPosition` when the output clock read
 * `anchorTime`, and moves `rate` seconds per clock second while playing.
 */
export interface Playback {
  mode: PlaybackMode;
  anchorPosition: number;
  anchorTime: number;
  rate: number;
  loop: Section;
  /** Wrap from the loop end to its start seamlessly; otherwise stop at the loop end. */
  loopWraps: boolean;
}

/** Where the playhead is at `time` on the output clock. */
export function positionAt(playback: Playback, time: number): number {
  const { mode, anchorPosition, anchorTime, rate, loop, loopWraps } = playback;
  if (mode !== "playing") return anchorPosition;
  const raw = anchorPosition + (time - anchorTime) * rate;
  if (raw < loop.end || anchorPosition >= loop.end) return raw;
  return loopWraps ? loop.start + ((raw - loop.start) % (loop.end - loop.start)) : loop.end;
}

/**
 * True when `next` carries on from `prev` without a jump: same mode, and the
 * playhead `next` starts from is exactly where `prev` would have it then.
 * Outputs use this to tell a seek (restart) from a re-anchor (adjust in place).
 */
export const continues = (prev: Playback, next: Playback) =>
  prev.mode === next.mode && positionAt(prev, next.anchorTime) === next.anchorPosition;
