import type { Core } from "./interfaces";

export const positionAt: Core["positionAt"] = (playback, time) => {
  const { mode, anchorPosition, anchorTime, rate, loop, loopWraps } = playback;
  if (mode !== "playing") return anchorPosition;
  const raw = anchorPosition + (time - anchorTime) * rate;
  if (raw < loop.end || anchorPosition >= loop.end) return raw;
  return loopWraps ? loop.start + ((raw - loop.start) % (loop.end - loop.start)) : loop.end;
};

export const continues: Core["continues"] = (previous, next) =>
  previous.mode === next.mode && positionAt(previous, next.anchorTime) === next.anchorPosition;
