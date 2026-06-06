import { useEffect, useRef } from "react";

/**
 * Attaches window-level mouse/touch listeners while `active` is true.
 * Callbacks are stored in refs so they always read the latest closure values
 * without requiring the effect to re-run.
 */
export function useDrag(
  active: boolean,
  onMove: (clientX: number) => void,
  onEnd: () => void,
) {
  const moveRef = useRef(onMove);
  const endRef = useRef(onEnd);
  moveRef.current = onMove;
  endRef.current = onEnd;

  useEffect(() => {
    if (!active) return;
    const move = (clientX: number) => moveRef.current(clientX);
    const end = () => endRef.current();
    const onMM = (e: MouseEvent) => move(e.clientX);
    const onTM = (e: TouchEvent) => { if (e.touches[0]) move(e.touches[0].clientX); };
    window.addEventListener("mousemove", onMM);
    window.addEventListener("mouseup", end);
    window.addEventListener("touchmove", onTM);
    window.addEventListener("touchend", end);
    return () => {
      window.removeEventListener("mousemove", onMM);
      window.removeEventListener("mouseup", end);
      window.removeEventListener("touchmove", onTM);
      window.removeEventListener("touchend", end);
    };
  }, [active]);
}
