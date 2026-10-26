import { getFFT, wrapPhase } from "../../src/frontend/lib/fft";

// Core FFT helpers live in the app; analysis tools only the experiments use live here.
export { getFFT, hann, olaGain, wrapPhase } from "../../src/frontend/lib/fft";

export interface Frame {
  mag: Float64Array;
  phase: Float64Array;
}

/** Windowed FFT of `x[start..start+n)` (zero outside the signal); bins 0..n/2. */
export const analyze = (x: Float32Array, start: number, n: number, window: Float64Array): Frame => {
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const idx = start + i;
    re[i] = idx >= 0 && idx < x.length ? x[idx] * window[i] : 0;
  }
  getFFT(n)(re, im);
  const bins = n / 2 + 1;
  const mag = new Float64Array(bins);
  const phase = new Float64Array(bins);
  for (let k = 0; k < bins; k++) {
    mag[k] = Math.hypot(re[k], im[k]);
    phase[k] = Math.atan2(im[k], re[k]);
  }
  return { mag, phase };
};

/** Inverse of `analyze` for a half spectrum; returns the real time-domain frame. */
export const synthesize = (mag: Float64Array, phase: Float64Array, n: number): Float64Array => {
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  for (let k = 0; k <= n / 2; k++) {
    re[k] = mag[k] * Math.cos(phase[k]);
    im[k] = mag[k] * Math.sin(phase[k]);
    if (k > 0 && k < n / 2) {
      re[n - k] = re[k];
      im[n - k] = -im[k];
    }
  }
  im[0] = 0;
  im[n / 2] = 0;
  getFFT(n)(re, im, true);
  return re;
};

/**
 * True per-bin frequency (radians / sample) from the phase advance between
 * two frames `hop` samples apart.
 */
export const trueFrequency = (prev: Float64Array, cur: Float64Array, hop: number, n: number) => {
  const omega = new Float64Array(cur.length);
  for (let k = 0; k < cur.length; k++) {
    const binOmega = (2 * Math.PI * k) / n;
    omega[k] = binOmega + wrapPhase(cur[k] - prev[k] - binOmega * hop) / hop;
  }
  return omega;
};

/** Identity phase locking (Laroche & Dolson): bins follow their nearest spectral peak. */
export const lockPhases = (mag: Float64Array, inPhase: Float64Array, outPhase: Float64Array) => {
  const bins = mag.length;
  const peaks: number[] = [];
  for (let k = 2; k < bins - 2; k++) {
    if (mag[k] > mag[k - 1] && mag[k] > mag[k - 2] && mag[k] >= mag[k + 1] && mag[k] >= mag[k + 2])
      peaks.push(k);
  }
  if (peaks.length === 0) return outPhase;
  const locked = new Float64Array(bins);
  let p = 0;
  for (let k = 0; k < bins; k++) {
    while (p + 1 < peaks.length && Math.abs(peaks[p + 1] - k) < Math.abs(peaks[p] - k)) p++;
    const peak = peaks[p];
    locked[k] = outPhase[peak] + (inPhase[k] - inPhase[peak]);
  }
  return locked;
};

export const rms = (x: ArrayLike<number>, from = 0, to = x.length) => {
  let s = 0;
  for (let i = from; i < to; i++) s += x[i] * x[i];
  return Math.sqrt(s / Math.max(1, to - from));
};
