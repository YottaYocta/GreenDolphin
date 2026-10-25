import { buildFreezeBuffer } from "../../src/frontend/lib/freeze";
import { getCachedChannels } from "../../src/frontend/lib/channelCache";
import { analyze, hann, lockPhases, olaGain, rms, synthesize, trueFrequency, type Frame } from "../dsp/fft";

export interface ParamSpec {
  key: string;
  label: string;
  default: number;
  /** Discrete choices render as a segmented control; otherwise a slider. */
  options?: { value: number; label: string }[];
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}

export type Params = Record<string, number>;

export interface FreezeAlgorithm {
  id: string;
  label: string;
  description: string;
  params: ParamSpec[];
  run: (input: AudioBuffer, center: number, ctx: BaseAudioContext, params: Params) => AudioBuffer;
}

const OUTPUT_SECONDS = 6;
/** Span around the cursor whose loudness the freeze should match. */
const MOMENT_SECONDS = 0.3;

const WINDOW_OPTIONS = [2048, 4096, 8192, 16384, 32768].map((v) => ({ value: v, label: `${v / 1024}k` }));
const PHASE = { random: 0, advance: 1, locked: 2 } as const;
const MAGNITUDE = { single: 0, average: 1, steady: 2 } as const;

const phaseParam: ParamSpec = {
  key: "phase",
  label: "Phase",
  default: PHASE.locked,
  options: [
    { value: PHASE.random, label: "Random" },
    { value: PHASE.advance, label: "Advance" },
    { value: PHASE.locked, label: "Locked" },
  ],
};
const magnitudeParam: ParamSpec = {
  key: "magnitude",
  label: "Magnitudes",
  default: MAGNITUDE.average,
  options: [
    { value: MAGNITUDE.single, label: "Single" },
    { value: MAGNITUDE.average, label: "Average" },
    { value: MAGNITUDE.steady, label: "Steady" },
  ],
};
const spreadParam: ParamSpec = {
  key: "spreadMs",
  label: "Spread",
  default: 120,
  min: 10,
  max: 500,
  step: 10,
  unit: "ms",
};

/** Deterministic PRNG so every channel gets the same random sequence (keeps stereo coherent). */
const mulberry32 = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/** Normalised positive spectral flux between consecutive frames. */
const flux = (prev: Frame, cur: Frame) => {
  let rise = 0;
  let total = 0;
  for (let k = 0; k < cur.mag.length; k++) {
    rise += Math.max(0, cur.mag[k] - prev.mag[k]);
    total += cur.mag[k];
  }
  return total > 0 ? rise / total : 0;
};

/** Start sample of the least transient frame within ±spread of the cursor. */
export const findSteadyStart = (x: Float32Array, center: number, n: number, spread: number) => {
  const window = hann(n);
  const hop = n / 4;
  let best = center - n / 2;
  let bestFlux = Infinity;
  let prev = analyze(x, center - spread - n / 2 - hop, n, window);
  for (let s = center - spread - n / 2; s <= center + spread - n / 2; s += hop) {
    const cur = analyze(x, s, n, window);
    const f = flux(prev, cur);
    if (f < bestFlux) {
      bestFlux = f;
      best = s;
    }
    prev = cur;
  }
  return best;
};

interface SpectralOptions {
  n: number;
  phase: number;
  magnitude: number;
  spread: number;
  outLen: number;
  seed: number;
  /** Per-bin magnitude weight, e.g. a crossover band. */
  weight?: (k: number) => number;
}

