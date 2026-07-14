import { useCallback, useRef, type RefObject } from "react";
import type { Section } from "../../../lib/waveform";
import type { WaveformMetadata } from "../types";

const SCROLL_INTO_VIEW_MARGIN = 0.15;

export const useLoopCarets = (
  metadataRef: RefObject<WaveformMetadata>,
  totalSamples: number,
  handleRange: (range: Section) => void,
) => {
  const leftCaretRef = useRef<HTMLButtonElement | null>(null);
  const rightCaretRef = useRef<HTMLButtonElement | null>(null);

  const scrollBoundaryIntoView = useCallback(
    (side: "start" | "end") => {
      const { range, section } = metadataRef.current;
      const rangeLen = range.end - range.start;
      if (rangeLen <= 0) return;
      const margin = SCROLL_INTO_VIEW_MARGIN * rangeLen;
      const newRange: Section =
        side === "start"
          ? {
              start: Math.max(0, Math.floor(section.start - margin)),
              end: range.end,
            }
          : {
              start: range.start,
              end: Math.min(totalSamples, Math.ceil(section.end + margin)),
            };
      if (newRange.end - newRange.start <= 0) return;
      handleRange(newRange);
    },
    [metadataRef, totalSamples, handleRange],
  );

  const applyCaretVisibility = useCallback(
    (startPct: number, endPct: number) => {
      const left = leftCaretRef.current;
      const right = rightCaretRef.current;
      if (left) left.style.display = startPct < 0 ? "flex" : "none";
      if (right) right.style.display = endPct > 100 ? "flex" : "none";
    },
    [],
  );

  return {
    leftCaretRef,
    rightCaretRef,
    applyCaretVisibility,
    onLeftCaretClick: () => scrollBoundaryIntoView("start"),
    onRightCaretClick: () => scrollBoundaryIntoView("end"),
  };
};
