import { getCachedChannels } from "../../src/frontend/lib/channelCache";
import { bandSpectrum, compareSpectra } from "../dsp/spectrum";
import { ALGORITHMS } from "./algorithms";
import { context, shim } from "./shim";
import { MOMENT_SECONDS, type FreezeRequest, type WorkerMessage, type WorkerResult } from "./protocol";

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
