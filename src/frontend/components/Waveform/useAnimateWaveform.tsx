import { useEffect, type RefObject } from "react";
import { renderWaveform } from "../../lib/waveform";
import { loopToSection, type TimelineState } from "../Timeline/types";

export const useAnimateWaveform = (
  canvasRef: RefObject<HTMLCanvasElement | null>,
  audioBuffer: AudioBuffer,
  stateRef: RefObject<TimelineState>,
) => {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let rafId: number;

    const draw = () => {
      const { viewport, loop } = stateRef.current;
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
      draw();
    };

    rafId = requestAnimationFrame(loop);
    const observer = new ResizeObserver(onResize);
    observer.observe(canvas);
    onResize();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(rafId);
    };
  }, [canvasRef, audioBuffer, stateRef]);
};
