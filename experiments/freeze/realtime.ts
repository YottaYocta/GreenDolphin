import processorUrl from "./pvProcessor.ts?worker&url";
import { PROCESSOR_NAME, type ProcessorMessage, type RealtimeConfig } from "./realtimeProtocol";

const FADE = 0.05;
const registered = new WeakMap<BaseAudioContext, Promise<void>>();

export const createRealtimeFreeze = async (ctx: AudioContext, buffer: AudioBuffer) => {
  if (!registered.has(ctx)) registered.set(ctx, ctx.audioWorklet.addModule(processorUrl));
  await registered.get(ctx);

  const node = new AudioWorkletNode(ctx, PROCESSOR_NAME, {
    numberOfInputs: 0,
    outputChannelCount: [buffer.numberOfChannels],
  });
  const gain = ctx.createGain();
  gain.gain.value = 0;
  node.connect(gain).connect(ctx.destination);

  const post = (msg: ProcessorMessage, transfer: Transferable[] = []) => node.port.postMessage(msg, transfer);
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, c) => buffer.getChannelData(c).slice());
  post({ type: "load", channels }, channels.map((c) => c.buffer));

  const fade = (to: number) => {
    const now = ctx.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(to, now + FADE);
  };

  return {
    configure: (config: RealtimeConfig) => post({ type: "config", config }),
    seek: (position: number, jump = false) => post({ type: "seek", position, jump }),
    setRate: (rate: number) => post({ type: "rate", rate }),
    /** Read-head position reports while it moves (~20 Hz). */
    onPosition: (cb: (position: number) => void) => {
      node.port.onmessage = (e: MessageEvent<number>) => cb(e.data);
    },
    start: () => {
      void ctx.resume();
      post({ type: "active", active: true });
      fade(1);
    },
    stop: () => {
      fade(0);
      setTimeout(() => post({ type: "active", active: false }), FADE * 1000 + 50);
    },
    dispose: () => {
      node.disconnect();
      gain.disconnect();
    },
  };
};

export type RealtimeFreeze = Awaited<ReturnType<typeof createRealtimeFreeze>>;
