import { PhaseVocoder } from "../dsp/pv";
import { PROCESSOR_NAME, type ProcessorMessage, type RealtimeConfig } from "./realtimeProtocol";

// AudioWorkletGlobalScope isn't in the DOM lib.
declare const sampleRate: number;
declare function registerProcessor(name: string, ctor: unknown): void;
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
}

/** Seek glide time constant: smooths pointer steps into a continuous scrub. */
const GLIDE_SECONDS = 0.04;
const REPORT_BLOCKS = 16;

/** Sample FIFO per channel. */
class Fifo {
  private readonly buf: Float32Array;
  private read = 0;
  private write = 0;
  count = 0;
  constructor(size: number) {
    this.buf = new Float32Array(size);
  }
  push(data: Float32Array) {
    for (let i = 0; i < data.length; i++) {
      this.buf[this.write] = data[i];
      this.write = (this.write + 1) % this.buf.length;
    }
    this.count += data.length;
  }
  pushZeros(len: number) {
    this.write = (this.write + len) % this.buf.length;
    this.count += len;
  }
  /** Adds `len` samples into `out` (summing bands). */
  pullInto(out: Float32Array, len: number) {
    for (let i = 0; i < len; i++) {
      out[i] += this.buf[this.read];
      this.buf[this.read] = 0;
      this.read = (this.read + 1) % this.buf.length;
    }
    this.count -= len;
  }
}

interface Band {
  voices: PhaseVocoder[];
  fifos: Fifo[];
}

const crossoverWeights = (fc: number, n: number, low: boolean) => {
  const w = new Float64Array(n / 2 + 1);
  const lo = fc / Math.SQRT2;
  const hi = fc * Math.SQRT2;
  for (let k = 0; k < w.length; k++) {
    const f = (k * sampleRate) / n;
    const lowW = f <= lo ? 1 : f >= hi ? 0 : Math.cos(((Math.log2(f / lo) / Math.log2(hi / lo)) * Math.PI) / 2) ** 2;
    w[k] = low ? lowW : 1 - lowW;
  }
  return w;
};

class FreezeProcessor extends AudioWorkletProcessor {
  private channels: Float32Array[] = [];
  private config: RealtimeConfig | null = null;
  private bands: Band[] = [];
  private position = 0;
  private target: number | null = null;
  private anchor = 0;
  private rate = 0;
  private blocks = 0;
  private active = false;

  constructor() {
    super();
    this.port.onmessage = (e: MessageEvent<ProcessorMessage>) => {
      const msg = e.data;
      if (msg.type === "load") {
        this.channels = msg.channels;
        this.rebuild();
      } else if (msg.type === "config") {
        this.config = msg.config;
        this.rebuild();
      } else if (msg.type === "seek") {
        if (msg.jump) this.position = msg.position;
        this.target = msg.jump ? null : msg.position;
        this.anchor = msg.position;
      }
      else if (msg.type === "rate") this.rate = msg.rate;
      else this.active = msg.active;
    };
  }

  private rebuild() {
    const c = this.config;
    if (!c || this.channels.length === 0) return;
    const specs: { n: number; weight?: (n: number) => Float64Array }[] = c.multires
      ? [
          { n: c.low, weight: (n) => crossoverWeights(c.fc, n, true) },
          { n: c.n, weight: (n) => crossoverWeights(c.fc, n, false) },
        ]
      : [{ n: c.n }];
    const longest = Math.max(...specs.map((s) => s.n));
    this.bands = specs.map(({ n, weight }) => {
      const fifos = this.channels.map(() => new Fifo(longest * 2));
      // Delay shorter windows so every band lines up with the longest one.
      for (const f of fifos) f.pushZeros((longest - n) / 2);
      return { voices: this.channels.map(() => new PhaseVocoder(n, weight?.(n))), fifos };
    });
  }

  process(_inputs: Float32Array[][], outputs: Float32Array[][]) {
    const out = outputs[0];
    const block = out[0].length;
    const c = this.config;
    if (!c || this.bands.length === 0 || !this.active) return true;

    const length = this.channels[0].length;
    this.position += this.rate * block;
    if (this.target !== null) {
      this.position += (this.target - this.position) * (1 - Math.exp(-block / (GLIDE_SECONDS * sampleRate)));
      if (Math.abs(this.target - this.position) < 1) this.target = null;
    }
    const span = (c.spanMs / 1000) * sampleRate;
    if (span > 0 && this.target === null) {
      const lo = this.anchor - span / 2;
      const hi = this.anchor + span / 2;
      if (this.position > hi) {
        this.position = 2 * hi - this.position;
        this.rate = -Math.abs(this.rate);
      } else if (this.position < lo) {
        this.position = 2 * lo - this.position;
        this.rate = Math.abs(this.rate);
      }
    }
    this.position = Math.min(length, Math.max(0, this.position));

    for (const band of this.bands) {
      const hop = band.voices[0].hop;
      const opts = { phase: c.phase, spreadFrames: Math.round(((c.spreadMs / 1000) * sampleRate) / hop) };
      while (band.fifos[0].count < block) {
        band.voices.forEach((v, ch) => band.fifos[ch].push(v.frame(this.channels[ch], this.position, opts)));
      }
      band.fifos.forEach((f, ch) => f.pullInto(out[ch] ?? out[0], block));
    }

    if (++this.blocks % REPORT_BLOCKS === 0 && this.rate !== 0)
      this.port.postMessage(this.position);
    return true;
  }
}

registerProcessor(PROCESSOR_NAME, FreezeProcessor);
