import { useEffect, type RefObject } from "react";
import { CLICK_SELECTION_THRESHOLD } from "../../lib/constants";
import { computeSampleIndex, type Section } from "../../lib/waveform";
import { clampSection } from "../../lib/util";
import type { WaveformMetadata } from "./types";

export const useMouseDown = (
  audioBuffer: AudioBuffer,
  metadata: WaveformMetadata,
  canvasRef: RefObject<HTMLCanvasElement | null>,
  handleRange: (range: Section) => void,
  handleSetPosition: (position: number) => void,
) => {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      const { range } = metadata;
      const currentRange = range.end - range.start;
      const startX = e.offsetX;
      const startRangeStart = range.start;
      const dragThresholdPx = canvas.width * CLICK_SELECTION_THRESHOLD;
      let isDragging = false;

      const onMouseMove = (moveEvent: MouseEvent) => {
        const netDx = moveEvent.clientX - e.clientX;
        if (!isDragging && Math.abs(netDx) > dragThresholdPx) {
          isDragging = true;
        }
        if (!isDragging) return;

        const sampleDelta = computeSampleIndex(netDx, currentRange, canvas);
        const targetStart = startRangeStart - sampleDelta;
        handleRange(
          clampSection(
            { start: targetStart, end: targetStart + currentRange },
            { start: 0, end: audioBuffer.length },
          ),
        );
      };

      const onMouseUp = () => {
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
        if (isDragging) return;
        const sampleOffset = computeSampleIndex(startX, currentRange, canvas);
        handleSetPosition(range.start + sampleOffset);
      };

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    };

    canvas.addEventListener("mousedown", onMouseDown);
    return () => {
      canvas.removeEventListener("mousedown", onMouseDown);
    };
  }, [audioBuffer, metadata, canvasRef, handleRange, handleSetPosition]);
};
