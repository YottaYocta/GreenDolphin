import type { Recording } from "../../../../audio";
import type { Section } from "../../../../core";

const BASE = 64;
const CHUNK = 1 << 16;

export interface Peaks {
  levels: Float32Array[][];
}

const yieldToUI = () => new Promise((resolve) => setTimeout(resolve));

export async function buildPeaks(recording: Recording): Promise<Peaks> {
  const scratch = new Float32Array(CHUNK);
  const base = Array.from({ length: recording.channelCount }, (_, c) => {
    const bins = new Float32Array(Math.ceil(recording.length / BASE));
    return { c, bins };
  });
  for (let start = 0; start < recording.length; start += CHUNK) {
    const n = Math.min(CHUNK, recording.length - start);
    for (const { c, bins } of base) {
      recording.readChannel(scratch, c, start);
      for (let i = 0; i < n; i += BASE) {
        let sum = 0;
        const end = Math.min(n, i + BASE);
        for (let j = i; j < end; j++) sum += Math.abs(scratch[j]);
        bins[(start + i) / BASE] = sum / (end - i);
      }
    }
    if ((start / CHUNK) % 32 === 31) await yieldToUI();
  }
  const levels = [base.map((b) => b.bins)];
  while (levels[levels.length - 1][0].length > 1024) {
    levels.push(levels[levels.length - 1].map((prev) => Float32Array.from({ length: Math.ceil(prev.length / 2) }, (_, i) => (prev[2 * i] + (prev[2 * i + 1] ?? prev[2 * i])) / 2)));
  }
  return { levels };
}

function columns(peaks: Peaks, recording: Recording, channel: number, view: Section, width: number) {
  const out = new Float32Array(width);
  const first = view.start * recording.sampleRate;
  const perPx = ((view.end - view.start) * recording.sampleRate) / width;
  let level = 0;
  while (level + 1 < peaks.levels.length && BASE * 2 ** (level + 1) <= perPx) level++;
  const size = BASE * 2 ** level;
  const raw = perPx < BASE ? new Float32Array(Math.ceil(perPx * width) + 1) : null;
  if (raw) recording.readChannel(raw, channel, Math.floor(first));
  const data = raw ?? peaks.levels[level][channel];
  const unit = raw ? 1 : size;
  const offset = raw ? Math.floor(first) : 0;
  for (let x = 0; x < width; x++) {
    const a = Math.floor((first + x * perPx - offset) / unit);
    const b = Math.max(a + 1, Math.floor((first + (x + 1) * perPx - offset) / unit));
    let sum = 0;
    for (let i = a; i < b && i < data.length; i++) sum += Math.abs(data[i]);
    out[x] = sum / (b - a);
  }
  return out;
}

export function drawWaveform(canvas: HTMLCanvasElement, peaks: Peaks, recording: Recording, view: Section, loop: Section) {
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (canvas.width !== Math.round(width * dpr)) canvas.width = Math.round(width * dpr);
  if (canvas.height !== Math.round(height * dpr)) canvas.height = Math.round(height * dpr);
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  const lane = height / recording.channelCount;
  const toPx = (t: number) => ((t - view.start) / (view.end - view.start)) * width;
  const [loopFrom, loopTo] = [toPx(loop.start), toPx(loop.end)];
  for (let c = 0; c < recording.channelCount; c++) {
    const values = columns(peaks, recording, c, view, Math.max(1, Math.floor(width)));
    values.forEach((v, x) => {
      const h = Math.max(1, Math.round(v * lane));
      ctx.fillStyle = x >= loopFrom && x < loopTo ? "rgb(25 202 147)" : "rgb(25 202 147 / 30%)";
      ctx.fillRect(x, lane * c + (lane - h) / 2, 1, h);
    });
  }
}
