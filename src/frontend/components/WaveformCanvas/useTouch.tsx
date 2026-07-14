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

const findOther = (list: TouchList, excludeId: number): Touch | null => {
  for (let i = 0; i < list.length; i++) {
    if (list[i].identifier !== excludeId) return list[i];
  }
  return null;
};

export const useTouch = (
  audioBuffer: AudioBuffer,
  metadataRef: RefObject<WaveformMetadata>,
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
    const bounds = { start: 0, end: audioBuffer.length };
    const offsetXOf = (clientX: number) =>
      clientX - canvas.getBoundingClientRect().left;

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      const first = e.touches[0];
      if (!first) return;

      const { viewport } = metadataRef.current;
      const initialRangeStart = viewport.start;
      const initialRange = viewport.end - viewport.start;

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
        if (phase.kind !== "single") return;
        const first = findTouch(touches, phase.id) ?? touches[0];
        const second = findOther(touches, first.identifier);
        if (!second) return;
        const dist = Math.abs(second.clientX - first.clientX);
        if (dist === 0) return;
        const midpointX =
          (offsetXOf(first.clientX) + offsetXOf(second.clientX)) / 2;
        phase = {
          kind: "pinch",
          idA: first.identifier,
          idB: second.identifier,
          initialDist: dist,
          initialRange,
          anchorSample:
            initialRangeStart +
            computeSampleIndex(midpointX, initialRange, canvas),
          anchorX: midpointX,
        };
      };

      const cleanup = () => {
        window.removeEventListener("touchmove", onMove);
        window.removeEventListener("touchend", onEnd);
        window.removeEventListener("touchcancel", cleanup);
      };

      const onMove = (moveEvent: TouchEvent) => {
        moveEvent.preventDefault();
        if (phase.kind === "single") {
          if (moveEvent.touches.length >= 2) return enterPinch(moveEvent.touches);
          const t = findTouch(moveEvent.touches, phase.id);
          if (!t) return;
          const netDx = t.clientX - phase.startClientX;
          if (!dragged && Math.abs(netDx) > canvas.width * CLICK_SELECTION_THRESHOLD)
            dragged = true;
          if (!dragged) return;
          const targetStart =
            phase.startRangeStart -
            computeSampleIndex(netDx, phase.startRange, canvas);
          handleRange(
            clampSection(
              { start: targetStart, end: targetStart + phase.startRange },
              bounds,
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
        const start = Math.floor(
          phase.anchorSample - targetLen * (phase.anchorX / canvas.width),
        );
        handleRange(
          clampSection({ start, end: start + Math.floor(targetLen) }, bounds),
        );
      };

      const onEnd = (endEvent: TouchEvent) => {
        if (phase.kind === "single") {
          if (findTouch(endEvent.touches, phase.id)) return;
          if (!dragged) {
            handleSetPosition(
              phase.startRangeStart +
                computeSampleIndex(phase.startOffsetX, phase.startRange, canvas),
            );
          }
          cleanup();
          return;
        }
        if (
          findTouch(endEvent.touches, phase.idA) &&
          findTouch(endEvent.touches, phase.idB)
        )
          return;
        cleanup();
      };

      window.addEventListener("touchmove", onMove, { passive: false });
      window.addEventListener("touchend", onEnd);
      window.addEventListener("touchcancel", cleanup);
    };

    canvas.addEventListener("touchstart", onTouchStart, { passive: false });
    return () => canvas.removeEventListener("touchstart", onTouchStart);
  }, [
    audioBuffer,
    metadataRef,
    canvasRef,
    handleRange,
    handleSetPosition,
    minRangeLen,
  ]);
};
