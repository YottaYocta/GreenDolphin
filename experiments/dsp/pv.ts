import { getFFT, hann, olaGain, wrapPhase } from "./fft";

export const PV_PHASE = { random: 0, advance: 1, locked: 2 } as const;

export interface PVOptions {
  phase: number;
  /** Average magnitudes over ±`spreadFrames` hops around the read head (0 = single frame). */
  spreadFrames: number;
}

const MAG_CACHE = 48;

/**
 * Streaming phase vocoder for one channel: each `frame(p)` call analyses the
 * recording at read position `p` and returns the next `hop` output samples.
 * Holding `p` still freezes; advancing it by `hop` per frame plays back at 1×.
 * Buffers are preallocated so it is safe to run on the audio thread.
 */
export class PhaseVocoder {
  readonly hop: number;
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
  private readonly out: Float64Array;
  private readonly peaks: Int32Array;
  private readonly ola: Float64Array;
  private readonly ready: Float32Array;
  private readonly magCache = new Map<number, Float64Array>();
  private analysedAt = NaN;
  private started = false;

  readonly n: number;
  private readonly weight?: Float64Array;

  constructor(n: number, weight?: Float64Array) {
    this.n = n;
    this.weight = weight;
    this.hop = n / 4;
    this.window = hann(n);
    this.gain = olaGain(this.window, this.hop);
    this.fft = getFFT(n);
    this.bins = n / 2 + 1;
    const b = () => new Float64Array(this.bins);
    this.re = new Float64Array(n);
    this.im = new Float64Array(n);
    this.mag = b();
    this.phase = b();
    this.prevPhase = b();
    this.omega = b();
    this.acc = b();
    this.out = b();
    this.peaks = new Int32Array(this.bins);
    this.ola = new Float64Array(n);
    this.ready = new Float32Array(this.hop);
  }

  /** Windowed FFT of x[start..start+n) into re/im (zero outside the signal). */
  private transform(x: Float32Array, start: number) {
    const { n, re, im, window } = this;
    for (let i = 0; i < n; i++) {
      const idx = start + i;
      re[i] = idx >= 0 && idx < x.length ? x[idx] * window[i] : 0;
      im[i] = 0;
    }
    this.fft(re, im);
  }

  private phaseInto(target: Float64Array) {
    for (let k = 0; k < this.bins; k++) target[k] = Math.atan2(this.im[k], this.re[k]);
  }

  /** Magnitudes at a hop-grid position, cached so a moving head re-uses neighbours. */
  private gridMag(x: Float32Array, g: number) {
    let m = this.magCache.get(g);
    if (m) return m;
    this.transform(x, g * this.hop - this.n / 2);
    m = new Float64Array(this.bins);
    for (let k = 0; k < this.bins; k++) m[k] = Math.hypot(this.re[k], this.im[k]);
    this.magCache.set(g, m);
    if (this.magCache.size > MAG_CACHE) this.magCache.delete(this.magCache.keys().next().value!);
    return m;
  }

  private analyse(x: Float32Array, p: number, opts: PVOptions) {
    const { n, hop, bins, mag, omega } = this;
    this.transform(x, p - hop - n / 2);
    this.phaseInto(this.prevPhase);
    this.transform(x, p - n / 2);
    this.phaseInto(this.phase);
    for (let k = 0; k < bins; k++) {
      const binOmega = (2 * Math.PI * k) / n;
      omega[k] = binOmega + wrapPhase(this.phase[k] - this.prevPhase[k] - binOmega * hop) / hop;
    }
    if (opts.spreadFrames > 0) {
      mag.fill(0);
      const g0 = Math.round(p / hop);
      for (let g = g0 - opts.spreadFrames; g <= g0 + opts.spreadFrames; g++) {
        const m = this.gridMag(x, g);
        for (let k = 0; k < bins; k++) mag[k] += m[k] * m[k];
      }
      for (let k = 0; k < bins; k++) mag[k] = Math.sqrt(mag[k] / (2 * opts.spreadFrames + 1));
    } else {
      for (let k = 0; k < bins; k++) mag[k] = Math.hypot(this.re[k], this.im[k]);
    }
    if (this.weight) for (let k = 0; k < bins; k++) mag[k] *= this.weight[k];
  }

  /** Identity phase locking: every bin follows its nearest peak's accumulated phase. */
  private lock() {
    const { bins, mag, phase, acc, out, peaks } = this;
    let count = 0;
    for (let k = 2; k < bins - 2; k++) {
      if (mag[k] > mag[k - 1] && mag[k] > mag[k - 2] && mag[k] >= mag[k + 1] && mag[k] >= mag[k + 2])
        peaks[count++] = k;
    }
    if (count === 0) return out.set(acc);
    let p = 0;
    for (let k = 0; k < bins; k++) {
      while (p + 1 < count && Math.abs(peaks[p + 1] - k) < Math.abs(peaks[p] - k)) p++;
      const peak = peaks[p];
      out[k] = acc[peak] + (phase[k] - phase[peak]);
    }
  }

  frame(x: Float32Array, position: number, opts: PVOptions): Float32Array {
    const { n, hop, bins, re, im, mag, acc, out, ola, window } = this;
    const p = Math.round(position);
    if (p !== this.analysedAt) {
      this.analyse(x, p, opts);
      this.analysedAt = p;
    }
    if (!this.started) {
      acc.set(this.phase);
      this.started = true;
    } else for (let k = 0; k < bins; k++) acc[k] = wrapPhase(acc[k] + this.omega[k] * hop);

    if (opts.phase === PV_PHASE.random) for (let k = 0; k < bins; k++) out[k] = Math.random() * 2 * Math.PI;
    else if (opts.phase === PV_PHASE.advance) out.set(acc);
    else this.lock();

    for (let k = 0; k < bins; k++) {
      re[k] = mag[k] * Math.cos(out[k]);
      im[k] = mag[k] * Math.sin(out[k]);
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
