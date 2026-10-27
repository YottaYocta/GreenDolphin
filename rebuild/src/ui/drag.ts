import type { PointerEvent as ReactPointerEvent } from "react";

/**
 * Follows one pointer from pointerdown until release, via pointer capture so it
 * keeps tracking outside the element. Nothing fires until it moves `threshold` px.
 */
export function drag(
  e: ReactPointerEvent<HTMLElement>,
  onMove: (clientX: number, dx: number) => void,
  onEnd?: (moved: boolean) => void,
  threshold = 0,
) {
  if (!e.isPrimary) return;
  e.preventDefault();
  const el = e.currentTarget;
  const { pointerId, clientX: startX } = e;
  el.setPointerCapture(pointerId);
  let moved = threshold === 0;
  const move = (ev: PointerEvent) => {
    if (ev.pointerId !== pointerId) return;
    if (!moved && Math.abs(ev.clientX - startX) <= threshold) return;
    moved = true;
    onMove(ev.clientX, ev.clientX - startX);
  };
  const end = (ev: PointerEvent) => {
    if (ev.pointerId !== pointerId) return;
    el.removeEventListener("pointermove", move);
    el.removeEventListener("pointerup", end);
    el.removeEventListener("pointercancel", end);
    onEnd?.(moved);
  };
  el.addEventListener("pointermove", move);
  el.addEventListener("pointerup", end);
  el.addEventListener("pointercancel", end);
}
