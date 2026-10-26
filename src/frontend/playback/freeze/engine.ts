import processorUrl from "./processor.ts?worker&url";
import { PROCESSOR_NAME, type FreezeMessage } from "./protocol";

const FADE_SECONDS = 0.05;
const registered = new WeakMap<BaseAudioContext, Promise<void>>();

export const registerFreezeProcessor = (ctx: BaseAudioContext) => {
  if (!registered.has(ctx)) registered.set(ctx, ctx.audioWorklet.addModule(processorUrl));
  return registered.get(ctx)!;
};

/**
 * Realtime freeze: a phase-vocoder AudioWorklet that sustains the recording at
 * a read position, with no offline rendering. Requires `registerFreezeProcessor`.
 */
export const createFreeze = (ctx: AudioContext, buffer: AudioBuffer, destination: AudioNode) => {
  const node = new AudioWorkletNode(ctx, PROCESSOR_NAME, {
    numberOfInputs: 0,
    outputChannelCount: [buffer.numberOfChannels],
  });
  const gain = ctx.createGain();
  gain.gain.value = 0;
  node.connect(gain).connect(destination);

  const post = (msg: FreezeMessage, transfer: Transferable[] = []) => node.port.postMessage(msg, transfer);
  // copyFromChannel, not getChannelData: Brave's anti-fingerprinting farbles getChannelData reads.
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, c) => {
    const copy = new Float32Array(buffer.length);
    buffer.copyFromChannel(copy, c);
    return copy;
  });
  post({ type: "load", channels }, channels.map((c) => c.buffer));

  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  const fade = (to: number) => {
    const now = ctx.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(to, now + FADE_SECONDS);
  };

  return {
    /** Move the read head (in samples); `jump` cuts straight there, otherwise it glides. */
    seek: (position: number, jump = false) => post({ type: "seek", position, jump }),
    start: () => {
      clearTimeout(idleTimer);
      post({ type: "active", active: true });
      fade(1);
    },
    stop: () => {
      fade(0);
      idleTimer = setTimeout(() => post({ type: "active", active: false }), FADE_SECONDS * 1000 + 50);
    },
    dispose: () => {
      clearTimeout(idleTimer);
      post({ type: "active", active: false });
      node.disconnect();
      gain.disconnect();
    },
  };
};

export type Freeze = ReturnType<typeof createFreeze>;
