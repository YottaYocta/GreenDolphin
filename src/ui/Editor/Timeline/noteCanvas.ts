import type { Section } from "../../../core";
import type { Note } from "../../../persistence";
import { HIGH_PITCH, LOW_PITCH } from "../notes";
import { tickStep } from "./ticks";

export const PITCHES = Array.from({ length: HIGH_PITCH - LOW_PITCH + 1 }, (_, i) => HIGH_PITCH - i);

export function fitCanvas(canvas: HTMLCanvasElement) {
  const dpr = window.devicePixelRatio || 1;
  const [width, height] = [canvas.clientWidth, canvas.clientHeight];
  if (canvas.width !== Math.round(width * dpr)) canvas.width = Math.round(width * dpr);
  if (canvas.height !== Math.round(height * dpr)) canvas.height = Math.round(height * dpr);
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  return { ctx, width, height };
}

export function drawNotes(canvas: HTMLCanvasElement, notes: Note[], view: Section, top: number, rowHeight: number) {
  const { ctx, width, height } = fitCanvas(canvas);
  const toX = (t: number) => ((t - view.start) / (view.end - view.start)) * width;
  const rowY = (pitch: number) => (HIGH_PITCH - pitch) * rowHeight - top;
  for (const pitch of PITCHES) {
    const y = rowY(pitch);
    if (y + rowHeight < 0 || y > height) continue;
    ctx.fillStyle = pitch % 12 === 0 ? "rgb(0 0 0 / 14%)" : "rgb(0 0 0 / 4%)";
    ctx.fillRect(0, y + rowHeight - 1, width, 1);
  }
  const step = tickStep(view.end - view.start, width);
  ctx.fillStyle = "rgb(0 0 0 / 6%)";
  for (let t = Math.ceil(view.start / step) * step; t <= view.end; t += step) ctx.fillRect(Math.round(toX(t)), 0, 1, height);
  for (const note of notes) {
    const [x, y, w] = [toX(note.start), rowY(note.pitch), (note.length / (view.end - view.start)) * width];
    if (x + w < 0 || x > width || y + rowHeight < 0 || y > height) continue;
    ctx.fillStyle = "rgb(25 202 147)";
    ctx.beginPath();
    ctx.roundRect(x, y + 1, Math.max(2, w), rowHeight - 2, 3);
    ctx.fill();
  }
}
