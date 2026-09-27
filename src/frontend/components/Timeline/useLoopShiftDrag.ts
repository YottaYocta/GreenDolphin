import type { RefObject } from "react";
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
    beginDrag(
      (clientX) => {
        const df = (clientX - startClientX) / width;
        const start = Math.max(0, Math.min(1 - len, initial.start + df));
        stateRef.current.loop = { start, end: start + len };
      },
      onFinish,
    );
  });
