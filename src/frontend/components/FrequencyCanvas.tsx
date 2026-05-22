import { useContext, type FC, useRef, useEffect } from "react";
import { PlaybackContext } from "../PlaybackContext";
import {
  drawFrequencyPiano,
  groupFrequencies,
  PITCH_BUCKETS,
} from "../lib/frequency";

export const FrequencyCanvas: FC = () => {
  const playbackContext = useContext(PlaybackContext);
  const frequencyDataRef = playbackContext?.frequencyData;
  const audioContext = playbackContext?.audioContext ?? null;
  const analyserNode = playbackContext?.analyserNode ?? null;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeKeyRef = useRef<number | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const isDraggingRef = useRef(false);

  const stopTone = () => {
    oscillatorRef.current?.stop();
    oscillatorRef.current = null;
    activeKeyRef.current = null;
  };

  const startTone = (index: number) => {
    if (!audioContext || !analyserNode) return;
    stopTone();
    const osc = audioContext.createOscillator();
    osc.type = "sine";
    const bucket = PITCH_BUCKETS[index];
    osc.frequency.value = (bucket.start + bucket.end) / 2;
    osc.connect(analyserNode);
    osc.start();
    oscillatorRef.current = osc;
    activeKeyRef.current = index;
  };

  const getKeyIndex = (clientX: number, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    return Math.floor((x / rect.width) * PITCH_BUCKETS.length);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const setCanvasDimensions = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };

    setCanvasDimensions();
    window.addEventListener("resize", setCanvasDimensions);

    const handleMouseDown = (e: MouseEvent) => {
      isDraggingRef.current = true;
      const idx = getKeyIndex(e.clientX, canvas);
      if (idx >= 0 && idx < PITCH_BUCKETS.length) startTone(idx);
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const idx = getKeyIndex(e.clientX, canvas);
      if (idx >= 0 && idx < PITCH_BUCKETS.length && idx !== activeKeyRef.current)
        startTone(idx);
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      stopTone();
    };

    const handleMouseLeave = () => {
      isDraggingRef.current = false;
      stopTone();
    };

    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      isDraggingRef.current = true;
      const idx = getKeyIndex(e.touches[0].clientX, canvas);
      if (idx >= 0 && idx < PITCH_BUCKETS.length) startTone(idx);
    };

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const idx = getKeyIndex(e.touches[0].clientX, canvas);
      if (idx >= 0 && idx < PITCH_BUCKETS.length && idx !== activeKeyRef.current)
        startTone(idx);
    };

    const handleTouchEnd = () => {
      isDraggingRef.current = false;
      stopTone();
    };

    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseup", handleMouseUp);
    canvas.addEventListener("mouseleave", handleMouseLeave);
    canvas.addEventListener("touchstart", handleTouchStart, { passive: false });
    canvas.addEventListener("touchmove", handleTouchMove, { passive: false });
    canvas.addEventListener("touchend", handleTouchEnd);
    canvas.addEventListener("touchcancel", handleTouchEnd);

    let animationFrameId: number;

    const render = () => {
      const frequencyData = frequencyDataRef?.current;

      if (frequencyData && frequencyData.length > 0) {
        const sampleRate = audioContext?.sampleRate ?? 44100;
        const groupedPitchData = groupFrequencies(
          frequencyData,
          sampleRate / 2,
          PITCH_BUCKETS
        );
        drawFrequencyPiano(groupedPitchData, canvas, activeKeyRef.current);
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", setCanvasDimensions);
      canvas.removeEventListener("mousedown", handleMouseDown);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseup", handleMouseUp);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
      canvas.removeEventListener("touchstart", handleTouchStart);
      canvas.removeEventListener("touchmove", handleTouchMove);
      canvas.removeEventListener("touchend", handleTouchEnd);
      canvas.removeEventListener("touchcancel", handleTouchEnd);
      stopTone();
    };
  }, [frequencyDataRef, audioContext, analyserNode]);

  return (
    <div className="border rounded-xs border-neutral-2 pixelated w-full overflow-x-auto min-h-28 flex justify-center items-center">
      <canvas
        ref={canvasRef}
        className="w-[600px] h-24"
        draggable="false"
      ></canvas>
    </div>
  );
};
