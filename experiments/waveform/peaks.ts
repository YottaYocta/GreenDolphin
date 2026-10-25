import type { Section } from "../../src/frontend/lib/waveform";

/** One mip level: per-block peak and mean of |x|, quantised to 0..255. */
interface Level {
  blockSize: number;
  peak: Uint8Array[];
  mean: Uint8Array[];
}

export interface PeakPyramid {
  levels: Level[];
  length: number;
  bytes: number;
}

const q = (v: number) => Math.min(255, Math.round(v * 255));

/**
 * Mipmapped amplitude summary: level 0 summarises `baseBlock` samples per bin,
 * each further level halves the bin count. Total size ≈ 2 × level 0.
 */
export const buildPyramid = (buffer: AudioBuffer, baseBlock = 256): PeakPyramid => {
  const channels = buffer.numberOfChannels;
  const bins0 = Math.ceil(buffer.length / baseBlock);
  const level0: Level = { blockSize: baseBlock, peak: [], mean: [] };
  for (let c = 0; c < channels; c++) {
    const x = buffer.getChannelData(c);
    const peak = new Uint8Array(bins0);
    const mean = new Uint8Array(bins0);
    for (let b = 0; b < bins0; b++) {
      let p = 0;
      let s = 0;
      const end = Math.min(x.length, (b + 1) * baseBlock);
      for (let i = b * baseBlock; i < end; i++) {
        const a = Math.abs(x[i]);
        if (a > p) p = a;
        s += a;
      }
      peak[b] = q(p);
      mean[b] = q(s / Math.max(1, end - b * baseBlock));
    }
    level0.peak.push(peak);
    level0.mean.push(mean);
  }

  const levels = [level0];
  while (levels[levels.length - 1].peak[0].length > 512) {
    const prev = levels[levels.length - 1];
    const bins = Math.ceil(prev.peak[0].length / 2);
    const next: Level = { blockSize: prev.blockSize * 2, peak: [], mean: [] };
    for (let c = 0; c < channels; c++) {
      const peak = new Uint8Array(bins);
      const mean = new Uint8Array(bins);
      const pp = prev.peak[c];
      const pm = prev.mean[c];
      for (let b = 0; b < bins; b++) {
        const j = 2 * b;
        peak[b] = Math.max(pp[j], pp[j + 1] ?? 0);
        mean[b] = j + 1 < pm.length ? (pm[j] + pm[j + 1]) >> 1 : pm[j];
      }
      next.peak.push(peak);
      next.mean.push(mean);
    }
    levels.push(next);
  }
  const bytes = levels.reduce((a, l) => a + l.peak.reduce((s, p) => s + p.length * 2, 0), 0);
  return { levels, length: buffer.length, bytes };
};

export type PeakMode = "mean" | "peak";

/**
 * Draws one bar per pixel. Picks the coarsest level whose blocks still fit in a
 * pixel; below level 0 it scans raw samples (at most `baseBlock` per pixel).
 * Returns the block size used (1 = raw).
 */
export const renderPyramid = (
  pyramid: PeakPyramid,
  raw: AudioBuffer,
  viewport: Section,
  canvas: HTMLCanvasElement,
  mode: PeakMode,
  selection?: Section,
) => {
  const ctx = canvas.getContext("2d")!;
  const { width, height } = canvas;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, height);
  const spp = (viewport.end - viewport.start) / width;
  const level = [...pyramid.levels].reverse().find((l) => l.blockSize <= spp);
  const channels = raw.numberOfChannels;
  const channelHeight = height / channels;
  const inside = new Path2D();
  const outside = new Path2D();

  for (let c = 0; c < channels; c++) {
    const rawData = level ? null : raw.getChannelData(c);
    const values = level ? (mode === "peak" ? level.peak[c] : level.mean[c]) : null;
    for (let px = 0; px < width; px++) {
      const from = viewport.start + px * spp;
      const to = from + spp;
      let v = 0;
      if (values && level) {
        const a = Math.floor(from / level.blockSize);
        const b = Math.max(a + 1, Math.floor(to / level.blockSize));
        let s = 0;
        for (let i = a; i < b && i < values.length; i++) {
          if (mode === "peak") v = Math.max(v, values[i]);
          else s += values[i];
        }
        if (mode === "mean") v = s / (b - a);
        v /= 255;
      } else if (rawData) {
        const a = Math.floor(from);
        const b = Math.max(a + 1, Math.floor(to));
        let s = 0;
        for (let i = a; i < b && i < rawData.length; i++) {
          const x = Math.abs(rawData[i]);
          if (mode === "peak") v = Math.max(v, x);
          else s += x;
        }
        if (mode === "mean") v = s / (b - a);
      }
      const h = Math.max(1, Math.round(v * channelHeight));
      const path = !selection || (from >= selection.start && from <= selection.end) ? inside : outside;
      path.rect(px, channelHeight * c + (channelHeight - h) / 2, 1, h);
    }
  }
  ctx.fillStyle = "rgb(25 202 147)";
  ctx.fill(inside);
  ctx.fillStyle = "rgb(25 202 147 / 30%)";
  ctx.fill(outside);
  return level?.blockSize ?? 1;
};
