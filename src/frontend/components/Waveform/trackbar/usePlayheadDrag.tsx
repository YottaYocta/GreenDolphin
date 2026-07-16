import { type RefObject } from "react";
import type { WaveformMetadata } from "../types";
import {
  beginDrag,
  clampSample,
  dragHandlers,
  pointerToSample,
} from "./dragUtils";

export const usePlayheadDrag = (
  trackRef: RefObject<HTMLDivElement | null>,
  metadata: RefObject<WaveformMetadata>,
  totalSamples: number,
  handlePosition: (sample: number) => void,
) =>
  dragHandlers(() => {
    beginDrag((clientX) => {
      const track = trackRef.current;
      if (!track) return;
      handlePosition(
        clampSample(
          pointerToSample(clientX, track, metadata.current.viewport),
          totalSamples,
        ),
      );
    });
  });
