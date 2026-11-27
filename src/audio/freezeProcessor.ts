import type { FreezeMessage, FreezeVocoder } from "./interfaces";
import { createFreezeVocoder } from "./vocoder";

declare const sampleRate: number;
declare function registerProcessor(name: string, ctor: unknown): void;
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
}

const WINDOW = 4096;
const SPREAD_SECONDS = 0.05;
const GLIDE_SECONDS = 0.015;

class FreezeProcessor extends AudioWorkletProcessor {
  private channels: Float32Array[] = [];
  private firstSample = 0;
  private voices: FreezeVocoder[] = [];
  private frames: Float32Array[] = [];
  private next: Float32Array[] = [];
  private read = 0;
  private hop = 0;
  private position = 0;
  private target = 0;
  private active = false;
  private unloaded = false;

  constructor() {
    super();
    this.port.onmessage = ({ data }: MessageEvent<FreezeMessage>) => {
      if (data.type === "load") Object.assign(this, { channels: data.channels, firstSample: data.firstSample });
      else if (data.type === "active") this.active = data.active;
      else if (data.type === "unload") this.unload();
      else {
        this.target = data.position * sampleRate;
        if (data.jump) this.reset();
      }
    };
  }

  private unload() {
    this.port.postMessage(null, this.channels.map((c) => c.buffer));
    this.channels = [];
    this.voices = [];
    this.unloaded = true;
  }

  private reset() {
    this.voices = this.channels.map(() => createFreezeVocoder(WINDOW, SPREAD_SECONDS * sampleRate));
    this.hop = this.voices[0]?.hop ?? 0;
    this.position = this.target;
    this.frames = this.voices.map((v, c) => Float32Array.from(v.frame(this.channels[c], this.position, this.firstSample)));
    this.read = 0;
  }

  process(_inputs: Float32Array[][], outputs: Float32Array[][]) {
    const out = outputs[0];
    if (!this.active || this.voices.length === 0) return !this.unloaded;
    const block = out[0].length;
    const glide = 1 - Math.exp(-block / (GLIDE_SECONDS * sampleRate));
    const reach = WINDOW / 2 + SPREAD_SECONDS * sampleRate + this.hop;
    const lastSample = this.firstSample + (this.channels[0]?.length ?? 0);
    const glided = this.position + (this.target - this.position) * glide;
    this.position = Math.min(Math.max(glided, Math.min(this.target, this.firstSample + reach)), Math.max(this.target, lastSample - reach));
    const count = this.voices.length;
    for (let i = 0; i < block; i++) {
      for (let c = 0; c < count; c++) if (this.read === Math.floor((c * this.hop) / count)) this.next[c] = this.voices[c].frame(this.channels[c], this.position, this.firstSample);
      for (let c = 0; c < out.length; c++) out[c][i] = this.frames[Math.min(c, count - 1)][this.read];
      if (++this.read < this.hop) continue;
      this.frames.forEach((frame, c) => frame.set(this.next[c]));
      this.read = 0;
    }
    return true;
  }
}

registerProcessor("gd-freeze", FreezeProcessor);