/** Hold one spectrum at `center` and resynthesise it indefinitely via overlap-add. */
const spectralFreeze = (x: Float32Array, center: number, opts: SpectralOptions) => {
  const { n, outLen, weight } = opts;
  const window = hann(n);
  const hop = n / 4;
  const bins = n / 2 + 1;

  const refStart =
    opts.magnitude === MAGNITUDE.steady ? findSteadyStart(x, center, n, opts.spread) : center - n / 2;
  const ref = analyze(x, refStart, n, window);
  const next = analyze(x, refStart + hop, n, window);
  const omega = trueFrequency(ref.phase, next.phase, hop, n);

  const mag = new Float64Array(bins);
  if (opts.magnitude === MAGNITUDE.average) {
    let count = 0;
    for (let s = center - opts.spread - n / 2; s <= center + opts.spread - n / 2; s += hop, count++) {
      const f = analyze(x, s, n, window);
      for (let k = 0; k < bins; k++) mag[k] += f.mag[k] * f.mag[k];
    }
    for (let k = 0; k < bins; k++) mag[k] = Math.sqrt(mag[k] / Math.max(1, count));
  } else {
    mag.set(next.mag);
  }
  if (weight) for (let k = 0; k < bins; k++) mag[k] *= weight(k);

  const random = mulberry32(opts.seed);
  const out = new Float64Array(outLen);
  const gain = olaGain(window, hop);
  const acc = Float64Array.from(next.phase);
  const phase = new Float64Array(bins);

  for (let t = 0; t < outLen; t += hop) {
    if (opts.phase === PHASE.random) {
      for (let k = 0; k < bins; k++) phase[k] = random() * 2 * Math.PI;
    } else {
      for (let k = 0; k < bins; k++) acc[k] += omega[k] * hop;
      phase.set(opts.phase === PHASE.locked ? lockPhases(mag, next.phase, acc) : acc);
    }
    const frame = synthesize(mag, phase, n);
    for (let i = 0; i < n; i++) out[(t + i) % outLen] += (frame[i] * window[i]) / gain;
  }
  return out;
};

const toBuffer = (
  input: AudioBuffer,
  center: number,
  ctx: BaseAudioContext,
  render: (channel: Float32Array, seed: number) => Float64Array,
) => {
  const source = getCachedChannels(input);
  const seed = (Math.random() * 2 ** 31) | 0;
  const channels = source.map((ch) => render(ch, seed));

  const half = Math.round((MOMENT_SECONDS / 2) * input.sampleRate);
  const target = rms(source.map((ch) => rms(ch, Math.max(0, center - half), center + half)));
  const current = rms(channels.map((ch) => rms(ch)));
  let peak = 0;
  for (const ch of channels) for (const v of ch) peak = Math.max(peak, Math.abs(v));
  const g = current > 0 ? Math.min(target / current, 0.99 / Math.max(peak, 1e-9)) : 0;

  const buffer = ctx.createBuffer(channels.length, channels[0].length, input.sampleRate);
  channels.forEach((ch, i) => buffer.getChannelData(i).set(ch.map((v) => v * g)));
  return buffer;
};

/** Output length rounded to whole hops so wrapped overlap-add is seamless. */
const outputLength = (sr: number, hop: number) => Math.round((OUTPUT_SECONDS * sr) / hop) * hop;

const granular = (
  x: Float32Array,
  center: number,
  sr: number,
  p: Params,
  seed: number,
) => {
  const grain = Math.round((p.grainMs / 1000) * sr);
  const region = Math.max(grain + 1, Math.round((p.regionMs / 1000) * sr));
  const mid = p.steady ? findSteadyStart(x, center, 2048, region / 2) + 1024 : center;
  const regionStart = mid - Math.floor(region / 2);
  const window = hann(grain);
  const interval = Math.max(1, Math.floor(grain / p.density));
  const outLen = outputLength(sr, interval);
  const out = new Float64Array(outLen);
  const random = mulberry32(seed);
  for (let spawn = 0; spawn < outLen; spawn += interval) {
    const start = regionStart + Math.floor(random() * (region - grain));
    for (let i = 0; i < grain; i++) {
      const idx = Math.min(x.length - 1, Math.max(0, start + i));
      out[(spawn + i) % outLen] += x[idx] * window[i];
    }
  }
  return out;
};

