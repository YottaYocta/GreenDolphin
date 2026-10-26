import { analyze, hann } from "../../src/frontend/lib/fft";

/** 1/6-octave band centres from ~31 Hz to 16 kHz. */
export const BANDS = Array.from({ length: 55 }, (_, i) => 31.25 * 2 ** (i / 6));

const N = 8192;
const FLOOR_DB = -100;

/** Long-term average spectrum of `[from, to)`, in dB per band (power-summed). */
export const bandSpectrum = (channels: Float32Array[], from: number, to: number, sr: number) => {
  const window = hann(N);
  const bins = N / 2 + 1;
  const power = new Float64Array(bins);
  let frames = 0;
  for (const ch of channels) {
    for (let s = from; s + N <= Math.max(to, from + N); s += N / 2, frames++) {
      const { mag } = analyze(ch, s, N, window);
      // Scale so a full-scale sine reads ≈ 0 dBFS (Hann coherent gain is n/4 per side).
      for (let k = 0; k < bins; k++) power[k] += (mag[k] * 4 / N) ** 2;
    }
  }
  const edge = 2 ** (1 / 12);
  return BANDS.map((fc) => {
    const lo = Math.max(1, Math.floor(((fc / edge) * N) / sr));
    const hi = Math.min(bins - 1, Math.ceil(((fc * edge) * N) / sr));
    let sum = 0;
    for (let k = lo; k <= hi; k++) sum += power[k];
    const db = 10 * Math.log10(sum / Math.max(1, frames) + 1e-20);
    return Math.max(FLOOR_DB, db);
  });
};

export interface SpectrumComparison {
  /** Overall level difference, freeze minus source (dB). */
  levelDb: number;
  /** Mean absolute band difference after removing the level offset (dB). Lower = closer timbre. */
  shapeDb: number;
  /** Energy below 250 Hz as a share of the total, for source and freeze. */
  lowShare: [number, number];
}

const lowShare = (bands: number[]) => {
  const p = bands.map((db) => 10 ** (db / 10));
  const total = p.reduce((a, b) => a + b, 0);
  return p.reduce((a, v, i) => (BANDS[i] < 250 ? a + v : a), 0) / total;
};

export const compareSpectra = (source: number[], freeze: number[]): SpectrumComparison => {
  const active = source.map((db, i) => [db, freeze[i]]).filter(([db]) => db > Math.max(...source) - 60);
  const offset = active.reduce((a, [s, f]) => a + (f - s), 0) / active.length;
  const shape = active.reduce((a, [s, f]) => a + Math.abs(f - s - offset), 0) / active.length;
  const total = (bands: number[]) => 10 * Math.log10(bands.reduce((a, db) => a + 10 ** (db / 10), 0));
  return {
    levelDb: total(freeze) - total(source),
    shapeDb: shape,
    lowShare: [lowShare(source), lowShare(freeze)],
  };
};
