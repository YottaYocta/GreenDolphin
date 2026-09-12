import { useEffect, type RefObject } from "react";
import { computeMS } from "../../../lib/util";
import type { WaveformMetadata } from "../types";

// How far past the track edges elements keep rendering before being dropped;
// covers the fade bleed zone plus a little slack.
const EDGE_BUFFER_PX = 24;
const LABEL_HIDE_DELAY_MS = 800;

export type TrackbarRefs = {
  trackRef: RefObject<HTMLDivElement | null>;
  pillRef: RefObject<HTMLDivElement | null>;
  leftHandleRef: RefObject<HTMLDivElement | null>;
  rightHandleRef: RefObject<HTMLDivElement | null>;
  playheadRef: RefObject<HTMLDivElement | null>;
  startLabelRef: RefObject<HTMLDivElement | null>;
  endLabelRef: RefObject<HTMLDivElement | null>;
};

export const useAnimateTrackbar = (
  refs: TrackbarRefs,
  metadata: RefObject<WaveformMetadata>,
  positionMS: RefObject<number> | undefined,
  sampleRate: number,
) => {
  const {
    trackRef,
    pillRef,
    leftHandleRef,
    rightHandleRef,
    playheadRef,
    startLabelRef,
    endLabelRef,
  } = refs;

  useEffect(() => {
    let rafId: number | null = null;
    let lastViewportStart = NaN;
    let lastViewportEnd = NaN;
    let lastViewportChangeAt = -Infinity;

    const applyOverflowing = (
      el: HTMLDivElement | null,
      px: number,
      width: number,
    ) => {
      if (!el) return;
      el.style.display =
        px < -EDGE_BUFFER_PX || px > width + EDGE_BUFFER_PX ? "none" : "";
      el.style.left = `${px}px`;
    };

    const render = () => {
      const track = trackRef.current;
      if (track) {
        const width = track.clientWidth;
        const { viewport, selection } = metadata.current;
        const rangeLen = viewport.end - viewport.start;
        const startPx = ((selection.start - viewport.start) / rangeLen) * width;
        const endPx = ((selection.end - viewport.start) / rangeLen) * width;

        if (pillRef.current) {
          // bound the overflow so extreme zooms don't create huge paint areas
          const pillStart = Math.max(-EDGE_BUFFER_PX * 2, startPx);
          const pillEnd = Math.min(width + EDGE_BUFFER_PX * 2, endPx);
          pillRef.current.style.left = `${pillStart}px`;
          pillRef.current.style.width = `${Math.max(0, pillEnd - pillStart)}px`;
        }
        applyOverflowing(leftHandleRef.current, startPx, width);
        applyOverflowing(rightHandleRef.current, endPx, width);

        if (playheadRef.current && positionMS) {
          const relativePositionMS =
            positionMS.current - computeMS(sampleRate, viewport.start);
          const relativeDurationMS = computeMS(sampleRate, rangeLen);
          applyOverflowing(
            playheadRef.current,
            width * (relativePositionMS / relativeDurationMS),
            width,
          );
        }

        // transient viewport-range labels while zooming/panning
        const now = performance.now();
        if (
          viewport.start !== lastViewportStart ||
          viewport.end !== lastViewportEnd
        ) {
          if (!Number.isNaN(lastViewportStart)) lastViewportChangeAt = now;
          lastViewportStart = viewport.start;
          lastViewportEnd = viewport.end;
          if (startLabelRef.current)
            startLabelRef.current.textContent = `${(viewport.start / sampleRate).toFixed(1)}s`;
          if (endLabelRef.current)
            endLabelRef.current.textContent = `${(viewport.end / sampleRate).toFixed(1)}s`;
        }
        const labelOpacity =
          now - lastViewportChangeAt < LABEL_HIDE_DELAY_MS ? "1" : "0";
        if (startLabelRef.current)
          startLabelRef.current.style.opacity = labelOpacity;
        if (endLabelRef.current)
          endLabelRef.current.style.opacity = labelOpacity;
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
    startLabelRef,
    endLabelRef,
    metadata,
    positionMS,
    sampleRate,
  ]);
};
