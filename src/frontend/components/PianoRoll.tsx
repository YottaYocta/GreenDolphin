import { useCallback, useContext, useEffect, useRef } from "react";
import { PlaybackContext } from "../playback/PlaybackContext";
import { groupFrequencies, PITCH_BUCKETS } from "../lib/frequency";

const START_SEMITONE = 24;
const OCTAVE_COUNT = 7;
const TOTAL_SEMITONES = OCTAVE_COUNT * 12;
const PIANO_WIDTH_PX = OCTAVE_COUNT * 101;
const BAR_AREA_H_PX = 56;

function amplitudeToHeight(v: number, bucketIdx: number): number {
  const intensity = Math.min(140, v + 140);
  if (intensity <= 10) return 0;
  const base = (intensity * Math.pow(bucketIdx, 0.2)) / 2;
  return Math.min(
    Math.sqrt(Math.pow(base * base * base, base / 130)) / 5,
    BAR_AREA_H_PX,
  );
}

const WHITE_BASE =
  "overflow-clip shrink-0 [box-shadow:#0000001A_0px_2px_3px] border border-solid cursor-pointer select-none";
const WHITE_NORMAL = `${WHITE_BASE} bg-[#FBFBFB] border-[#0000001A] hover:bg-[#F0F0F0] active:bg-[#E8E8E8]`;
const WHITE_C = `${WHITE_BASE} bg-[#E6E6E6] border-[#00000033] hover:bg-[#D8D8D8] active:bg-[#CACACA]`;
const BLACK_BASE =
  "overflow-clip self-stretch shrink-0 [box-shadow:#FFFFFF33_0px_0px_3px_inset] border border-solid cursor-pointer select-none";
const BLACK_NORMAL = `${BLACK_BASE} w-2.5 bg-[#787878] border-[#00000080] hover:bg-[#686868] active:bg-[#585858]`;

type KeyHandler = (bucketIndex: number) => void;

interface GroupProps {
  startBucket: number;
  onDown: KeyHandler;
  onEnter: KeyHandler;
}

const CDE_WHITE = [0, 2, 4] as const;
const CDE_BLACK = [1, 3] as const;
const FGAB_WHITE = [5, 7, 9, 11] as const;
const FGAB_BLACK = [6, 8, 10] as const;

function CdeGroup({ startBucket, onDown, onEnter }: GroupProps) {
  return (
    <div className="w-10.75 h-15 relative shrink-0">
      <div className="flex items-start h-8.75 left-0 top-2 absolute">
        {CDE_WHITE.map((offset, i) => (
          <div
            key={offset}
            data-bucket={startBucket + offset}
            className={`${i === 0 ? WHITE_C : WHITE_NORMAL} ${i === 2 ? "w-3.75 self-stretch" : "w-3.5 h-8.75"}`}
            onMouseDown={() => onDown(startBucket + offset)}
            onMouseEnter={() => onEnter(startBucket + offset)}
            onTouchStart={() => onDown(startBucket + offset)}
          />
        ))}
      </div>
      <div className="flex items-start gap-1.5 h-6.25 left-2 top-2 absolute pointer-events-none">
        {CDE_BLACK.map((offset) => (
          <div
            key={offset}
            data-bucket={startBucket + offset}
            className={`${BLACK_NORMAL} pointer-events-auto`}
            onMouseDown={() => onDown(startBucket + offset)}
            onMouseEnter={() => onEnter(startBucket + offset)}
            onTouchStart={() => onDown(startBucket + offset)}
          />
        ))}
      </div>
    </div>
  );
}

function FgabGroup({ startBucket, onDown, onEnter }: GroupProps) {
  return (
    <div className="w-14.5 h-15 relative shrink-0">
      <div className="flex items-start h-8.75 top-2 left-0 absolute">
        {FGAB_WHITE.map((offset, i) => (
          <div
            key={offset}
            data-bucket={startBucket + offset}
            className={`${WHITE_NORMAL} ${i < 2 ? "w-3.5 h-8.75" : "w-3.75 self-stretch"}`}
            onMouseDown={() => onDown(startBucket + offset)}
            onMouseEnter={() => onEnter(startBucket + offset)}
            onTouchStart={() => onDown(startBucket + offset)}
          />
        ))}
      </div>
      <div className="flex items-start gap-1.5 h-6.25 top-2 left-1.75 absolute pointer-events-none">
        {FGAB_BLACK.map((offset) => (
          <div
            key={offset}
            data-bucket={startBucket + offset}
            className={`${BLACK_NORMAL} pointer-events-auto`}
            onMouseDown={() => onDown(startBucket + offset)}
            onMouseEnter={() => onEnter(startBucket + offset)}
            onTouchStart={() => onDown(startBucket + offset)}
          />
        ))}
      </div>
    </div>
  );
}

