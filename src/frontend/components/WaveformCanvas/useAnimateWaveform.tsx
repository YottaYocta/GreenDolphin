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
    let animationFrameId: number;

    const updateWaveform = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const { range, section } = metadataRef.current;
      renderWaveform(
        {
          data: audioBuffer,
          range,
          section:
            section && Math.abs(section.end - section.start)
              ? {
                  start: Math.min(section.end, section.start),
                  end: Math.max(section.end, section.start),
                }
              : undefined,
        },
        { resolution: 10000 },
        canvas,
        positionReference && positionReference.current
          ? MStoSampleIndex(audioBuffer.sampleRate, positionReference.current)
          : undefined,
      );
    };

    const renderLoop = () => {
      updateWaveform();
      animationFrameId = requestAnimationFrame(renderLoop);
    };
    animationFrameId = requestAnimationFrame(renderLoop);

    const canvasElement = canvasRef.current;
    if (!canvasElement) return () => cancelAnimationFrame(animationFrameId);
    const handleResize = () => {
      canvasElement.width = canvasElement.clientWidth;
      canvasElement.height = canvasElement.clientHeight;
      updateWaveform();
    };
    window.addEventListener("resize", handleResize);
    handleResize();

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [canvasRef, audioBuffer, metadataRef, positionReference]);
};
