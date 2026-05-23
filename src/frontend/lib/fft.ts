function bitReverse(n: number, bits: number): number {
  let result = 0;
  for (let i = 0; i < bits; i++) {
    result = (result << 1) | (n & 1);
    n >>= 1;
  }
  return result;
}

function fftCore(real: Float64Array, imag: Float64Array, inverse: boolean): void {
  const n = real.length;
  const bits = Math.log2(n);

  for (let i = 0; i < n; i++) {
    const j = bitReverse(i, bits);
    if (j > i) {
      [real[i], real[j]] = [real[j], real[i]];
      [imag[i], imag[j]] = [imag[j], imag[i]];
    }
  }

  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1;
    const angleStep = (inverse ? 1 : -1) * (2 * Math.PI) / len;
    for (let i = 0; i < n; i += len) {
      for (let j = 0; j < half; j++) {
        const angle = angleStep * j;
        const wr = Math.cos(angle);
        const wi = Math.sin(angle);
        const ur = real[i + j];
        const ui = imag[i + j];
        const vr = real[i + j + half] * wr - imag[i + j + half] * wi;
        const vi = real[i + j + half] * wi + imag[i + j + half] * wr;
        real[i + j] = ur + vr;
        imag[i + j] = ui + vi;
        real[i + j + half] = ur - vr;
        imag[i + j + half] = ui - vi;
      }
    }
  }

  if (inverse) {
    for (let i = 0; i < n; i++) {
      real[i] /= n;
      imag[i] /= n;
    }
  }
}

export function fft(real: Float64Array, imag: Float64Array): void {
  fftCore(real, imag, false);
}

export function ifft(real: Float64Array, imag: Float64Array): void {
  fftCore(real, imag, true);
}

export function hannWindow(n: number): Float64Array {
  const w = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)));
  }
  return w;
}
