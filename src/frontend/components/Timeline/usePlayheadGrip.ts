import type { RefObject } from "react";
import { beginDrag, dragHandlers, pointerToFraction } from "./dragUtils";
import type { TimelineState } from "./types";

/**
 * Drag on the playhead triangle. While dragging, `dragSampleRef` holds the
 * previewed sample so the playhead renders there; the position is only
 * committed on release.
 */
export const usePlayheadGrip = (
  measureRef: RefObject<HTMLDivElement | null>,
  stateRef: RefObject<TimelineState>,
  dragSampleRef: RefObject<number | null>,
  onPosition: (sample: number) => void,
) =>
  dragHandlers((startClientX) => {
    const el = measureRef.current;
    if (!el) return;
    const toSample = (clientX: number) => {
      const { viewport } = stateRef.current;
      return Math.round(
        viewport.start +
          pointerToFraction(clientX, el) * (viewport.end - viewport.start),
      );
    };
    let latest = toSample(startClientX);
    dragSampleRef.current = latest;
    beginDrag(
      (clientX) => {
        latest = toSample(clientX);
        dragSampleRef.current = latest;
      },
      () => {
        dragSampleRef.current = null;
        onPosition(latest);
      },
    );
  });
