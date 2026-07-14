import { useEffect, useMemo, type RefObject } from "react";
import { MIN_RANGE_THRESHOLD } from "../../lib/constants";
import { computeSampleIndex, type Section } from "../../lib/waveform";
import type { WaveformMetadata } from "./types";
import { clampSection } from "../../lib/util";

export const useWheel = (
  audioBuffer: AudioBuffer,
  metadataRef: RefObject<WaveformMetadata>,
  canvasRef: RefObject<HTMLCanvasElement | null>,
  handleRange: (range: Section) => void,
) => {
  const minRangeLen = useMemo(
    () => Math.floor(MIN_RANGE_THRESHOLD * audioBuffer.length),
    [audioBuffer.length],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const bounds = { start: 0, end: audioBuffer.length };

    const zoomAround = (
      currentRange: number,
      anchor: number,
      before: number,
      factor: number,
    ) => {
      const targetLen = Math.max(
        minRangeLen,
        Math.min(audioBuffer.length, currentRange * factor),
      );
      handleRange(
        clampSection(
          {
            start: Math.floor(anchor - targetLen * before),
            end: Math.floor(anchor + targetLen * (1 - before)),
          },
          bounds,
        ),
      );
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const { viewport } = metadataRef.current;
      const currentRange = viewport.end - viewport.start;
      const sampleOffset = computeSampleIndex(e.offsetX, currentRange, canvas);
      const anchor = sampleOffset + viewport.start;
      const before = sampleOffset / currentRange;

      if (e.ctrlKey) {
        zoomAround(currentRange, anchor, before, 1 + e.deltaY / 100);
      } else if (
        (Math.abs(e.deltaX) + 0.001) / (Math.abs(e.deltaY) + 0.001) >
        0.5
      ) {
        const targetStart = viewport.start + e.deltaX * (currentRange / 400);
        handleRange(
          clampSection(
            { start: targetStart, end: targetStart + currentRange },
            bounds,
          ),
        );
      } else {
        zoomAround(currentRange, anchor, before, 1 - e.deltaY / 1000);
      }
    };

    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [handleRange, metadataRef, minRangeLen, audioBuffer, canvasRef]);
};
