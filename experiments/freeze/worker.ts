import { getCachedChannels } from "../../src/frontend/lib/channelCache";
import { bandSpectrum, compareSpectra } from "../dsp/spectrum";
import { ALGORITHMS } from "./algorithms";
import { MOMENT_SECONDS, type FreezeRequest, type WorkerMessage, type WorkerResult } from "./protocol";

// Workers have no Web Audio. The algorithms only read samples and allocate
// outputs, so a duck-typed AudioBuffer lets them run here unchanged.
const shim = (channels: Float32Array[], sampleRate: number) =>
  ({
    sampleRate,
    length: channels[0].length,
    numberOfChannels: channels.length,
    duration: channels[0].length / sampleRate,
    getChannelData: (i: number) => channels[i],
    copyFromChannel: (dest: Float32Array, i: number) => dest.set(channels[i]),
  }) as unknown as AudioBuffer;

const context = {
  createBuffer: (n: number, length: number, sampleRate: number) =>
    shim(Array.from({ length: n }, () => new Float32Array(length)), sampleRate),
} as unknown as BaseAudioContext;

let input: AudioBuffer | null = null;

const render = (seq: number, { id, at, params }: FreezeRequest): WorkerResult => {
  const sr = input!.sampleRate;
  const half = Math.round((MOMENT_SECONDS / 2) * sr);
  const t0 = performance.now();
  const out = ALGORITHMS.find((a) => a.id === id)!.run(input!, at, context, params);
  const ms = performance.now() - t0;
  const channels = getCachedChannels(out);
  const bands = bandSpectrum(channels, 0, Math.min(out.length, 2 * sr), sr);
  const source = bandSpectrum(getCachedChannels(input!), at - half, at + half, sr);
  return { seq, algo: id, channels, sampleRate: sr, ms, bands, source, comparison: compareSpectra(source, bands) };
};

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const msg = e.data;
  if (msg.type === "load") {
    input = shim(msg.channels, msg.sampleRate);
    return;
  }
  const result = render(msg.seq, msg.req);
  (self as unknown as Worker).postMessage(result, result.channels.map((c) => c.buffer));
};
