import { useEffect, useMemo, type RefObject } from "react";
import {
  CLICK_SELECTION_THRESHOLD,
  MIN_RANGE_THRESHOLD,
} from "../../lib/constants";
import type { Section } from "../../lib/waveform";
import { clampSection } from "../../lib/util";
import type { TimelineState } from "./types";

const WHEEL_SETTLE_MS = 250;

const isControl = (target: EventTarget | null) =>
  target instanceof Element && !!target.closest("[data-timeline-control]");

type Pinch = {
  idA: number;
  idB: number;
  initialDist: number;
  initialRange: number;
  anchorSample: number;
  anchorFraction: number;
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

/**
 * Tap / pan / pinch / wheel on `elementRef`, measured against `measureRef`.
 * `onGestureStart` / `onGestureEnd` bracket real pans, pinches and wheel
 * bursts (never taps); wheel input "ends" after a short settle.
 */
export const useViewportGestures = (
  elementRef: RefObject<HTMLElement | null>,
  measureRef: RefObject<HTMLElement | null>,
  stateRef: RefObject<TimelineState>,
  totalSamples: number,
  handleRange: (range: Section) => void,
  onTap: (clientX: number, target: EventTarget | null) => void,
  onGestureStart: () => void,
  onGestureEnd: () => void,
) => {
  const minRangeLen = useMemo(
    () => Math.floor(MIN_RANGE_THRESHOLD * totalSamples),
    [totalSamples],
  );

  useEffect(() => {
    const el = elementRef.current;
    if (!el) return;
    const bounds = { start: 0, end: totalSamples };
    const rectOf = () => (measureRef.current ?? el).getBoundingClientRect();

    // Gesture bookkeeping: pointer gestures and wheel input share one
    // "active" flag so start/end fire exactly once per gesture.
    let active = false;
    let wheelTimer: ReturnType<typeof setTimeout> | null = null;
    const begin = () => {
      if (active) return;
      active = true;
      onGestureStart();
    };
    const end = () => {
      if (!active) return;
      active = false;
      onGestureEnd();
    };
    const touchWheel = () => {
      begin();
      if (wheelTimer) clearTimeout(wheelTimer);
      wheelTimer = setTimeout(() => {
        wheelTimer = null;
        end();
      }, WHEEL_SETTLE_MS);
    };

    const zoomAround = (
      currentRange: number,
      anchor: number,
      before: number,
      factor: number,
    ) => {
      const targetLen = Math.max(
        minRangeLen,
        Math.min(totalSamples, currentRange * factor),
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
      touchWheel();
      const rect = rectOf();
      const { viewport } = stateRef.current;
      const currentRange = viewport.end - viewport.start;
      const before = (e.clientX - rect.left) / rect.width;
      const anchor = viewport.start + before * currentRange;

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

    const onMouseDown = (e: MouseEvent) => {
      if (isControl(e.target)) return;
      e.preventDefault();
      const rect = rectOf();
      const { viewport } = stateRef.current;
      const currentRange = viewport.end - viewport.start;
      const startRangeStart = viewport.start;
      const threshold = rect.width * CLICK_SELECTION_THRESHOLD;
      let dragged = false;

      const onMouseMove = (m: MouseEvent) => {
        const netDx = m.clientX - e.clientX;
        if (!dragged && Math.abs(netDx) > threshold) {
          dragged = true;
          begin();
        }
        if (!dragged) return;
        const targetStart =
          startRangeStart - Math.round((netDx / rect.width) * currentRange);
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
        if (dragged) end();
        else onTap(e.clientX, e.target);
      };
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (isControl(e.target)) return;
      const first = e.touches[0];
      if (!first) return;
      e.preventDefault();

      const rect = rectOf();
      const { viewport } = stateRef.current;
      const startRangeStart = viewport.start;
      const startRange = viewport.end - viewport.start;

      let pinch: Pinch | null = null;
      let dragged = false;
      const threshold = rect.width * CLICK_SELECTION_THRESHOLD;
      const singleId = first.identifier;
      const startClientX = first.clientX;
      const startTarget = e.target;

      const enterPinch = (touches: TouchList) => {
        const a = findTouch(touches, singleId) ?? touches[0];
        const b = findOther(touches, a.identifier);
        if (!b) return;
        const dist = Math.abs(b.clientX - a.clientX);
        if (dist === 0) return;
        begin();
        const midFraction =
          ((a.clientX + b.clientX) / 2 - rect.left) / rect.width;
        pinch = {
          idA: a.identifier,
          idB: b.identifier,
          initialDist: dist,
          initialRange: startRange,
          anchorSample: startRangeStart + midFraction * startRange,
          anchorFraction: midFraction,
        };
      };

      const cleanup = () => {
        window.removeEventListener("touchmove", onMove);
        window.removeEventListener("touchend", onEnd);
        window.removeEventListener("touchcancel", cleanup);
      };

      const onMove = (moveEvent: TouchEvent) => {
        moveEvent.preventDefault();
        if (!pinch) {
          if (moveEvent.touches.length >= 2)
            return enterPinch(moveEvent.touches);
          const t = findTouch(moveEvent.touches, singleId);
          if (!t) return;
          const netDx = t.clientX - startClientX;
          if (!dragged && Math.abs(netDx) > threshold) {
            dragged = true;
            begin();
          }
          if (!dragged) return;
          const targetStart =
            startRangeStart - Math.round((netDx / rect.width) * startRange);
          handleRange(
            clampSection(
              { start: targetStart, end: targetStart + startRange },
              bounds,
            ),
          );
          return;
        }

        const a = findTouch(moveEvent.touches, pinch.idA);
        const b = findTouch(moveEvent.touches, pinch.idB);
        if (!a || !b) return;
        const dist = Math.abs(b.clientX - a.clientX);
        if (dist === 0) return;
        const targetLen = Math.max(
          minRangeLen,
          Math.min(totalSamples, pinch.initialRange * (pinch.initialDist / dist)),
        );
        const start = Math.floor(
          pinch.anchorSample - targetLen * pinch.anchorFraction,
        );
        handleRange(
          clampSection({ start, end: start + Math.floor(targetLen) }, bounds),
        );
      };

      const onEnd = (endEvent: TouchEvent) => {
        if (!pinch) {
          if (findTouch(endEvent.touches, singleId)) return;
          if (dragged) end();
          else onTap(startClientX, startTarget);
          cleanup();
          return;
        }
        if (
          findTouch(endEvent.touches, pinch.idA) &&
          findTouch(endEvent.touches, pinch.idB)
        )
          return;
        end();
        cleanup();
      };

      window.addEventListener("touchmove", onMove, { passive: false });
      window.addEventListener("touchend", onEnd);
      window.addEventListener("touchcancel", cleanup);
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("mousedown", onMouseDown);
    el.addEventListener("touchstart", onTouchStart, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("mousedown", onMouseDown);
      el.removeEventListener("touchstart", onTouchStart);
      if (wheelTimer) clearTimeout(wheelTimer);
    };
  }, [
    elementRef,
    measureRef,
    stateRef,
    totalSamples,
    handleRange,
    minRangeLen,
    onTap,
    onGestureStart,
    onGestureEnd,
  ]);
};
