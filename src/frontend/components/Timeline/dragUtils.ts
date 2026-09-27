import type {
  MouseEvent as ReactMouseEvent,
  TouchEvent as ReactTouchEvent,
} from "react";
import { clamp } from "../../lib/util";

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

/** Pointer x → fraction (0..1) of the element's width. */
export const pointerToFraction = (
  clientX: number,
  el: HTMLElement,
): number => {
  const rect = el.getBoundingClientRect();
  return clamp((clientX - rect.left) / rect.width, 0, 1);
};
