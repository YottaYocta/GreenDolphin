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
      const { range, section } = metadataRef.current;
      const hasSection = section && Math.abs(section.end - section.start) > 0;
      renderWaveform(
        {
          data: audioBuffer,
          range,
          section: hasSection
            ? {
                start: Math.min(section.end, section.start),
                end: Math.max(section.end, section.start),
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
    window.addEventListener("resize", onResize);
    onResize();
    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(rafId);
    };
  }, [canvasRef, audioBuffer, metadataRef, positionReference]);
};
