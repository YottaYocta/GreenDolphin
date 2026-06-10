import { useCallback, useContext, useEffect, useRef } from "react";
import { PlaybackContext } from "../playback/PlaybackContext";
import { groupFrequencies, PITCH_BUCKETS } from "../lib/frequency";
import { useDrag } from "../lib/useDrag";

const START_SEMITONE = 24;
const OCTAVE_COUNT = 7;
const TOTAL_SEMITONES = OCTAVE_COUNT * 12;
const PIANO_WIDTH_PX = OCTAVE_COUNT * 101;
const BAR_AREA_H_PX = 56;

function amplitudeToHeight(v: number, idx: number): number {
  const intensity = Math.min(140, v + 140);
  if (intensity <= 10) return 0;
  const base = (intensity * Math.pow(idx, 0.2)) / 2;
  return Math.min(
    Math.sqrt(Math.pow(base * base * base, base / 130)) / 5,
    BAR_AREA_H_PX,
  );
}

const WB =
  "overflow-clip shrink-0 [box-shadow:#0000001A_0px_2px_3px] border border-solid cursor-pointer select-none";
const WN = `${WB} bg-[#FBFBFB] border-[#0000001A] hover:bg-[#F0F0F0] active:bg-[#E8E8E8]`;
const WC = `${WB} bg-[#E6E6E6] border-[#00000033] hover:bg-[#D8D8D8] active:bg-[#CACACA]`;
const BN =
  "overflow-clip self-stretch shrink-0 w-2.5 pointer-events-auto [box-shadow:#FFFFFF33_0px_0px_3px_inset] border border-solid cursor-pointer select-none bg-[#787878] border-[#00000080] hover:bg-[#686868] active:bg-[#585858]";

type GroupDef = {
  cw: string;
  bl: string;
  whites: [number, string][];
  blacks: number[];
};
const GROUPS: GroupDef[] = [
  {
    cw: "w-10.75",
    bl: "left-2",
    whites: [
      [0, `${WC} w-3.5 h-8.75`],
      [2, `${WN} w-3.5 h-8.75`],
      [4, `${WN} w-3.75 self-stretch`],
    ],
    blacks: [1, 3],
  },
  {
    cw: "w-14.5",
    bl: "left-1.75",
    whites: [
      [5, `${WN} w-3.5 h-8.75`],
      [7, `${WN} w-3.5 h-8.75`],
      [9, `${WN} w-3.75 self-stretch`],
      [11, `${WN} w-3.75 self-stretch`],
    ],
    blacks: [6, 8, 10],
  },
];

