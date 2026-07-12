import { useCallback, useEffect, type RefObject } from "react";
import type { WaveformMetadata } from "./types";
import { renderWaveform } from "../../lib/waveform";
import { MStoSampleIndex } from "../../lib/util";

export const useAnimateWaveform = (
  canvasRef: RefObject<HTMLCanvasElement | null>,
  audioBuffer: AudioBuffer,
  waveformMetadata: WaveformMetadata,
  positionReference: RefObject<number> | undefined,
) => {
  const updateWaveform = useCallback(() => {
    if (canvasRef.current) {
      const sr = waveformMetadata.section;
      renderWaveform(
        {
          data: audioBuffer,
          range: waveformMetadata.range,
          section:
            sr && Math.abs(sr.end - sr.start)
              ? {
                  start: Math.min(sr.end, sr.start),
                  end: Math.max(sr.end, sr.start),
                }
              : undefined,
        },
        { resolution: 10000 },
        canvasRef.current,
        positionReference && positionReference.current
          ? MStoSampleIndex(audioBuffer.sampleRate, positionReference.current)
          : undefined,
      );
    }
  }, [
    canvasRef,
    waveformMetadata.section,
    waveformMetadata.range,
    audioBuffer,
    positionReference,
  ]);

  useEffect(() => {
    let animationFrameId: number;

    const renderLoop = () => {
      if (canvasRef.current) updateWaveform();
      animationFrameId = requestAnimationFrame(renderLoop);
    };

    animationFrameId = requestAnimationFrame(renderLoop);

    const canvasElement = canvasRef.current;
    if (!canvasElement) return;
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
  }, [canvasRef, updateWaveform]);
};
