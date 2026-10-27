import { FreezeVocoder } from "./vocoder";

declare const sampleRate: number;
declare function registerProcessor(name: string, ctor: unknown): void;
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
}

import type { RecordingSeconds } from "../core";

export type FreezeMessage =
  | { type: "load"; channels: Float32Array[] }
  | { type: "seek"; position: RecordingSeconds; jump: boolean }
  | { type: "active"; active: boolean };

const WINDOW = 2048;
const SPREAD_SECONDS = 0.02;
const GLIDE_SECONDS = 0.04;

class FreezeProcessor extends AudioWorkletProcessor {
  private channels: Float32Array[] = [];
  private voices: FreezeVocoder[] = [];
  private frames: Float32Array[] = [];
  private read = 0;
  private position = 0;
  private target = 0;
  private active = false;

  constructor() {
    super();
    this.port.onmessage = ({ data }: MessageEvent<FreezeMessage>) => {
      if (data.type === "load") this.channels = data.channels;
      else if (data.type === "active") this.active = data.active;
      else {
        this.target = data.position * sampleRate;
        if (data.jump) this.reset();
      }
    };
  }

  private reset() {
    const spread = Math.round((SPREAD_SECONDS * sampleRate) / (WINDOW / 4));
    this.voices = this.channels.map(() => new FreezeVocoder(WINDOW, spread));
    this.position = this.target;
    this.read = WINDOW / 4;
  }

  process(_inputs: Float32Array[][], outputs: Float32Array[][]) {
    const out = outputs[0];
    if (!this.active || this.voices.length === 0) return true;
    const block = out[0].length;
    const glide = 1 - Math.exp(-block / (GLIDE_SECONDS * sampleRate));
    this.position += (this.target - this.position) * glide;
    for (let i = 0; i < block; i++) {
      if (this.read === WINDOW / 4) {
        this.voices.forEach((v, c) => (this.frames[c] = v.frame(this.channels[c], this.position)));
        this.read = 0;
      }
      for (let c = 0; c < out.length; c++) out[c][i] = this.frames[Math.min(c, this.frames.length - 1)][this.read];
      this.read++;
    }
    return true;
  }
}

registerProcessor("gd-freeze", FreezeProcessor);
