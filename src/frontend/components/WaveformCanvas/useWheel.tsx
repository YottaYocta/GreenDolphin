import { useEffect, useMemo, type RefObject } from "react";
import { MIN_RANGE_THRESHOLD } from "../../lib/constants";
import { computeSampleIndex, type Section } from "../../lib/waveform";
import type { WaveformMetadata } from "./types";
import { clampSection } from "../../lib/util";

export const useWheel = (
  audioBuffer: AudioBuffer,
  metadata: WaveformMetadata,
  canvasRef: RefObject<HTMLCanvasElement | null>,
  handleRange: (range: Section) => void,
) => {
  const minRangeThresholdValue = useMemo(() => {
    const value = Math.floor(MIN_RANGE_THRESHOLD * audioBuffer.length);
    return value;
  }, [audioBuffer.length]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!handleRange) return;
      const { range } = metadata;
      const data = audioBuffer;
      const currentRange = range.end - range.start;
      const sampleOffset = computeSampleIndex(e.offsetX, currentRange, canvas);
      const anchor = sampleOffset + range.start;
      const before = sampleOffset / currentRange;

      if (e.ctrlKey) {
        const targetLen = Math.max(
          minRangeThresholdValue,
          Math.min(data.length, currentRange * (1 + e.deltaY / 100)),
        );
        handleRange(
          clampSection(
            {
              start: Math.floor(anchor - targetLen * before),
              end: Math.floor(anchor + targetLen * (1 - before)),
            },
            { start: 0, end: data.length },
          ),
        );
      } else if (
        (Math.abs(e.deltaX) + 0.001) / (Math.abs(e.deltaY) + 0.001) >
        0.5
      ) {
        const targetStart = range.start + e.deltaX * (currentRange / 400);
        handleRange(
          clampSection(
            { start: targetStart, end: targetStart + currentRange },
            { start: 0, end: data.length },
          ),
        );
      } else {
        const targetLen = Math.max(
          minRangeThresholdValue,
          Math.min(data.length, currentRange * (1 + -e.deltaY / 1000)),
        );
        handleRange(
          clampSection(
            {
              start: Math.floor(anchor - targetLen * before),
              end: Math.floor(anchor + targetLen * (1 - before)),
            },
            { start: 0, end: data.length },
          ),
        );
      }
    };

    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [handleRange, metadata, minRangeThresholdValue, audioBuffer, canvasRef]);
};
