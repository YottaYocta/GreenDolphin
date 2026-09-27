import { useEffect, useRef, type RefObject } from "react";
import { renderWaveform } from "../../lib/waveform";
import { loopToSection, type TimelineState } from "../Timeline/types";

export const useAnimateWaveform = (
  audioBuffer: AudioBuffer,
  stateRef: RefObject<TimelineState>,
) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let rafId: number;
    let drawnKey = "";

    const draw = (force = false) => {
      const { viewport, loop } = stateRef.current;
      const key = `${viewport.start}|${viewport.end}|${loop.start}|${loop.end}`;
      if (!force && key === drawnKey) return;
      drawnKey = key;
      const selection = loopToSection(viewport, loop);
      renderWaveform(
        {
          data: audioBuffer,
          viewport,
          selection: selection.end > selection.start ? selection : undefined,
        },
        { resolution: 10000 },
        canvas,
      );
    };

    const loop = () => {
      draw();
      rafId = requestAnimationFrame(loop);
    };
    const onResize = () => {
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
      draw(true);
    };

    rafId = requestAnimationFrame(loop);
    const observer = new ResizeObserver(onResize);
    observer.observe(canvas);
    onResize();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(rafId);
    };
  }, [audioBuffer, stateRef]);
  return canvasRef;
};
