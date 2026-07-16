import { type RefObject } from "react";
import type { Section } from "../../../lib/waveform";
import type { WaveformMetadata } from "../types";
import {
  beginDrag,
  clampSample,
  dragHandlers,
  pointerToSample,
} from "./dragUtils";

const MIN_LOOP_GAP_SAMPLES = 1;

export const useLoopHandleDrag = (
  trackRef: RefObject<HTMLDivElement | null>,
  metadata: RefObject<WaveformMetadata>,
  totalSamples: number,
  handleLoopEdit: (section: Section) => void,
  handleLoopEditFinish: (section: Section) => void,
) => {
  const beginHandleDrag = (side: "start" | "end") => {
    const initial = metadata.current.selection;
    let latest: Section = initial;
    beginDrag(
      (clientX) => {
        const track = trackRef.current;
        if (!track) return;
        const sample = clampSample(
          pointerToSample(clientX, track, metadata.current.viewport),
          totalSamples,
        );
        latest =
          side === "start"
            ? {
                start: Math.min(sample, initial.end - MIN_LOOP_GAP_SAMPLES),
                end: initial.end,
              }
            : {
                start: initial.start,
                end: Math.max(sample, initial.start + MIN_LOOP_GAP_SAMPLES),
              };
        handleLoopEdit(latest);
      },
      () => handleLoopEditFinish(latest),
    );
  };

  return (side: "start" | "end") =>
    dragHandlers(() => beginHandleDrag(side));
};
