import { useCallback, useEffect, useRef } from "react";
import type { Section } from "../../lib/waveform";
import { clampSection } from "../../lib/util";
import { FULL_LOOP, rescaleLoop, sectionToLoop, type TimelineState } from "./types";

const initialState = (
  totalSamples: number,
  initialViewport?: Section,
  initialSelection?: Section,
): TimelineState => {
  const full = { start: 0, end: totalSamples };
  const viewport = initialViewport ?? full;
  return {
    viewport,
    loop:
      totalSamples > 0 && initialSelection
        ? sectionToLoop(viewport, clampSection(initialSelection, full))
        : FULL_LOOP,
  };
};

/** Owns the timeline's viewport + loop ref and re-seeds it when inputs change. */
export const useTimelineState = (
  totalSamples: number,
  initialViewport?: Section,
  initialSelection?: Section,
) => {
  const stateRef = useRef<TimelineState>(
    initialState(totalSamples, initialViewport, initialSelection),
  );
  useEffect(() => {
    stateRef.current = initialState(
      totalSamples,
      initialViewport,
      initialSelection,
    );
  }, [totalSamples, initialViewport, initialSelection]);

  // Pan keeps the loop fixed on screen; zoom keeps it on the recording.
  const setViewport = useCallback((viewport: Section) => {
    const prev = stateRef.current;
    const zoomed =
      Math.abs(viewport.end - viewport.start - (prev.viewport.end - prev.viewport.start)) >= 1;
    stateRef.current = {
      viewport,
      loop: zoomed ? rescaleLoop(prev.viewport, viewport, prev.loop) : prev.loop,
    };
  }, []);

  return { stateRef, setViewport };
};
