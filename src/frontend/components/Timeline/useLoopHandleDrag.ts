import type { RefObject } from "react";
import { beginDrag, dragHandlers, pointerToFraction } from "./dragUtils";
import type { TimelineState } from "./types";

const MIN_LOOP_FRACTION = 0.01;

export const useLoopHandleDrag = (
  bandRef: RefObject<HTMLDivElement | null>,
  stateRef: RefObject<TimelineState>,
  onStart: () => void,
  onFinish: () => void,
) => {
  const begin = (side: "start" | "end") => {
    const band = bandRef.current;
    if (!band) return;
    onStart();
    beginDrag((clientX) => {
      const f = pointerToFraction(clientX, band);
      const { loop } = stateRef.current;
      stateRef.current.loop =
        side === "start"
          ? { start: Math.min(f, loop.end - MIN_LOOP_FRACTION), end: loop.end }
          : { start: loop.start, end: Math.max(f, loop.start + MIN_LOOP_FRACTION) };
    }, onFinish);
  };
  return (side: "start" | "end") => dragHandlers(() => begin(side));
};
