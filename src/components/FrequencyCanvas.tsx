import { useContext, type FC, useRef, useEffect, useMemo } from "react";
import { PlaybackContext } from "../PlaybackContext";
import { type FrequencyBucket, groupFrequencies } from "../lib/frequency";

const QUARTER_STEP_RATIO = Math.pow(2, 1 / 24);

const computeFrequency = (pitchIndex: number) => {
  return 440 * Math.pow(2, (1 / 12) * (pitchIndex - 57));
};

const computeNoteName = (pitchIndex: number) => {
  const notes = [
    "c",
    "db",
    "d",
    "eb",
    "e",
    "f",
    "gb",
    "g",
    "ab",
    "a",
    "bb",
    "b",
  ];

  const octave = Math.floor(pitchIndex / 12);
  const noteIndex = pitchIndex % 12;
  return `${notes[noteIndex]}${octave}`;
};

export const FrequencyCanvas: FC = () => {
  const playbackContext = useContext(PlaybackContext);
  const frequencyDataRef = playbackContext?.frequencyData;
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const PITCH_BUCKETS = useMemo(() => {
    const buckets: FrequencyBucket[] = [];
    // C0 to C8 covers 9 octaves, 12 notes per octave = 108 notes
    // idx 0 is C0, idx 107 is B8
    for (let i = 0; i < 108; i++) {
      const freq = computeFrequency(i);
      const start = freq / QUARTER_STEP_RATIO;
      const end = freq * QUARTER_STEP_RATIO;
      buckets.push({ start, end });
    }
    return buckets;
  }, []);

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

    const pitchCtx = canvas.getContext("2d");
    if (!pitchCtx) return;

    let animationFrameId: number;

    const render = () => {
      pitchCtx.clearRect(0, 0, canvas.width, canvas.height);

      const frequencyData = frequencyDataRef?.current;

      if (frequencyData && frequencyData.length > 0) {
        const sampleRate = 44100;
        const groupedPitchData = groupFrequencies(
          frequencyData,
          sampleRate / 2,
          PITCH_BUCKETS
        );

        const pitchBarWidth = canvas.width / (PITCH_BUCKETS.length - 3);
        const fillStyle = `rgb(25 202 147)`;

        groupedPitchData.forEach((rawIntensity, idx) => {
          const intensity = Math.min(140, rawIntensity + 140);
          if (intensity > 10) {
            const base = (intensity * Math.pow(idx, 1 / 5)) / 2;
            const barHeight =
              Math.sqrt(Math.pow(base * base * base, base / 130)) / 2;

            pitchCtx.fillStyle = fillStyle;
            pitchCtx.fillRect(
              idx * pitchBarWidth,
              canvas.height - barHeight / 2,
              pitchBarWidth,
              barHeight / 2
            );

            pitchCtx.fillStyle = `${fillStyle.slice(0, -1)} / ${Math.pow(
              Math.max(0, barHeight - 10),
              2
            )}%)`;
            pitchCtx.font = "16px Arial";
            pitchCtx.fillText(
              `${computeNoteName(idx)}`,
              idx * pitchBarWidth - pitchBarWidth,
              canvas.height - barHeight / 2 - 2
            );
          }
        });
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", setCanvasDimensions);
    };
  }, [frequencyDataRef, PITCH_BUCKETS]);

  return (
    <canvas
      ref={canvasRef}
      className="border rounded-xs border-neutral-2 pixelated w-full h-32"
    ></canvas>
  );
};
