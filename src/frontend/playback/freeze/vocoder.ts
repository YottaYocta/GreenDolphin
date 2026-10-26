import { getFFT, hann, olaGain, wrapPhase } from "../../lib/fft";

export class FreezeVocoder {
  readonly hop: number;
  private readonly n: number;
  private readonly spread: number;
  private readonly window: Float64Array;
  private readonly gain: number;
  private readonly fft;
  private readonly bins: number;
  private readonly re: Float64Array;
  private readonly im: Float64Array;
  private readonly mag: Float64Array;
  private readonly phase: Float64Array;
  private readonly prevPhase: Float64Array;
  private readonly omega: Float64Array;
  private readonly acc: Float64Array;
  private readonly ola: Float64Array;
  private readonly ready: Float32Array;
  private analysedAt = NaN;
  private started = false;

  constructor(n: number, spread: number) {
    this.n = n;
    this.spread = spread;
    this.hop = n / 4;
    this.window = hann(n);
    this.gain = olaGain(this.window, this.hop);
    this.fft = getFFT(n);
    this.bins = n / 2 + 1;
    this.re = new Float64Array(n);
    this.im = new Float64Array(n);
    this.mag = new Float64Array(this.bins);
    this.phase = new Float64Array(this.bins);
    this.prevPhase = new Float64Array(this.bins);
    this.omega = new Float64Array(this.bins);
    this.acc = new Float64Array(this.bins);
    this.ola = new Float64Array(n);
    this.ready = new Float32Array(this.hop);
  }

  private transform(x: Float32Array, start: number) {
    const { n, re, im, window } = this;
    for (let i = 0; i < n; i++) {
      const idx = start + i;
      re[i] = idx >= 0 && idx < x.length ? x[idx] * window[i] : 0;
      im[i] = 0;
    }
    this.fft(re, im);
  }

  private analyse(x: Float32Array, p: number) {
    const { n, hop, bins, re, im, mag, phase, prevPhase, omega, spread } = this;
    mag.fill(0);
    for (let j = -spread; j <= spread; j++) {
      this.transform(x, p + j * hop - n / 2);
      for (let k = 0; k < bins; k++) mag[k] += re[k] * re[k] + im[k] * im[k];
    }
    for (let k = 0; k < bins; k++) mag[k] = Math.sqrt(mag[k] / (2 * spread + 1));

    this.transform(x, p - hop - n / 2);
    for (let k = 0; k < bins; k++) prevPhase[k] = Math.atan2(im[k], re[k]);
    this.transform(x, p - n / 2);
    for (let k = 0; k < bins; k++) {
      phase[k] = Math.atan2(im[k], re[k]);
      const binOmega = (2 * Math.PI * k) / n;
      omega[k] = binOmega + wrapPhase(phase[k] - prevPhase[k] - binOmega * hop) / hop;
    }
  }

  frame(x: Float32Array, position: number): Float32Array {
    const { n, hop, bins, re, im, mag, acc, ola, window } = this;
    const p = Math.round(position);
    if (p !== this.analysedAt) {
      this.analyse(x, p);
      this.analysedAt = p;
    }
    if (!this.started) {
      acc.set(this.phase);
      this.started = true;
    } else for (let k = 0; k < bins; k++) acc[k] = wrapPhase(acc[k] + this.omega[k] * hop);

    for (let k = 0; k < bins; k++) {
      re[k] = mag[k] * Math.cos(acc[k]);
      im[k] = mag[k] * Math.sin(acc[k]);
      if (k > 0 && k < n / 2) {
        re[n - k] = re[k];
        im[n - k] = -im[k];
      }
    }
    im[0] = 0;
    im[n / 2] = 0;
    this.fft(re, im, true);

    for (let i = 0; i < n; i++) ola[i] += (re[i] * window[i]) / this.gain;
    for (let i = 0; i < hop; i++) this.ready[i] = ola[i];
    ola.copyWithin(0, hop);
    ola.fill(0, n - hop);
    return this.ready;
  }
}
