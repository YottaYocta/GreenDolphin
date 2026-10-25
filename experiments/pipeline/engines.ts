import { processOffline } from "@soundtouchjs/audio-worklet";
import soundTouchProcessorUrl from "@soundtouchjs/audio-worklet/processor?url";
import { vocode } from "./vocoder";

export { soundTouchProcessorUrl };

export interface Settings {
  semitones: number;
  speed: number;
}

/** Offline renderer: input buffer → processed buffer (length ≈ input / speed). */
export type Engine = (input: AudioBuffer, s: Settings) => Promise<AudioBuffer>;

export const soundTouchEngine: Engine = (input, { semitones, speed }) =>
  processOffline({
    input,
    processorUrl: soundTouchProcessorUrl,
    pitchSemitones: semitones,
    playbackRate: speed,
    stretchParameters: { overlapMs: 4 },
  });

export const vocoderEngine: Engine = async (input, { semitones, speed }) => {
  const channels = Array.from({ length: input.numberOfChannels }, (_, c) =>
    vocode(input.getChannelData(c), speed, semitones),
  );
  return toBuffer(channels, input.sampleRate);
};

export const ENGINES = { soundtouch: soundTouchEngine, vocoder: vocoderEngine } as const;
export type EngineId = keyof typeof ENGINES;
export const ENGINE_LABELS: Record<EngineId, string> = {
  soundtouch: "SoundTouch (OfflineAudioContext)",
  vocoder: "TS phase vocoder (main thread)",
};

export const toBuffer = (channels: Float32Array[], sampleRate: number) => {
  const out = new AudioBuffer({ length: Math.max(1, channels[0].length), numberOfChannels: channels.length, sampleRate });
  channels.forEach((ch, i) => out.copyToChannel(ch, i));
  return out;
};

/** Copy of `[from, to)` samples, zero-padded outside the buffer. */
export const slice = (buffer: AudioBuffer, from: number, to: number) => {
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, c) => {
    const src = buffer.getChannelData(c);
    const out = new Float32Array(to - from);
    const a = Math.max(0, from);
    const b = Math.min(src.length, to);
    if (b > a) out.set(src.subarray(a, b), a - from);
    return out;
  });
  return toBuffer(channels, buffer.sampleRate);
};

/** Output-sample delay of an engine, measured with an impulse. */
export const measureLatency = async (engine: Engine, s: Settings, sampleRate: number) => {
  const impulseAt = Math.round(0.25 * sampleRate);
  const probe = new Float32Array(sampleRate);
  probe[impulseAt] = 1;
  const out = (await engine(toBuffer([probe], sampleRate), s)).getChannelData(0);
  let peak = 0;
  for (let i = 1; i < out.length; i++) if (Math.abs(out[i]) > Math.abs(out[peak])) peak = i;
  return peak - Math.round(impulseAt / s.speed);
};

export interface ChunkPlan {
  /** Input sample where the chunk starts. */
  start: number;
  /** Chunk length in input samples. */
  length: number;
  /** Extra input rendered before the chunk and discarded, to warm the engine up. */
  preroll: number;
  /** Engine delay in output samples. */
  latency: number;
}

/** Render one chunk with preroll + latency compensation so consecutive chunks line up. */
export const renderChunk = async (engine: Engine, input: AudioBuffer, s: Settings, plan: ChunkPlan) => {
  const latencyIn = Math.max(0, Math.round(plan.latency * s.speed));
  const rendered = await engine(slice(input, plan.start - plan.preroll, plan.start + plan.length + latencyIn), s);
  const from = Math.round(plan.preroll / s.speed) + Math.max(0, plan.latency);
  const len = Math.round(plan.length / s.speed);
  return slice(rendered, from, from + len);
};

export const concat = (buffers: AudioBuffer[]) => {
  const total = buffers.reduce((a, b) => a + b.length, 0);
  const channels = Array.from({ length: buffers[0].numberOfChannels }, (_, c) => {
    const out = new Float32Array(total);
    let offset = 0;
    for (const b of buffers) {
      out.set(b.getChannelData(c), offset);
      offset += b.length;
    }
    return out;
  });
  return toBuffer(channels, buffers[0].sampleRate);
};