function OctaveGroup({ start }: { start: number }) {
  return (
    <>
      {GROUPS.map(({ cw, bl, whites, blacks }, gi) => (
        <div key={gi} className={`${cw} h-15 relative shrink-0`}>
          <div className="flex items-start h-8.75 left-0 top-2 absolute">
            {whites.map(([offset, cls]) => (
              <div key={offset} data-bucket={start + offset} className={cls} />
            ))}
          </div>
          <div
            className={`flex items-start gap-1.5 h-6.25 ${bl} top-2 absolute pointer-events-none`}
          >
            {blacks.map((offset) => (
              <div key={offset} data-bucket={start + offset} className={BN} />
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

export function PianoRoll() {
  const playback = useContext(PlaybackContext);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pianoRef = useRef<HTMLDivElement>(null);
  const oscRef = useRef<OscillatorNode | null>(null);
  const activeKeyRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);
  const startScrollLeftRef = useRef(0);
  const scrollingRef = useRef(false);

  const [startScrollDrag] = useDrag(
    ({ totalDx }) => {
      const el = scrollRef.current;
      if (!el) return;
      if (!scrollingRef.current && Math.abs(totalDx) < 5) return;
      if (!scrollingRef.current) {
        scrollingRef.current = true;
        isDraggingRef.current = false;
        stopTone();
        el.style.cursor = "grabbing";
      }
      el.scrollLeft = startScrollLeftRef.current - totalDx;
    },
    () => {
      scrollingRef.current = false;
      const el = scrollRef.current;
      if (el) el.style.cursor = "";
    },
  );

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
  }, []);

  const stopTone = useCallback(() => {
    oscRef.current?.stop();
    oscRef.current = null;
    activeKeyRef.current = null;
  }, []);

  const startTone = useCallback(
    (idx: number) => {
      const ctx = playback?.audioContext;
      const dest = playback?.analyserNode;
      if (!ctx || !dest || idx === activeKeyRef.current) return;
      oscRef.current?.stop();
      const osc = ctx.createOscillator();
      osc.type = "sine";
      const bucket = PITCH_BUCKETS[idx];
      osc.frequency.value = (bucket.start + bucket.end) / 2;
      osc.connect(dest);
      osc.start();
      oscRef.current = osc;
      activeKeyRef.current = idx;
    },
    [playback?.audioContext, playback?.analyserNode],
  );

  const bucketOf = (el: Element | null) =>
    el?.closest("[data-bucket]")?.getAttribute("data-bucket");

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
      const phW = canvas.width,
        phH = canvas.height;
      ctx.clearRect(0, 0, phW, phH);
      const fd = playback?.frequencyData?.current;
      if (!fd || fd.length === 0) return;
      const grouped = groupFrequencies(
        fd,
        (playback?.audioContext?.sampleRate ?? 44100) / 2,
        PITCH_BUCKETS,
      );
      ctx.fillStyle = "#1CCA93";
      for (let i = 0; i < TOTAL_SEMITONES; i++) {
        const v = grouped[START_SEMITONE + i] ?? -160;
        const h = Math.round(amplitudeToHeight(v, START_SEMITONE + i) * dpr);
        if (h < 1) continue;
        const x = Math.round((i * phW) / TOTAL_SEMITONES);
        ctx.fillRect(
          x,
          phH - h,
          Math.round(((i + 1) * phW) / TOTAL_SEMITONES) - x,
          h,
        );
      }
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [playback?.frequencyData, playback?.audioContext]);

  return (
    <div
      ref={scrollRef}
      className="self-stretch overflow-x-auto shrink-0 "
      onMouseDown={(e) => {
        if ((e.target as HTMLElement).closest("[data-piano]")) return;
        startScrollLeftRef.current = scrollRef.current!.scrollLeft;
        scrollingRef.current = false;
        startScrollDrag(e.clientX);
      }}
    >
      <div className="flex flex-col items-center w-fit mx-auto px-12.5">
        <canvas
          ref={canvasRef}
          style={{ width: PIANO_WIDTH_PX, height: BAR_AREA_H_PX }}
          className="shrink-0 [image-rendering:pixelated]"
        />
        <div
          ref={pianoRef}
          data-piano
          className="flex items-end justify-center h-13.5 shrink-0"
          onDragStart={(e) => e.preventDefault()}
          onMouseDown={(e) => {
            const b = bucketOf(e.target as Element);
            if (b) {
              isDraggingRef.current = true;
              startTone(+b);
            }
          }}
          onMouseMove={(e) => {
            if (isDraggingRef.current) {
              const b = bucketOf(e.target as Element);
              if (b) startTone(+b);
            }
          }}
          onTouchStart={(e) => {
            const { clientX, clientY } = e.touches[0];
            const b = bucketOf(document.elementFromPoint(clientX, clientY));
            if (b) {
              isDraggingRef.current = true;
              startTone(+b);
            }
          }}
          onTouchMove={(e) => {
            const { clientX, clientY } = e.touches[0];
            const b = bucketOf(document.elementFromPoint(clientX, clientY));
            if (b) startTone(+b);
          }}
        >
          <div className="flex items-start">
            {Array.from({ length: OCTAVE_COUNT }, (_, oct) => (
              <OctaveGroup key={oct} start={START_SEMITONE + oct * 12} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
