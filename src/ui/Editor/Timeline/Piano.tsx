import { useEffect, useRef, type RefObject } from "react";
import type { AudioEngine, NoteSynth } from "../../../audio";
import { drag } from "../../shared/drag";
import { HIGH_PITCH, isBlack, pitchFrequency } from "../notes";
import { PITCHES, fitCanvas } from "./noteCanvas";

export const PIANO_WIDTH = 48;
const BARS_WIDTH = 56;
const WHITE_STEPS = [0, 2, 4, 5, 7, 9, 11];
const WHITE_ROWS = 12 / 7;

const whiteRow = (pitch: number) => HIGH_PITCH + 1 - (pitch - pitch % 12) - (WHITE_STEPS.indexOf(pitch % 12) + 1) * WHITE_ROWS;

function barWidth(db: number, pitch: number) {
  const intensity = Math.min(140, db + 140);
  if (intensity <= 10) return 0;
  const base = (intensity * (pitch - 12) ** 0.2) / 2;
  return Math.min(Math.sqrt(base ** 3) ** (base / 130) / 5, BARS_WIDTH);
}

function semitoneLevel(data: Float32Array, binHz: number, pitch: number) {
  const f = pitchFrequency(pitch);
  const lo = Math.floor(f / 2 ** (1 / 24) / binHz);
  const hi = Math.max(lo + 1, Math.ceil((f * 2 ** (1 / 24)) / binHz));
  let sum = 0;
  for (let b = lo; b < hi; b++) sum += data[b] ?? -160;
  return sum / (hi - lo);
}

const keyAt = (x: number, y: number) => document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-key]")?.dataset.key;

interface PianoProps {
  keys: RefObject<HTMLDivElement | null>;
  top: () => number;
  rowHeight: number;
  synth: NoteSynth;
  spectrum?: AudioEngine;
}

export function Piano({ keys, top, rowHeight, synth, spectrum }: PianoProps) {
  const bars = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!spectrum) return;
    let raf = 0;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      const { ctx, height } = fitCanvas(bars.current!);
      const data = spectrum.readSpectrum();
      ctx.fillStyle = "rgb(28 202 147 / 55%)";
      for (const pitch of PITCHES) {
        const y = (HIGH_PITCH - pitch) * rowHeight - top();
        if (y + rowHeight < 0 || y > height) continue;
        const w = barWidth(semitoneLevel(data, spectrum.spectrumBinHz, pitch), pitch);
        if (w >= 1) ctx.fillRect(0, y + 1, w, rowHeight - 2);
      }
    };
    frame();
    return () => cancelAnimationFrame(raf);
  }, [spectrum, top, rowHeight]);

  useEffect(() => () => synth.playTone(null), [synth]);

  const play = (key: string | undefined) => key !== undefined && synth.playTone(pitchFrequency(+key));

  return (
    <div id="piano" data-control data-roll className="absolute left-0 inset-y-0 z-20 touch-none" style={{ width: PIANO_WIDTH }}>
      <div
        className="absolute inset-0 overflow-hidden border-r border-border cursor-pointer"
        onPointerDown={(e) => {
          play(keyAt(e.clientX, e.clientY));
          drag(e, (_x, _dx, y) => play(keyAt(e.clientX, y)), () => synth.playTone(null));
        }}
      >
        <div ref={keys} className="relative" style={{ height: PITCHES.length * rowHeight }}>
          {PITCHES.filter((pitch) => !isBlack(pitch)).map((pitch) => (
            <div key={pitch} data-key={pitch} className="absolute inset-x-0 bg-[#FBFBFB] hover:bg-[#F0F0F0] border-b border-[#00000033]" style={{ top: whiteRow(pitch) * rowHeight, height: WHITE_ROWS * rowHeight }}>
              {pitch % 12 === 0 && <span className="absolute right-1 bottom-0 font-space-mono text-[8px] leading-none text-black/40 pointer-events-none">C{pitch / 12 - 1}</span>}
            </div>
          ))}
          {PITCHES.filter(isBlack).map((pitch) => (
            <div key={pitch} data-key={pitch} className="absolute left-0 w-3/5 bg-[#787878] hover:bg-[#686868] rounded-r-sm" style={{ top: (HIGH_PITCH - pitch) * rowHeight, height: rowHeight }} />
          ))}
        </div>
      </div>
      {spectrum && <canvas ref={bars} className="absolute inset-y-0 pointer-events-none" style={{ left: PIANO_WIDTH, width: BARS_WIDTH, height: "100%" }} />}
    </div>
  );
}
