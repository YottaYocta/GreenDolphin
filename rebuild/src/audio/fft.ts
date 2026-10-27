type FFT = (re: Float64Array, im: Float64Array, inverse?: boolean) => void;

export function createFFT(n: number): FFT {
  const levels = Math.log2(n);
  const cos = Float64Array.from({ length: n / 2 }, (_, i) => Math.cos((2 * Math.PI * i) / n));
  const sin = Float64Array.from({ length: n / 2 }, (_, i) => Math.sin((2 * Math.PI * i) / n));
  const rev = new Uint32Array(n);
  for (let i = 1; i < n; i++) rev[i] = (rev[i >> 1] >> 1) | ((i & 1) << (levels - 1));
  return (re, im, inverse = false) => {
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
        for (let j = 0; j < half; j++) {
          const a = i + j;
          const b = a + half;
          const wr = cos[j * step];
          const wi = sign * sin[j * step];
          const tr = re[b] * wr - im[b] * wi;
          const ti = re[b] * wi + im[b] * wr;
          re[b] = re[a] - tr;
          im[b] = im[a] - ti;
          re[a] += tr;
          im[a] += ti;
        }
      }
    }
    if (!inverse) return;
    for (let i = 0; i < n; i++) {
      re[i] /= n;
      im[i] /= n;
    }
  };
}

export const wrapPhase = (p: number) => p - 2 * Math.PI * Math.round(p / (2 * Math.PI));