export function PianoRoll() {
  const playback = useContext(PlaybackContext);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
  }, []);

  const oscRef = useRef<OscillatorNode | null>(null);
  const activeKeyRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);

  const stopTone = useCallback(() => {
    oscRef.current?.stop();
    oscRef.current = null;
    activeKeyRef.current = null;
  }, []);

  const startTone = useCallback(
    (bucketIndex: number) => {
      const ctx = playback?.audioContext;
      const dest = playback?.analyserNode;
      if (!ctx || !dest) return;
      if (bucketIndex === activeKeyRef.current) return;
      oscRef.current?.stop();
      const osc = ctx.createOscillator();
      osc.type = "sine";
      const bucket = PITCH_BUCKETS[bucketIndex];
      osc.frequency.value = (bucket.start + bucket.end) / 2;
      osc.connect(dest);
      osc.start();
      oscRef.current = osc;
      activeKeyRef.current = bucketIndex;
    },
    [playback?.audioContext, playback?.analyserNode],
  );

  useEffect(() => {
    const onUp = () => {
      isDraggingRef.current = false;
      stopTone();
    };
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchend", onUp);
      stopTone();
    };
  }, [stopTone]);

  const handleKeyDown = useCallback(
    (bucketIndex: number) => {
      isDraggingRef.current = true;
      startTone(bucketIndex);
    },
    [startTone],
  );

  const handleKeyEnter = useCallback(
    (bucketIndex: number) => {
      if (isDraggingRef.current) startTone(bucketIndex);
    },
    [startTone],
  );

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    let startX = 0;
    let startScrollLeft = 0;
    let dragging = false;
    let scrolling = false;

    const onMouseDown = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest("[data-piano]")) return;
      startX = e.clientX;
      startScrollLeft = el.scrollLeft;
      dragging = true;
      scrolling = false;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      if (!scrolling && Math.abs(dx) < 5) return;
      if (!scrolling) {
        scrolling = true;
        isDraggingRef.current = false;
        stopTone();
        el.style.cursor = "grabbing";
      }
      el.scrollLeft = startScrollLeft - dx;
    };

    const onMouseUp = () => {
      dragging = false;
      scrolling = false;
      el.style.cursor = "";
    };

    el.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      el.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [stopTone]);

  useEffect(() => {
    let rafId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(PIANO_WIDTH_PX * dpr);
    canvas.height = Math.round(BAR_AREA_H_PX * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const tick = () => {
      rafId = requestAnimationFrame(tick);
      const phW = canvas.width;
      const phH = canvas.height;
      ctx.clearRect(0, 0, phW, phH);
      const fd = playback?.frequencyData?.current;
      if (!fd || fd.length === 0) return;
      const sampleRate = playback?.audioContext?.sampleRate ?? 44100;
      const grouped = groupFrequencies(fd, sampleRate / 2, PITCH_BUCKETS);
      ctx.fillStyle = "#1CCA93";
      for (let i = 0; i < TOTAL_SEMITONES; i++) {
        const v = grouped[START_SEMITONE + i] ?? -160;
        const h = Math.round(amplitudeToHeight(v, START_SEMITONE + i) * dpr);
        if (h < 1) continue;
        const x = Math.round((i * phW) / TOTAL_SEMITONES);
        const w = Math.round(((i + 1) * phW) / TOTAL_SEMITONES) - x;
        ctx.fillRect(x, phH - h, w, h);
      }
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [playback?.frequencyData, playback?.audioContext]);

  return (
    <div ref={scrollRef} className="self-stretch overflow-x-auto shrink-0">
      <div className="flex flex-col items-center w-fit mx-auto px-12.5">
        <canvas
          ref={canvasRef}
          style={{ width: PIANO_WIDTH_PX, height: BAR_AREA_H_PX }}
          className="shrink-0 [image-rendering:pixelated]"
        />
        <div
          data-piano
          className="flex items-end justify-center h-13.5 shrink-0"
          onDragStart={(e) => e.preventDefault()}
        >
          <div className="flex items-start">
            {Array.from({ length: OCTAVE_COUNT }, (_, oct) => {
              const startBucket = START_SEMITONE + oct * 12;
              return (
                <div key={oct} className="flex items-start">
                  <CdeGroup
                    startBucket={startBucket}
                    onDown={handleKeyDown}
                    onEnter={handleKeyEnter}
                  />
                  <FgabGroup
                    startBucket={startBucket}
                    onDown={handleKeyDown}
                    onEnter={handleKeyEnter}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
