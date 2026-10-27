import { createFFT, wrapPhase } from "./fft";
import type { CreateFreezeVocoder, FreezeVocoder } from "./interfaces";

export const createFreezeVocoder: CreateFreezeVocoder = (windowSize, spreadSamples) => new PhaseLockedVocoder(windowSize, spreadSamples);

class PhaseLockedVocoder implements FreezeVocoder {
  readonly hop: number;
  private readonly n: number;
  private readonly spread: number;
  private readonly fft;
  private readonly window: Float64Array;
  private readonly norm: number;
  private readonly re: Float64Array;
  private readonly im: Float64Array;
  private readonly mag: Float64Array;
  private readonly phase: Float64Array;
  private readonly omega: Float64Array;
  private readonly out: Float64Array;
  private readonly peakOf: Int32Array;
  private readonly ola: Float64Array;
  private readonly ready: Float32Array;
  private analysedAt = NaN;
  private started = false;

  constructor(n: number, spreadSamples: number) {
    this.n = n;
    this.hop = n / 4;
    this.spread = Math.round(spreadSamples / this.hop);
    this.fft = createFFT(n);
    this.window = Float64Array.from({ length: n }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n));
    this.norm = this.window.reduce((sum, w) => sum + w * w, 0) / this.hop;
    const bins = n / 2 + 1;
    [this.re, this.im, this.ola] = [new Float64Array(n), new Float64Array(n), new Float64Array(n)];
    [this.mag, this.phase, this.omega, this.out] = Array.from({ length: 4 }, () => new Float64Array(bins));
    this.peakOf = new Int32Array(bins);
    this.ready = new Float32Array(this.hop);
  }

  frame(x: Float32Array, atSample: number) {
    const { n, hop, re, im, mag, phase, omega, out, peakOf, ola, window } = this;
    const bins = n / 2 + 1;
    const p = Math.round(atSample);
    if (p !== this.analysedAt) {
      this.analyse(x, p);
      this.analysedAt = p;
    }
    for (let k = 0; k < bins; k++) {
      if (peakOf[k] !== k) continue;
      out[k] = this.started ? wrapPhase(out[k] + omega[k] * hop) : phase[k];
    }
    for (let k = 0; k < bins; k++) {
      const peak = peakOf[k];
      if (peak !== k) out[k] = out[peak] + phase[k] - phase[peak];
    }
    this.started = true;

    for (let k = 0; k < bins; k++) {
      re[k] = mag[k] * Math.cos(out[k]);
      im[k] = mag[k] * Math.sin(out[k]);
      if (k > 0 && k < n / 2) {
        re[n - k] = re[k];
        im[n - k] = -im[k];
      }
    }
    im[0] = im[n / 2] = 0;
    this.fft(re, im, true);
    for (let i = 0; i < n; i++) ola[i] += (re[i] * window[i]) / this.norm;
    this.ready.set(ola.subarray(0, hop));
    ola.copyWithin(0, hop);
    ola.fill(0, n - hop);
    return this.ready;
  }

  private transform(x: Float32Array, start: number) {
    for (let i = 0; i < this.n; i++) {
      const idx = start + i;
      this.re[i] = idx >= 0 && idx < x.length ? x[idx] * this.window[i] : 0;
      this.im[i] = 0;
    }
    this.fft(this.re, this.im);
  }

  private analyse(x: Float32Array, p: number) {
    const { n, hop, spread, re, im, mag, phase, omega, peakOf } = this;
    const bins = n / 2 + 1;
    mag.fill(0);
    for (let j = -spread; j <= spread; j++) {
      this.transform(x, p + j * hop - n / 2);
      for (let k = 0; k < bins; k++) mag[k] += re[k] * re[k] + im[k] * im[k];
    }
    for (let k = 0; k < bins; k++) mag[k] = Math.sqrt(mag[k] / (2 * spread + 1));

    this.transform(x, p - hop - n / 2);
    for (let k = 0; k < bins; k++) omega[k] = Math.atan2(im[k], re[k]);
    this.transform(x, p - n / 2);
    for (let k = 0; k < bins; k++) {
      phase[k] = Math.atan2(im[k], re[k]);
      const bin = (2 * Math.PI * k) / n;
      omega[k] = bin + wrapPhase(phase[k] - omega[k] - bin * hop) / hop;
    }

    let peak = -1;
    for (let k = 0; k < bins; k++) {
      const isPeak = k > 1 && k < bins - 2 && mag[k] > mag[k - 1] && mag[k] > mag[k - 2] && mag[k] >= mag[k + 1] && mag[k] >= mag[k + 2];
      if (isPeak) {
        for (let j = peak < 0 ? 0 : Math.ceil((peak + k) / 2); j < k; j++) peakOf[j] = k;
        peak = k;
      }
      peakOf[k] = peak < 0 ? k : peak;
    }
  }
}
