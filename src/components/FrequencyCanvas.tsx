import { useContext, type FC, useRef, useEffect } from "react";
import { PlaybackContext } from "../PlaybackContext";
import {
  drawFrequencyNoteBars,
  groupFrequencies,
  PITCH_BUCKETS,
} from "../lib/frequency";

export const FrequencyCanvas: FC = () => {
  const playbackContext = useContext(PlaybackContext);
  const frequencyDataRef = playbackContext?.frequencyData;
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const setCanvasDimensions = () => {
      // Set canvas drawing buffer size to match its display size
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };

    setCanvasDimensions(); // Set initial dimensions
    window.addEventListener("resize", setCanvasDimensions);

    let animationFrameId: number;

    const render = () => {
      const frequencyData = frequencyDataRef?.current;

      if (frequencyData && frequencyData.length > 0) {
        const sampleRate = 44100;
        const groupedPitchData = groupFrequencies(
          frequencyData,
          sampleRate / 2,
          PITCH_BUCKETS
        );
        drawFrequencyNoteBars(groupedPitchData, canvas);
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", setCanvasDimensions);
    };
  }, [frequencyDataRef]);

  return (
    <canvas
      ref={canvasRef}
      className="border rounded-xs border-neutral-2 pixelated w-full h-32"
    ></canvas>
  );
};
