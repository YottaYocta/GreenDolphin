import type { ClockSeconds, Playback, RecordingSeconds } from "./interfaces";

export function positionAt(playback: Playback, time: ClockSeconds): RecordingSeconds {
  const { mode, anchorPosition, anchorTime, rate, loop, loopWraps } = playback;
  if (mode !== "playing") return anchorPosition;
  const raw = anchorPosition + (time - anchorTime) * rate;
  if (raw < loop.end || anchorPosition >= loop.end) return raw;
  return loopWraps ? loop.start + ((raw - loop.start) % (loop.end - loop.start)) : loop.end;
}

export const continues = (prev: Playback, next: Playback) =>
  prev.mode === next.mode && positionAt(prev, next.anchorTime) === next.anchorPosition;
