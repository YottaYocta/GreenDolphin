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
  dragSampleRef: RefObject<number | null>,
) =>
  dragHandlers((startClientX) => {
    const track = trackRef.current;
    if (!track) return;
    const toSample = (clientX: number) =>
      clampSample(
        pointerToSample(clientX, track, metadata.current.viewport),
        totalSamples,
      );
    let latest = toSample(startClientX);
    dragSampleRef.current = latest;
    beginDrag(
      (clientX) => {
        latest = toSample(clientX);
        dragSampleRef.current = latest;
      },
      () => {
        dragSampleRef.current = null;
        handlePosition(latest);
      },
    );
  });
