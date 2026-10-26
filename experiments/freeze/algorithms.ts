import { buildFreezeBuffer } from "./legacyGranular";
import { getCachedChannels } from "../../src/frontend/lib/channelCache";
import { analyze, hann, lockPhases, olaGain, rms, synthesize, trueFrequency, type Frame } from "../../src/frontend/lib/fft";

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
const PHASE = { random: 0, advance: 1, locked: 2, hybrid: 3 } as const;
const MAGNITUDE = { single: 0, average: 1, steady: 2 } as const;
const MOTION = { pingPong: 0, wander: 1, loop: 2 } as const;

const phaseParam = (fallback: number = PHASE.locked): ParamSpec => ({
  key: "phase",
  label: "Phase",
  default: fallback,
  options: [
    { value: PHASE.random, label: "Random" },
    { value: PHASE.advance, label: "Advance" },
    { value: PHASE.locked, label: "Locked" },
    { value: PHASE.hybrid, label: "Hybrid" },
  ],
});
const tonalityParam: ParamSpec = {
  key: "tonality",
  label: "Hybrid: tone threshold",
  default: 9,
  min: 1,
  max: 24,
  step: 1,
  unit: "dB",
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
const scanParams = (width: number, speed: number): ParamSpec[] => [
  { key: "widthMs", label: "Scan width", default: width, min: 10, max: 1000, step: 10, unit: "ms" },
  { key: "speed", label: "Scan speed", default: speed, min: 1, max: 100, step: 1, unit: "%" },
  {
    key: "motion",
    label: "Motion",
    default: MOTION.pingPong,
    options: [
      { value: MOTION.pingPong, label: "Ping-pong" },
      { value: MOTION.wander, label: "Wander" },
      { value: MOTION.loop, label: "Loop" },
    ],
  },
];

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

/**
 * A read head that drifts around `center` within `width` samples, `step`
 * samples per call: ping-pong, a random walk, or a forward loop.
 */
const createHead = (center: number, width: number, step: number, motion: number, random: () => number) => {
  const lo = center - width / 2;
  const hi = center + width / 2;
  let pos = center;
  let dir = 1;
  return () => {
    const current = Math.round(pos);
    if (motion === MOTION.wander) pos += (random() * 2 - 1) * step * 2;
    else if (motion === MOTION.loop) pos += step;
    else pos += dir * step;
    if (pos > hi) {
      if (motion === MOTION.loop) pos = lo + (pos - hi);
      else {
        pos = 2 * hi - pos;
        dir = -1;
      }
    }
    if (pos < lo) {
      pos = 2 * lo - pos;
      dir = 1;
    }
    pos = Math.min(hi, Math.max(lo, pos));
    return current;
  };
};

/** Bins near a peak that stands `thresholdDb` above the local spectral mean (sines vs noise). */
const tonalMask = (mag: Float64Array, thresholdDb: number) => {
  const bins = mag.length;
  const half = 16;
  const ratio = 10 ** (thresholdDb / 20);
  const prefix = new Float64Array(bins + 1);
  for (let k = 0; k < bins; k++) prefix[k + 1] = prefix[k] + mag[k];
  const mask = new Uint8Array(bins);
  for (let k = 1; k < bins - 1; k++) {
    if (mag[k] < mag[k - 1] || mag[k] < mag[k + 1]) continue;
    const a = Math.max(0, k - half);
    const b = Math.min(bins, k + half + 1);
    if (mag[k] > ((prefix[b] - prefix[a]) / (b - a)) * ratio)
      for (let j = Math.max(0, k - 2); j <= Math.min(bins - 1, k + 2); j++) mask[j] = 1;
  }
  return mask;
};

interface SpectralOptions {
  n: number;
  phase: number;
  magnitude: number;
  spread: number;
  outLen: number;
  seed: number;
  tonality?: number;
  /** Per-bin magnitude weight, e.g. a crossover band. */
  weight?: (k: number) => number;
  /** Re-analyse at a moving read head instead of holding one spectrum. */
  scan?: { width: number; step: number; motion: number };
}

interface Analysis {
  mag: Float64Array;
  omega: Float64Array;
  phase: Float64Array;
}

/** Hold one spectrum at `center` (one analysis for the whole freeze). */
const staticAnalysis = (x: Float32Array, center: number, opts: SpectralOptions, window: Float64Array): Analysis => {
  const { n } = opts;
  const hop = n / 4;
  const refStart =
    opts.magnitude === MAGNITUDE.steady ? findSteadyStart(x, center, n, opts.spread) : center - n / 2;
  const ref = analyze(x, refStart, n, window);
  const next = analyze(x, refStart + hop, n, window);
  const mag = Float64Array.from(next.mag);
  if (opts.magnitude === MAGNITUDE.average) {
    mag.fill(0);
    let count = 0;
    for (let s = center - opts.spread - n / 2; s <= center + opts.spread - n / 2; s += hop, count++) {
      const f = analyze(x, s, n, window);
      for (let k = 0; k < mag.length; k++) mag[k] += f.mag[k] * f.mag[k];
    }
    for (let k = 0; k < mag.length; k++) mag[k] = Math.sqrt(mag[k] / Math.max(1, count));
  }
  return { mag, omega: trueFrequency(ref.phase, next.phase, hop, n), phase: next.phase };
};

/** Phase-vocoder freeze: resynthesise a held (or slowly scanned) spectrum via overlap-add. */
const spectralFreeze = (x: Float32Array, center: number, opts: SpectralOptions) => {
  const { n, outLen, weight, scan } = opts;
  const window = hann(n);
  const hop = n / 4;
  const bins = n / 2 + 1;
  const random = mulberry32(opts.seed);
  const held = scan ? null : staticAnalysis(x, center, opts, window);
  const head = scan && createHead(center, scan.width, scan.step, scan.motion, mulberry32(opts.seed + 7));

  const out = new Float64Array(outLen);
  const gain = olaGain(window, hop);
  let acc: Float64Array | null = null;
  const phase = new Float64Array(bins);

  for (let t = 0; t < outLen; t += hop) {
    let a: Analysis;
    if (head) {
      const p = head();
      const prev = analyze(x, p - hop - n / 2, n, window);
      const cur = analyze(x, p - n / 2, n, window);
      a = { mag: cur.mag, omega: trueFrequency(prev.phase, cur.phase, hop, n), phase: cur.phase };
    } else a = held!;
    const mag = weight ? a.mag.map((m, k) => m * weight(k)) : a.mag;

    if (!acc) acc = Float64Array.from(a.phase);
    else for (let k = 0; k < bins; k++) acc[k] += a.omega[k] * hop;

    if (opts.phase === PHASE.random) {
      for (let k = 0; k < bins; k++) phase[k] = random() * 2 * Math.PI;
    } else if (opts.phase === PHASE.advance) {
      phase.set(acc);
    } else {
      phase.set(lockPhases(mag, a.phase, acc));
      if (opts.phase === PHASE.hybrid) {
        const tonal = tonalMask(mag, opts.tonality ?? 9);
        for (let k = 0; k < bins; k++) if (!tonal[k]) phase[k] = random() * 2 * Math.PI;
      }
    }
    const frame = synthesize(mag, phase, n);
    for (let i = 0; i < n; i++) out[(t + i) % outLen] += (frame[i] * window[i]) / gain;
  }
  return out;
};

const monoMix = (channels: Float32Array[]) => {
  const mono = new Float32Array(channels[0].length);
  for (const ch of channels) for (let i = 0; i < mono.length; i++) mono[i] += ch[i] / channels.length;
  return mono;
};

const at = (x: Float32Array, i: number) => (i >= 0 && i < x.length ? x[i] : 0);

/** Normalised cross-correlation of `len` samples (every 2nd sample, for speed). */
const correlation = (x: Float32Array, a: number, b: number, len: number) => {
  let ab = 0;
  let aa = 0;
  let bb = 0;
  for (let i = 0; i < len; i += 2) {
    const u = at(x, a + i);
    const v = at(x, b + i);
    ab += u * v;
    aa += u * u;
    bb += v * v;
  }
  return ab / Math.sqrt(aa * bb + 1e-12);
};

/**
 * WSOLA source positions: each segment starts near the drifting read head,
 * nudged within ±tolerance to best continue the previous segment.
 */
const wsolaPlan = (mono: Float32Array, center: number, sr: number, p: Params, outLen: number, seed: number) => {
  const len = Math.round((p.segmentMs / 1000) * sr);
  const hop = len / 2;
  const tolerance = Math.round((p.toleranceMs / 1000) * sr);
  const width = Math.round((p.widthMs / 1000) * sr);
  const head = createHead(center, width, (p.speed / 100) * hop, p.motion, mulberry32(seed));
  const positions: number[] = [];
  let prev = -1;
  for (let t = 0; t < outLen; t += hop) {
    const nominal = head();
    if (prev < 0) {
      positions.push((prev = nominal));
      continue;
    }
    let best = nominal;
    let bestScore = -Infinity;
    for (let s = nominal - tolerance; s <= nominal + tolerance; s++) {
      const score = correlation(mono, s, prev + hop, hop);
      if (score > bestScore) {
        bestScore = score;
        best = s;
      }
    }
    positions.push((prev = best));
  }
  return { len, hop, positions };
};

/** Strongest pitch period (samples, 40–1000 Hz) in 50 ms after `start`, by normalised autocorrelation. */
const findPeriod = (mono: Float32Array, start: number, sr: number) => {
  const win = Math.round(0.05 * sr);
  let best = Math.round(sr / 100);
  let bestScore = -Infinity;
  for (let lag = Math.round(sr / 1000); lag <= Math.round(sr / 40); lag++) {
    const score = correlation(mono, start, start + lag, win);
    if (score > bestScore) {
      bestScore = score;
      best = lag;
    }
  }
  return best;
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

const granular = (x: Float32Array, center: number, sr: number, p: Params, seed: number) => {
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
    for (let i = 0; i < grain; i++) out[(spawn + i) % outLen] += at(x, start + i) * window[i];
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

const ms = (v: number, sr: number) => Math.round((v / 1000) * sr);

export const ALGORITHMS: FreezeAlgorithm[] = [
  {
    id: "current",
    label: "Current",
    description: "Production granular freeze: random 150 ms grains from a 250 ms region, peak-normalised to 0.3.",
    params: [],
    run: (input, center, ctx) => buildFreezeBuffer(input, center, ctx as AudioContext),
  },
  {
    id: "scan",
    label: "Scan",
    description:
      "Phase vocoder at near-zero speed: the read head keeps drifting through a small window around the cursor and re-analyses every frame, so onsets and decays inside the window stay audible. Closest guess to AudioStretch.",
    params: [
      { key: "n", label: "Window", default: 4096, options: WINDOW_OPTIONS.slice(0, 3) },
      phaseParam(PHASE.hybrid),
      tonalityParam,
      ...scanParams(150, 8),
    ],
    run: (input, center, ctx, p) =>
      toBuffer(input, center, ctx, (ch, seed) =>
        spectralFreeze(ch, center, {
          n: p.n,
          phase: p.phase,
          magnitude: MAGNITUDE.single,
          spread: 0,
          tonality: p.tonality,
          outLen: outputLength(input.sampleRate, p.n / 4),
          seed,
          scan: { width: ms(p.widthMs, input.sampleRate), step: (p.speed / 100) * (p.n / 4), motion: p.motion },
        }),
      ),
  },
  {
    id: "wsola",
    label: "WSOLA",
    description:
      "Time-domain freeze (SoundTouch's method at tempo → 0): overlap-adds real slices of the recording, each picked to splice cleanly onto the last, so attacks and noise keep their texture.",
    params: [
      { key: "segmentMs", label: "Segment", default: 60, min: 10, max: 200, step: 5, unit: "ms" },
      { key: "toleranceMs", label: "Splice search", default: 8, min: 0, max: 30, step: 1, unit: "ms" },
      ...scanParams(150, 10),
    ],
    run: (input, center, ctx, p) => {
      const sr = input.sampleRate;
      const seed = (Math.random() * 2 ** 31) | 0;
      const hop = ms(p.segmentMs, sr) / 2;
      const outLen = outputLength(sr, hop);
      const plan = wsolaPlan(monoMix(getCachedChannels(input)), center, sr, p, outLen, seed);
      const window = hann(plan.len);
      return toBuffer(input, center, ctx, (ch) => {
        const out = new Float64Array(outLen);
        plan.positions.forEach((s, m) => {
          for (let i = 0; i < plan.len; i++) out[(m * plan.hop + i) % outLen] += at(ch, s + i) * window[i];
        });
        return out;
      });
    },
  },
  {
    id: "period",
    label: "Period loop",
    description:
      "Loops a whole number of pitch periods of the actual waveform at the cursor, crossfaded at the seam. The most literal freeze; best on held notes, buzzier on dense chords.",
    params: [
      { key: "loopMs", label: "Loop length", default: 80, min: 5, max: 500, step: 5, unit: "ms" },
      { key: "fadeMs", label: "Seam fade", default: 8, min: 1, max: 40, step: 1, unit: "ms" },
      { key: "offsetMs", label: "Offset", default: 0, min: -200, max: 200, step: 5, unit: "ms" },
    ],
    run: (input, center, ctx, p) => {
      const sr = input.sampleRate;
      const start = center + ms(p.offsetMs, sr);
      const period = findPeriod(monoMix(getCachedChannels(input)), start, sr);
      const len = Math.max(period, Math.round(ms(p.loopMs, sr) / period) * period);
      const fade = Math.min(ms(p.fadeMs, sr), Math.floor(len / 2));
      const outLen = Math.max(1, Math.floor((OUTPUT_SECONDS * sr) / len)) * len;
      return toBuffer(input, center, ctx, (ch) => {
        const loop = new Float64Array(len);
        for (let i = 0; i < len; i++) {
          const t = i < len - fade ? 0 : (i - (len - fade)) / fade;
          loop[i] = at(ch, start + i) * (1 - t) + at(ch, start + i - len) * t;
        }
        const out = new Float64Array(outLen);
        for (let i = 0; i < outLen; i++) out[i] = loop[i % len];
        return out;
      });
    },
  },
  {
    id: "spectral",
    label: "Spectral",
    description:
      "Holds one magnitude spectrum and resynthesises it. Advance/Locked keep each partial's true frequency; Random is Paulstretch-style; Hybrid randomises only the noisy bins.",
    params: [
      { key: "n", label: "Window", default: 8192, options: WINDOW_OPTIONS },
      phaseParam(),
      tonalityParam,
      magnitudeParam,
      spreadParam,
    ],
    run: (input, center, ctx, p) =>
      toBuffer(input, center, ctx, (ch, seed) =>
        spectralFreeze(ch, center, {
          n: p.n,
          phase: p.phase,
          magnitude: p.magnitude,
          spread: ms(p.spreadMs, input.sampleRate),
          tonality: p.tonality,
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
      phaseParam(),
      tonalityParam,
      magnitudeParam,
      spreadParam,
    ],
    run: (input, center, ctx, p) => {
      const sr = input.sampleRate;
      const outLen = outputLength(sr, p.low / 4);
      const base = {
        phase: p.phase,
        magnitude: p.magnitude,
        spread: ms(p.spreadMs, sr),
        tonality: p.tonality,
        outLen,
      };
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
];

export const defaultParams = (algo: FreezeAlgorithm): Params =>
  Object.fromEntries(algo.params.map((p) => [p.key, p.default]));
