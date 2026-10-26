import { FreezeVocoder } from "./vocoder";
import { PROCESSOR_NAME, type FreezeMessage } from "./protocol";

declare const sampleRate: number;
declare function registerProcessor(name: string, ctor: unknown): void;
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
}

const WINDOW = 2048;
const SPREAD_SECONDS = 0.02;
const GLIDE_SECONDS = 0.04;

class FreezeProcessor extends AudioWorkletProcessor {
  private channels: Float32Array[] = [];
  private voices: FreezeVocoder[] = [];
  private frames: Float32Array[] = [];
  private read = 0;
  private position = 0;
  private target: number | null = null;
  private active = false;

  constructor() {
    super();
    this.port.onmessage = (e: MessageEvent<FreezeMessage>) => {
      const msg = e.data;
      if (msg.type === "load") {
        this.channels = msg.channels;
        this.reset();
      } else if (msg.type === "active") this.active = msg.active;
      else if (msg.jump) {
        this.position = msg.position;
        this.target = null;
        this.reset();
      } else this.target = msg.position;
    };
  }

  private reset() {
    const hop = WINDOW / 4;
    const spread = Math.round((SPREAD_SECONDS * sampleRate) / hop);
    this.voices = this.channels.map(() => new FreezeVocoder(WINDOW, spread));
    this.read = hop;
  }

  process(_inputs: Float32Array[][], outputs: Float32Array[][]) {
    if (!this.active || this.voices.length === 0) return true;
    const out = outputs[0];
    const block = out[0].length;
    const hop = WINDOW / 4;

    if (this.target !== null) {
      this.position += (this.target - this.position) * (1 - Math.exp(-block / (GLIDE_SECONDS * sampleRate)));
      if (Math.abs(this.target - this.position) < 1) {
        this.position = this.target;
        this.target = null;
      }
    }

    for (let i = 0; i < block; i++) {
      if (this.read === hop) {
        for (let c = 0; c < this.voices.length; c++)
          this.frames[c] = this.voices[c].frame(this.channels[c], this.position);
        this.read = 0;
      }
      for (let c = 0; c < out.length; c++) out[c][i] = this.frames[c][this.read];
      this.read++;
    }
    return true;
  }
}

registerProcessor(PROCESSOR_NAME, FreezeProcessor);
