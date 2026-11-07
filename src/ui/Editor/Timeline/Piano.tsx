import { useEffect, useRef, type RefObject } from "react";
import type { DurationSeconds, Player } from "../../../core";
import type { Note } from "../../../persistence";
import { drag } from "../../shared/drag";
import { HIGH_PITCH, LOW_PITCH, isBlack, pitchFrequency, withEdited } from "../notes";
import { PITCHES, fitCanvas } from "./noteCanvas";
import type { RollProps } from "./index";

export const PIANO_WIDTH = 48;
const BARS_WIDTH = 56;

const whiteEdges = (pitch: number) => ({
  low: Math.max(LOW_PITCH, pitch - (isBlack(pitch - 1) ? 0.5 : 0)),
  high: Math.min(HIGH_PITCH + 1, pitch + 1 + (isBlack(pitch + 1) ? 0.5 : 0)),
});

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
  roll: RollProps;
  player: Player;
  newNoteLength: () => DurationSeconds;
}

function enterNote(pitch: number, { notes }: RollProps, player: Player, newNoteLength: () => DurationSeconds) {
  const base = notes.get();
  const start = player.position();
  const minimum = newNoteLength();
  const shape = (): Note => {
    const played = player.position() - start;
    return { pitch, start, length: Math.min(played > minimum ? played : minimum, player.duration - start) };
  };
  let raf = 0;
  const grow = () => {
    raf = requestAnimationFrame(grow);
    notes.preview(withEdited(base, [shape()]), []);
  };
  grow();
  return () => {
    cancelAnimationFrame(raf);
    const note = shape();
    notes.commit(withEdited(base, [note]), [note]);
  };
}

export function Piano({ keys, top, rowHeight, roll, player, newNoteLength }: PianoProps) {
  const { synth, spectrum, pen } = roll;
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

  const entry = useRef<{ key: string; finish?: () => void } | null>(null);
  const play = (key: string | undefined) => {
    if (key === undefined || key === entry.current?.key) return;
    synth.playTone(pitchFrequency(+key));
    entry.current?.finish?.();
    entry.current = { key, finish: pen ? enterNote(+key, roll, player, newNoteLength) : undefined };
  };
  const release = () => {
    synth.playTone(null);
    entry.current?.finish?.();
    entry.current = null;
  };

  return (
    <div id="piano" data-control data-roll className="absolute left-0 inset-y-0 z-20 touch-none" style={{ width: PIANO_WIDTH }}>
      <div
        className="absolute inset-0 overflow-hidden border-r border-border cursor-pointer"
        onPointerDown={(e) => {
          play(keyAt(e.clientX, e.clientY));
          drag(e, (_x, _dx, y) => play(keyAt(e.clientX, y)), release);
        }}
      >
        <div ref={keys} className="relative" style={{ height: PITCHES.length * rowHeight }}>
          {PITCHES.filter((pitch) => !isBlack(pitch)).map((pitch) => (
            <div key={pitch} data-key={pitch} className="absolute inset-x-0 bg-[#FBFBFB] hover:bg-[#F0F0F0] border-b border-[#00000033]" style={{ top: (HIGH_PITCH + 1 - whiteEdges(pitch).high) * rowHeight, height: (whiteEdges(pitch).high - whiteEdges(pitch).low) * rowHeight }}>
              {pitch % 12 === 0 && <span className="absolute right-1 inset-y-0 flex items-center font-space-mono text-[8px] leading-none text-black/40 pointer-events-none">C{pitch / 12 - 1}</span>}
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
