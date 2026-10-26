type FFT = (re: Float64Array, im: Float64Array, inverse?: boolean) => void;

const cache = new Map<number, FFT>();

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

export const hann = (n: number) => {
  const w = new Float64Array(n);
  for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n);
  return w;
};

export const wrapPhase = (p: number) => p - 2 * Math.PI * Math.round(p / (2 * Math.PI));

export const olaGain = (window: Float64Array, hop: number) => {
  let total = 0;
  for (let i = 0; i < window.length; i++) total += window[i] * window[i];
  return total / hop;
};
