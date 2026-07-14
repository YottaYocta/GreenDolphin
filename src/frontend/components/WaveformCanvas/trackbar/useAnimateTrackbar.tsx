import { useEffect, type RefObject } from "react";
import { computeMS } from "../../../lib/util";
import type { WaveformMetadata } from "../types";

export type TrackbarRefs = {
  trackRef: RefObject<HTMLDivElement | null>;
  pillRef: RefObject<HTMLDivElement | null>;
  leftHandleRef: RefObject<HTMLDivElement | null>;
  rightHandleRef: RefObject<HTMLDivElement | null>;
  playheadRef: RefObject<HTMLDivElement | null>;
};

export const useAnimateTrackbar = (
  refs: TrackbarRefs,
  metadata: RefObject<WaveformMetadata>,
  positionMS: RefObject<number> | undefined,
  sampleRate: number,
  applyCaretVisibility: (startPct: number, endPct: number) => void,
) => {
  const { trackRef, pillRef, leftHandleRef, rightHandleRef, playheadRef } =
    refs;

  useEffect(() => {
    let rafId: number | null = null;

    const applyHandle = (el: HTMLDivElement | null, pct: number) => {
      if (!el) return;
      const inView = pct >= 0 && pct <= 100;
      el.style.display = inView ? "block" : "none";
      el.style.left = `${pct}%`;
    };

    const render = () => {
      const track = trackRef.current;
      if (track) {
        const width = track.clientWidth;
        const { range, section } = metadata.current;
        const rangeLen = range.end - range.start;
        const startPct = ((section.start - range.start) / rangeLen) * 100;
        const endPct = ((section.end - range.start) / rangeLen) * 100;
        const clampedStart = Math.max(0, Math.min(100, startPct));
        const clampedEnd = Math.max(0, Math.min(100, endPct));

        if (pillRef.current) {
          pillRef.current.style.left = `${clampedStart}%`;
          pillRef.current.style.width = `${Math.max(0, clampedEnd - clampedStart)}%`;
        }
        applyHandle(leftHandleRef.current, startPct);
        applyHandle(rightHandleRef.current, endPct);
        applyCaretVisibility(startPct, endPct);

        if (playheadRef.current && positionMS) {
          const relativePositionMS =
            positionMS.current - computeMS(sampleRate, range.start);
          const relativeDurationMS = computeMS(sampleRate, rangeLen);
          playheadRef.current.style.left = `${
            width * (relativePositionMS / relativeDurationMS)
          }px`;
        }
      }
      rafId = requestAnimationFrame(render);
    };
    render();
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [
    trackRef,
    pillRef,
    leftHandleRef,
    rightHandleRef,
    playheadRef,
    metadata,
    positionMS,
    sampleRate,
    applyCaretVisibility,
  ]);
};
