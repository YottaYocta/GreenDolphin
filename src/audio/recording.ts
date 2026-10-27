import type { Audio, Recording } from "./interfaces";

let shared: AudioContext | null = null;
const buffers = new WeakMap<Recording, AudioBuffer>();

export function audioContext() {
  if (shared) return shared;
  const ctx = (shared = new AudioContext());
  document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && ctx.state !== "running" && void ctx.resume());
  return ctx;
}

export const bufferOf = (recording: Recording) => buffers.get(recording)!;

export const decode: Audio["decode"] = async (data) => {
  const buffer = await audioContext().decodeAudioData(data);
  const recording: Recording = {
    duration: buffer.duration,
    sampleRate: buffer.sampleRate,
    channelCount: buffer.numberOfChannels,
    length: buffer.length,
    readChannel: (into, channel, fromSample) => buffer.copyFromChannel(into, channel, fromSample),
  };
  buffers.set(recording, buffer);
  return recording;
};