const crossover = (fc: number, sr: number, n: number) => (k: number) => {
  const f = (k * sr) / n;
  const lo = fc / Math.SQRT2;
  const hi = fc * Math.SQRT2;
  if (f <= lo) return 1;
  if (f >= hi) return 0;
  return Math.cos(((Math.log2(f / lo) / Math.log2(hi / lo)) * Math.PI) / 2) ** 2;
};

export const ALGORITHMS: FreezeAlgorithm[] = [
  {
    id: "current",
    label: "Current",
    description: "Production granular freeze: random 150 ms grains from a 250 ms region, peak-normalised to 0.3.",
    params: [],
    run: (input, center, ctx) => buildFreezeBuffer(input, center, ctx as AudioContext),
  },
  {
    id: "granular",
    label: "Granular+",
    description:
      "Granular with tunable grains, stereo-coherent grain positions, loudness matched to the moment, optional transient-avoiding region.",
    params: [
      { key: "grainMs", label: "Grain", default: 300, min: 40, max: 800, step: 10, unit: "ms" },
      { key: "regionMs", label: "Region", default: 400, min: 60, max: 1500, step: 10, unit: "ms" },
      { key: "density", label: "Density", default: 6, min: 1, max: 30, step: 1, unit: "×" },
      {
        key: "steady",
        label: "Region",
        default: 1,
        options: [
          { value: 0, label: "Centered" },
          { value: 1, label: "Steady" },
        ],
      },
    ],
    run: (input, center, ctx, p) =>
      toBuffer(input, center, ctx, (ch, seed) => granular(ch, center, input.sampleRate, p, seed)),
  },
  {
    id: "spectral",
    label: "Spectral",
    description:
      "Phase-vocoder freeze: hold one magnitude spectrum and resynthesise. Advance/Locked keep each partial's true frequency; Random is Paulstretch-style.",
    params: [
      { key: "n", label: "Window", default: 8192, options: WINDOW_OPTIONS },
      phaseParam,
      magnitudeParam,
      spreadParam,
    ],
    run: (input, center, ctx, p) =>
      toBuffer(input, center, ctx, (ch, seed) =>
        spectralFreeze(ch, center, {
          n: p.n,
          phase: p.phase,
          magnitude: p.magnitude,
          spread: Math.round((p.spreadMs / 1000) * input.sampleRate),
          outLen: outputLength(input.sampleRate, p.n / 4),
          seed,
        }),
      ),
  },
  {
    id: "multires",
    label: "Multi-res",
    description:
      "Spectral freeze with a long window below the crossover (resolves bass partials) and a short one above (keeps highs crisp).",
    params: [
      { key: "low", label: "Low window", default: 32768, options: WINDOW_OPTIONS.slice(2) },
      { key: "high", label: "High window", default: 4096, options: WINDOW_OPTIONS.slice(0, 3) },
      { key: "fc", label: "Crossover", default: 300, min: 80, max: 1500, step: 10, unit: "Hz" },
      phaseParam,
      magnitudeParam,
      spreadParam,
    ],
    run: (input, center, ctx, p) => {
      const sr = input.sampleRate;
      const outLen = outputLength(sr, p.low / 4);
      const base = { phase: p.phase, magnitude: p.magnitude, spread: Math.round((p.spreadMs / 1000) * sr), outLen };
      return toBuffer(input, center, ctx, (ch, seed) => {
        const lowW = crossover(p.fc, sr, p.low);
        const highW = crossover(p.fc, sr, p.high);
        const low = spectralFreeze(ch, center, { ...base, n: p.low, seed, weight: lowW });
        const high = spectralFreeze(ch, center, { ...base, n: p.high, seed: seed + 1, weight: (k) => 1 - highW(k) });
        for (let i = 0; i < outLen; i++) low[i] += high[i];
        return low;
      });
    },
  },
];

export const defaultParams = (algo: FreezeAlgorithm): Params =>
  Object.fromEntries(algo.params.map((p) => [p.key, p.default]));
