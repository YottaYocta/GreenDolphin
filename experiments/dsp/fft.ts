export type FFT = (re: Float64Array, im: Float64Array, inverse?: boolean) => void;

const cache = new Map<number, FFT>();

/** In-place radix-2 complex FFT of size `n` (power of two). Inverse is scaled by 1/n. */
export const getFFT = (n: number): FFT => {
  const existing = cache.get(n);
  if (existing) return existing;
  const levels = Math.log2(n);
  if (!Number.isInteger(levels)) throw new Error(`FFT size ${n} is not a power of 2`);

  const cos = new Float64Array(n / 2);
  const sin = new Float64Array(n / 2);
  for (let i = 0; i < n / 2; i++) {
    cos[i] = Math.cos((2 * Math.PI * i) / n);
    sin[i] = Math.sin((2 * Math.PI * i) / n);
  }
  const rev = new Uint32Array(n);
  for (let i = 1; i < n; i++) rev[i] = (rev[i >> 1] >> 1) | ((i & 1) << (levels - 1));

  const fft: FFT = (re, im, inverse = false) => {
    for (let i = 0; i < n; i++) {
      const j = rev[i];
      if (j > i) {
        [re[i], re[j]] = [re[j], re[i]];
        [im[i], im[j]] = [im[j], im[i]];
      }
    }
    const sign = inverse ? 1 : -1;
    for (let size = 2; size <= n; size *= 2) {
      const half = size / 2;
      const step = n / size;
      for (let i = 0; i < n; i += size) {
        for (let j = 0, k = 0; j < half; j++, k += step) {
          const a = i + j;
          const b = a + half;
          const wr = cos[k];
          const wi = sign * sin[k];
          const tr = re[b] * wr - im[b] * wi;
          const ti = re[b] * wi + im[b] * wr;
          re[b] = re[a] - tr;
          im[b] = im[a] - ti;
          re[a] += tr;
          im[a] += ti;
        }
      }
    }
    if (inverse) {
      for (let i = 0; i < n; i++) {
        re[i] /= n;
        im[i] /= n;
      }
    }
  };
  cache.set(n, fft);
  return fft;
};

/** Periodic Hann window: overlap-adds to a constant at hops of n/2, n/4, ... */
export const hann = (n: number) => {
  const w = new Float64Array(n);
  for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n);
  return w;
};

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

export const wrapPhase = (p: number) => p - 2 * Math.PI * Math.round(p / (2 * Math.PI));

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

/** Steady-state sum of window² across a hop-`hop` overlap-add (constant for Hann). */
export const olaGain = (window: Float64Array, hop: number) => {
  let total = 0;
  for (let i = 0; i < window.length; i++) total += window[i] * window[i];
  return total / hop;
};

export const rms = (x: ArrayLike<number>, from = 0, to = x.length) => {
  let s = 0;
  for (let i = from; i < to; i++) s += x[i] * x[i];
  return Math.sqrt(s / Math.max(1, to - from));
};
