import type {
  MouseEvent as ReactMouseEvent,
  TouchEvent as ReactTouchEvent,
} from "react";
import type { Section } from "../../../lib/waveform";

export const beginDrag = (
  onMove: (clientX: number) => void,
  onFinish?: () => void,
) => {
  const finish = () => {
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
    window.removeEventListener("touchmove", onTouchMove);
    window.removeEventListener("touchend", onTouchEnd);
    window.removeEventListener("touchcancel", onTouchEnd);
    onFinish?.();
  };
  const onMouseMove = (event: MouseEvent) => onMove(event.clientX);
  const onMouseUp = () => finish();
  const onTouchMove = (event: TouchEvent) => {
    if (event.touches[0]) onMove(event.touches[0].clientX);
  };
  const onTouchEnd = () => finish();
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);
  window.addEventListener("touchmove", onTouchMove, { passive: false });
  window.addEventListener("touchend", onTouchEnd);
  window.addEventListener("touchcancel", onTouchEnd);
};

export const dragHandlers = (begin: (clientX: number) => void) => ({
  onMouseDown: (e: ReactMouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    begin(e.clientX);
  },
  onTouchStart: (e: ReactTouchEvent) => {
    if (!e.touches[0]) return;
    e.stopPropagation();
    begin(e.touches[0].clientX);
  },
});

export const pointerToSample = (
  clientX: number,
  trackEl: HTMLElement,
  range: Section,
): number => {
  const rect = trackEl.getBoundingClientRect();
  const rangeLen = range.end - range.start;
  return (
    range.start + Math.round(((clientX - rect.left) / rect.width) * rangeLen)
  );
};

export const clampSample = (sample: number, totalSamples: number): number =>
  Math.max(0, Math.min(totalSamples, sample));
