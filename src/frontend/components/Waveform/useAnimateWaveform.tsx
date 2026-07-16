import { useEffect, type RefObject } from "react";
import type { WaveformMetadata } from "./types";
import { renderWaveform } from "../../lib/waveform";
import { MStoSampleIndex } from "../../lib/util";

export const useAnimateWaveform = (
  canvasRef: RefObject<HTMLCanvasElement | null>,
  audioBuffer: AudioBuffer,
  metadataRef: RefObject<WaveformMetadata>,
  positionReference: RefObject<number> | undefined,
) => {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let rafId: number;

    const draw = () => {
      const { viewport, selection } = metadataRef.current;
      const hasSelection =
        selection && Math.abs(selection.end - selection.start) > 0;
      renderWaveform(
        {
          data: audioBuffer,
          viewport,
          selection: hasSelection
            ? {
                start: Math.min(selection.end, selection.start),
                end: Math.max(selection.end, selection.start),
              }
            : undefined,
        },
        { resolution: 10000 },
        canvas,
        positionReference?.current
          ? MStoSampleIndex(audioBuffer.sampleRate, positionReference.current)
          : undefined,
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
  }, [canvasRef, audioBuffer, metadataRef, positionReference]);
};
