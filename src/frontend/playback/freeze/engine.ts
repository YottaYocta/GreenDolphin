import processorUrl from "./processor.ts?worker&url";
import { PROCESSOR_NAME, type ProcessorMessage, type RealtimeConfig } from "./protocol";

const FADE = 0.05;
const registered = new WeakMap<BaseAudioContext, Promise<void>>();

/**
 * Settings tuned by ear in the experiments playground: short window, natural
 * phase advance, light averaging, and a read head creeping at 10% within a
 * small span so the freeze stays alive without drifting off the moment.
 */
export const FREEZE_CONFIG: RealtimeConfig = {
  n: 2048,
  phase: 1,
  spreadMs: 20,
  multires: 0,
  low: 16384,
  fc: 300,
  spanMs: 250,
};
export const FREEZE_RATE = 0.1;

export const registerFreezeProcessor = (ctx: BaseAudioContext) => {
  if (!registered.has(ctx)) registered.set(ctx, ctx.audioWorklet.addModule(processorUrl));
  return registered.get(ctx)!;
};

/**
 * Streaming phase-vocoder freeze running in an AudioWorklet; no offline
 * rendering. Requires `registerFreezeProcessor(ctx)` to have resolved.
 */
export const createRealtimeFreeze = (ctx: AudioContext, buffer: AudioBuffer, destination: AudioNode) => {
  const node = new AudioWorkletNode(ctx, PROCESSOR_NAME, {
    numberOfInputs: 0,
    outputChannelCount: [buffer.numberOfChannels],
  });
  const gain = ctx.createGain();
  gain.gain.value = 0;
  node.connect(gain).connect(destination);

  const post = (msg: ProcessorMessage, transfer: Transferable[] = []) => node.port.postMessage(msg, transfer);
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, c) => buffer.getChannelData(c).slice());
  post({ type: "load", channels }, channels.map((c) => c.buffer));

  let idleTimer: ReturnType<typeof setTimeout> | undefined;
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
      clearTimeout(idleTimer);
      void ctx.resume();
      post({ type: "active", active: true });
      fade(1);
    },
    stop: () => {
      fade(0);
      idleTimer = setTimeout(() => post({ type: "active", active: false }), FADE * 1000 + 50);
    },
    dispose: () => {
      clearTimeout(idleTimer);
      post({ type: "active", active: false });
      node.disconnect();
      gain.disconnect();
    },
  };
};

export type RealtimeFreeze = ReturnType<typeof createRealtimeFreeze>;
