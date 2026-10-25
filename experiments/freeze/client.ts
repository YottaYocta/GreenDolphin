import { toBuffer } from "../pipeline/engines";
import type { FreezeRequest, WorkerMessage, WorkerResult } from "./protocol";

export type FreezeResult = Omit<WorkerResult, "seq" | "channels" | "sampleRate"> & { buffer: AudioBuffer };

/** Off-main-thread freeze renderer holding its own copy of the recording. */
export const createFreezeWorker = (buffer: AudioBuffer) => {
  const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, c) => buffer.getChannelData(c).slice());
  const post = (msg: WorkerMessage, transfer: Transferable[] = []) => worker.postMessage(msg, transfer);
  post({ type: "load", channels, sampleRate: buffer.sampleRate }, channels.map((c) => c.buffer));

  let seq = 0;
  const pending = new Map<number, (r: FreezeResult) => void>();
  worker.onmessage = (e: MessageEvent<WorkerResult>) => {
    const { seq: id, channels: out, sampleRate, ...rest } = e.data;
    pending.get(id)?.({ ...rest, buffer: toBuffer(out, sampleRate) });
    pending.delete(id);
  };

  return {
    render: (req: FreezeRequest) =>
      new Promise<FreezeResult>((resolve) => {
        pending.set(++seq, resolve);
        post({ type: "render", seq, req });
      }),
    terminate: () => worker.terminate(),
  };
};

export type FreezeWorker = ReturnType<typeof createFreezeWorker>;
