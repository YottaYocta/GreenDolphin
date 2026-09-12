import { useCallback, useRef, type RefObject } from "react";
import type { Section } from "../../../lib/waveform";
import type { WaveformMetadata } from "../types";
import { MStoSampleIndex } from "../../../lib/util";

const SCROLL_INTO_VIEW_MARGIN = 0.15;

export const usePlayheadCaret = (
  metadataRef: RefObject<WaveformMetadata>,
  totalSamples: number,
  sampleRate: number,
  positionMS: RefObject<number> | undefined,
  handleRange: (range: Section) => void,
) => {
  const leftCaretRef = useRef<HTMLButtonElement | null>(null);
  const rightCaretRef = useRef<HTMLButtonElement | null>(null);

  const scrollPlayheadIntoView = useCallback(
    (side: "start" | "end") => {
      if (!positionMS) return;
      const { viewport } = metadataRef.current;
      const rangeLen = viewport.end - viewport.start;
      if (rangeLen <= 0) return;
      const playheadSample = MStoSampleIndex(sampleRate, positionMS.current);
      const margin = SCROLL_INTO_VIEW_MARGIN * rangeLen;
      const newRange: Section =
        side === "start"
          ? {
              start: Math.max(0, Math.floor(playheadSample - margin)),
              end: viewport.end,
            }
          : {
              start: viewport.start,
              end: Math.min(totalSamples, Math.ceil(playheadSample + margin)),
            };
      if (newRange.end - newRange.start <= 0) return;
      handleRange(newRange);
    },
    [metadataRef, totalSamples, sampleRate, positionMS, handleRange],
  );

  const applyPlayheadCaretVisibility = useCallback((pct: number) => {
    const left = leftCaretRef.current;
    const right = rightCaretRef.current;
    if (left) left.style.display = pct < 0 ? "flex" : "none";
    if (right) right.style.display = pct > 100 ? "flex" : "none";
  }, []);

  return {
    leftCaretRef,
    rightCaretRef,
    applyPlayheadCaretVisibility,
    onLeftCaretClick: () => scrollPlayheadIntoView("start"),
    onRightCaretClick: () => scrollPlayheadIntoView("end"),
  };
};
