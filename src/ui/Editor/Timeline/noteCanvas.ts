import type { Section } from "../../../core";
import type { Note } from "../../../persistence";
import { HIGH_PITCH, PITCHES, isBlack, type NotePoint } from "../notes";
import { fitCanvas } from "../../shared/canvas";
import { tickStep } from "./ticks";

export function drawNotes(canvas: HTMLCanvasElement, notes: Note[], selected: ReadonlySet<Note>, box: [NotePoint, NotePoint] | null, view: Section, top: number, rowHeight: number) {
  const { ctx, width, height } = fitCanvas(canvas);
  const toX = (t: number) => ((t - view.start) / (view.end - view.start)) * width;
  const rowY = (pitch: number) => (HIGH_PITCH - pitch) * rowHeight - top;
  for (const pitch of PITCHES) {
    const y = rowY(pitch);
    if (y + rowHeight < 0 || y > height) continue;
    if (isBlack(pitch)) {
      ctx.fillStyle = "rgb(0 0 0 / 3%)";
      ctx.fillRect(0, y, width, rowHeight);
    }
    ctx.fillStyle = pitch % 12 === 0 ? "rgb(0 0 0 / 14%)" : "rgb(0 0 0 / 4%)";
    ctx.fillRect(0, y + rowHeight - 1, width, 1);
  }
  const step = tickStep(view.end - view.start, width);
  ctx.fillStyle = "rgb(0 0 0 / 6%)";
  for (let t = Math.ceil(view.start / step) * step; t <= view.end; t += step) ctx.fillRect(Math.round(toX(t)), 0, 1, height);
  for (const note of notes) {
    const [x, y, w] = [toX(note.start), rowY(note.pitch), (note.length / (view.end - view.start)) * width];
    if (x + w < 0 || x > width || y + rowHeight < 0 || y > height) continue;
    ctx.fillStyle = selected.has(note) ? "rgb(10 110 80)" : "rgb(25 202 147)";
    ctx.beginPath();
    ctx.roundRect(x, y + 1, Math.max(2, w), rowHeight - 2, 3);
    ctx.fill();
  }
  if (box) {
    const [a, b] = box;
    const [left, right] = [toX(Math.min(a.time, b.time)), toX(Math.max(a.time, b.time))];
    const [upper, lower] = [rowY(Math.max(a.pitch, b.pitch)), rowY(Math.min(a.pitch, b.pitch)) + rowHeight];
    ctx.fillStyle = "rgb(25 202 147 / 15%)";
    ctx.fillRect(left, upper, right - left, lower - upper);
    ctx.strokeStyle = "rgb(10 110 80)";
    ctx.strokeRect(left, upper, right - left, lower - upper);
  }
}
