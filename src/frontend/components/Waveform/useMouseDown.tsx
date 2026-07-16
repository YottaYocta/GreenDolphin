import { useEffect, type RefObject } from "react";
import { CLICK_SELECTION_THRESHOLD } from "../../lib/constants";
import { computeSampleIndex, type Section } from "../../lib/waveform";
import { clampSection } from "../../lib/util";
import type { WaveformMetadata } from "./types";

export const useMouseDown = (
  audioBuffer: AudioBuffer,
  metadataRef: RefObject<WaveformMetadata>,
  canvasRef: RefObject<HTMLCanvasElement | null>,
  handleRange: (range: Section) => void,
  handleSetPosition: (position: number) => void,
) => {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const bounds = { start: 0, end: audioBuffer.length };

    const onMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      const { viewport } = metadataRef.current;
      const currentRange = viewport.end - viewport.start;
      const startX = e.offsetX;
      const startRangeStart = viewport.start;
      const threshold = canvas.width * CLICK_SELECTION_THRESHOLD;
      let dragging = false;

      const onMouseMove = (moveEvent: MouseEvent) => {
        const netDx = moveEvent.clientX - e.clientX;
        if (!dragging && Math.abs(netDx) > threshold) dragging = true;
        if (!dragging) return;
        const targetStart =
          startRangeStart - computeSampleIndex(netDx, currentRange, canvas);
        handleRange(
          clampSection(
            { start: targetStart, end: targetStart + currentRange },
            bounds,
          ),
        );
      };
      const onMouseUp = () => {
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
        if (dragging) return;
        handleSetPosition(
          viewport.start + computeSampleIndex(startX, currentRange, canvas),
        );
      };
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    };

    canvas.addEventListener("mousedown", onMouseDown);
    return () => canvas.removeEventListener("mousedown", onMouseDown);
  }, [audioBuffer, metadataRef, canvasRef, handleRange, handleSetPosition]);
};
