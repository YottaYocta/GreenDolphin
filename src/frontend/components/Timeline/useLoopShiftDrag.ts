import type { RefObject } from "react";
import { clamp } from "../../lib/util";
import { beginDrag, dragHandlers } from "./dragUtils";
import type { TimelineState } from "./types";

/** Drag the loop body: translates the loop within the viewport frame. */
export const useLoopShiftDrag = (
  bandRef: RefObject<HTMLDivElement | null>,
  stateRef: RefObject<TimelineState>,
  onStart: () => void,
  onFinish: () => void,
) =>
  dragHandlers((startClientX) => {
    const band = bandRef.current;
    if (!band) return;
    const width = band.getBoundingClientRect().width;
    const initial = stateRef.current.loop;
    const len = initial.end - initial.start;
    onStart();
    beginDrag((clientX) => {
      const start = clamp(initial.start + (clientX - startClientX) / width, 0, 1 - len);
      stateRef.current.loop = { start, end: start + len };
    }, onFinish);
  });
