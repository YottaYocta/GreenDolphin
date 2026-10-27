import { useEffect, useRef } from "react";
import type { AudioEngine } from "../audio/engine";
import { drag } from "./drag";

const FIRST = 24;
const OCTAVES = 7;
const KEYS = OCTAVES * 12;
const WHITE_W = 14;
const WIDTH = OCTAVES * 7 * WHITE_W;
const BARS_H = 56;
const BLACK = new Set([1, 3, 6, 8, 10]);
const SCROLL_PX = 5;

const frequency = (key: number) => 440 * 2 ** ((key - 57) / 12);

/** dB → bar height, emphasising loud partials (tuned by ear in the original app). */
function barHeight(db: number, key: number) {
  const intensity = Math.min(140, db + 140);
  if (intensity <= 10) return 0;
  const base = (intensity * key ** 0.2) / 2;
  return Math.min(Math.sqrt(base ** 3) ** (base / 130) / 5, BARS_H);
}

/** Average analyser level across each semitone (quarter-tone either side). */
function semitoneLevels(data: Float32Array, sampleRate: number) {
  const binHz = sampleRate / 2 / data.length;
  return Array.from({ length: KEYS }, (_, i) => {
    const f = frequency(FIRST + i);
    const lo = Math.floor(f / 2 ** (1 / 24) / binHz);
    const hi = Math.max(lo + 1, Math.ceil((f * 2 ** (1 / 24)) / binHz));
    let sum = 0;
    for (let b = lo; b < hi; b++) sum += data[b] ?? -160;
    return sum / (hi - lo);
  });
}

const keyAt = (x: number, y: number) => document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-key]")?.dataset.key;

export function PianoRoll({ engine }: { engine: AudioEngine }) {
  const scroller = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = scroller.current!;
    el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
    const c = canvas.current!;
    const dpr = window.devicePixelRatio || 1;
    [c.width, c.height] = [WIDTH * dpr, BARS_H * dpr];
    const ctx = c.getContext("2d")!;
    const data = new Float32Array(engine.analyser.frequencyBinCount);
    let raf = 0;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      engine.analyser.getFloatFrequencyData(data);
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.fillStyle = "#1CCA93";
      semitoneLevels(data, engine.ctx.sampleRate).forEach((db, i) => {
        const h = Math.round(barHeight(db, FIRST + i) * dpr);
        const x = Math.round((i * c.width) / KEYS);
        if (h >= 1) ctx.fillRect(x, c.height - h, Math.round(((i + 1) * c.width) / KEYS) - x, h);
      });
    };
    frame();
    return () => {
      cancelAnimationFrame(raf);
      engine.playTone(null);
    };
  }, [engine]);

  const play = (key: string | undefined) => key !== undefined && engine.playTone(frequency(+key));

  return (
    <div
      id="piano"
      ref={scroller}
      className="overflow-x-auto shrink-0 touch-pan-x cursor-grab"
      onPointerDown={(e) => {
        const start = scroller.current!.scrollLeft;
        const pressed = keyAt(e.clientX, e.clientY);
        if (pressed === undefined && e.pointerType === "touch") return;
        if (pressed !== undefined) play(pressed);
        drag(
          e,
          (x, dx) => {
            if (pressed !== undefined) play(keyAt(x, e.clientY));
            else scroller.current!.scrollLeft = start - dx;
          },
          () => engine.playTone(null),
          pressed !== undefined ? 0 : SCROLL_PX,
        );
      }}
    >
      <div className="flex flex-col items-center w-fit mx-auto px-12 pt-4">
        <canvas ref={canvas} style={{ width: WIDTH, height: BARS_H }} />
        <div className="relative flex h-13.5 pt-2" style={{ width: WIDTH }}>
          {Array.from({ length: KEYS }, (_, i) =>
            BLACK.has(i % 12) ? null : (
              <div key={i} data-key={FIRST + i} className="h-8.75 shrink-0 touch-none border border-[#0000001A] bg-[#FBFBFB] hover:bg-[#F0F0F0] [box-shadow:#0000001A_0px_2px_3px] cursor-pointer" style={{ width: WHITE_W }} />
            ),
          )}
          {Array.from({ length: KEYS }, (_, i) =>
            BLACK.has(i % 12) ? (
              <div key={i} data-key={FIRST + i} className="absolute top-2 touch-none w-2.5 h-6.25 -translate-x-1/2 border border-[#00000080] bg-[#787878] hover:bg-[#686868] cursor-pointer" style={{ left: whiteIndex(i) * WHITE_W }} />
            ) : null,
          )}
        </div>
      </div>
    </div>
  );
}

const whiteIndex = (i: number) => Math.floor(i / 12) * 7 + [0, 1, 1, 2, 2, 3, 4, 4, 5, 5, 6, 6][i % 12];
