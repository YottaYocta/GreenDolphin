import { useEffect, useMemo, type RefObject } from "react";
import {
  CLICK_SELECTION_THRESHOLD,
  MIN_RANGE_THRESHOLD,
} from "../../lib/constants";
import { computeSampleIndex, type Section } from "../../lib/waveform";
import { clampSection } from "../../lib/util";
import type { WaveformMetadata } from "./types";

type Phase =
  | {
      kind: "single";
      id: number;
      startOffsetX: number;
      startClientX: number;
      startRangeStart: number;
      startRange: number;
    }
  | {
      kind: "pinch";
      idA: number;
      idB: number;
      initialDist: number;
      initialRange: number;
      anchorSample: number;
      anchorX: number;
    };

const findTouch = (list: TouchList, id: number): Touch | null => {
  for (let i = 0; i < list.length; i++) {
    if (list[i].identifier === id) return list[i];
  }
  return null;
};

export const useTouch = (
  audioBuffer: AudioBuffer,
  metadata: WaveformMetadata,
  canvasRef: RefObject<HTMLCanvasElement | null>,
  handleRange: (range: Section) => void,
  handleSetPosition: (position: number) => void,
) => {
  const minRangeLen = useMemo(
    () => Math.floor(MIN_RANGE_THRESHOLD * audioBuffer.length),
    [audioBuffer.length],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const offsetXOf = (clientX: number) =>
      clientX - canvas.getBoundingClientRect().left;

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length === 0) return;

      const { range } = metadata;
      const first = e.touches[0];
      const initialRangeStart = range.start;
      const initialRange = range.end - range.start;

      let phase: Phase = {
        kind: "single",
        id: first.identifier,
        startOffsetX: offsetXOf(first.clientX),
        startClientX: first.clientX,
        startRangeStart: initialRangeStart,
        startRange: initialRange,
      };
      let dragged = false;

      const enterPinch = (touches: TouchList) => {
        const a = findTouch(touches, (phase as { id: number }).id) ?? touches[0];
        let b: Touch | null = null;
        for (let i = 0; i < touches.length; i++) {
          if (touches[i].identifier !== a.identifier) {
            b = touches[i];
            break;
          }
        }
        if (!b) return;
        const dist = Math.abs(b.clientX - a.clientX);
        if (dist === 0) return;
        const midpointX = (offsetXOf(a.clientX) + offsetXOf(b.clientX)) / 2;
        const anchorSample =
          initialRangeStart +
          computeSampleIndex(midpointX, initialRange, canvas);
        phase = {
          kind: "pinch",
          idA: a.identifier,
          idB: b.identifier,
          initialDist: dist,
          initialRange,
          anchorSample,
          anchorX: midpointX,
        };
      };

      const cleanup = () => {
        window.removeEventListener("touchmove", onMove);
        window.removeEventListener("touchend", onEnd);
        window.removeEventListener("touchcancel", onCancel);
      };

      const onMove = (moveEvent: TouchEvent) => {
        moveEvent.preventDefault();

        if (phase.kind === "single") {
          if (moveEvent.touches.length >= 2) {
            enterPinch(moveEvent.touches);
            return;
          }
          const t = findTouch(moveEvent.touches, phase.id);
          if (!t) return;
          const dragThresholdPx = canvas.width * CLICK_SELECTION_THRESHOLD;
          const netDx = t.clientX - phase.startClientX;
          if (!dragged && Math.abs(netDx) > dragThresholdPx) dragged = true;
          if (!dragged) return;
          const sampleDelta = computeSampleIndex(
            netDx,
            phase.startRange,
            canvas,
          );
          const targetStart = phase.startRangeStart - sampleDelta;
          handleRange(
            clampSection(
              { start: targetStart, end: targetStart + phase.startRange },
              { start: 0, end: audioBuffer.length },
            ),
          );
          return;
        }

        const a = findTouch(moveEvent.touches, phase.idA);
        const b = findTouch(moveEvent.touches, phase.idB);
        if (!a || !b) return;
        const dist = Math.abs(b.clientX - a.clientX);
        if (dist === 0) return;

        const targetLen = Math.max(
          minRangeLen,
          Math.min(
            audioBuffer.length,
            phase.initialRange * (phase.initialDist / dist),
          ),
        );
        const before = phase.anchorX / canvas.width;
        const start = Math.floor(phase.anchorSample - targetLen * before);
        handleRange(
          clampSection(
            { start, end: start + Math.floor(targetLen) },
            { start: 0, end: audioBuffer.length },
          ),
        );
      };

      const onEnd = (endEvent: TouchEvent) => {
        if (phase.kind === "single") {
          if (findTouch(endEvent.touches, phase.id)) return;
          if (!dragged) {
            const sampleOffset = computeSampleIndex(
              phase.startOffsetX,
              phase.startRange,
              canvas,
            );
            handleSetPosition(phase.startRangeStart + sampleOffset);
          }
          cleanup();
          return;
        }
        const aDown = findTouch(endEvent.touches, phase.idA);
        const bDown = findTouch(endEvent.touches, phase.idB);
        if (aDown && bDown) return;
        cleanup();
      };

      const onCancel = () => cleanup();

      window.addEventListener("touchmove", onMove, { passive: false });
      window.addEventListener("touchend", onEnd);
      window.addEventListener("touchcancel", onCancel);
    };

    canvas.addEventListener("touchstart", onTouchStart, { passive: false });
    return () => {
      canvas.removeEventListener("touchstart", onTouchStart);
    };
  }, [
    audioBuffer,
    metadata,
    canvasRef,
    handleRange,
    handleSetPosition,
    minRangeLen,
  ]);
};
