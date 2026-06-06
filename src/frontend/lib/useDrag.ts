import { useCallback, useEffect, useRef } from "react";

export interface DragMoveEvent {
  clientX: number;
  startX: number;
  dx: number;
  totalDx: number;
}

export function useDrag(
  onMove: (e: DragMoveEvent) => void,
  onEnd?: () => void,
): [startDrag: (startX: number) => void, endDrag: () => void] {
  const moveRef = useRef(onMove);
  const endRef = useRef(onEnd);
  moveRef.current = onMove;
  endRef.current = onEnd;

  const activeRef = useRef(false);
  const startXRef = useRef(0);
  const prevXRef = useRef(0);
  const cleanupRef = useRef<(() => void) | null>(null);

  const endDrag = useCallback(() => {
    if (!activeRef.current) return;
    activeRef.current = false;
    cleanupRef.current?.();
    cleanupRef.current = null;
    endRef.current?.();
  }, []);

  const startDrag = useCallback((startX: number) => {
    if (activeRef.current) return;
    activeRef.current = true;
    startXRef.current = startX;
    prevXRef.current = startX;

    const fire = (clientX: number) => {
      const dx = clientX - prevXRef.current;
      const totalDx = clientX - startXRef.current;
      prevXRef.current = clientX;
      moveRef.current({ clientX, startX: startXRef.current, dx, totalDx });
    };

    const onMM = (e: MouseEvent) => fire(e.clientX);
    const onTM = (e: TouchEvent) => { if (e.touches[0]) fire(e.touches[0].clientX); };

    window.addEventListener("mousemove", onMM);
    window.addEventListener("touchmove", onTM);

    cleanupRef.current = () => {
      window.removeEventListener("mousemove", onMM);
      window.removeEventListener("touchmove", onTM);
    };
  }, [endDrag]);

  useEffect(() => () => { cleanupRef.current?.(); }, []);

  return [startDrag, endDrag];
}
