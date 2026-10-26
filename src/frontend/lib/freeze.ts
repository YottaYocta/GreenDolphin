import { getCachedChannels } from "./channelCache";

function reflect(idx: number, length: number): number {
  if (idx < 0) return -idx;
  if (idx >= length) return length - 1 - (idx - length + 1);
  return Math.max(0, Math.min(length - 1, idx));
}

function buildHannWindow(size: number): Float32Array {
  const w = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (size - 1));
  }
  return w;
}

function granularFreeze(
  input: Float32Array,
  cursorSample: number,
  regionSamples: number,
  grainSamples: number,
  density: number,
  outputSamples: number,
): Float32Array {
  const region = new Float32Array(regionSamples);
  const halfRegion = Math.floor(regionSamples / 2);
  for (let i = 0; i < regionSamples; i++) {
    region[i] = input[reflect(cursorSample - halfRegion + i, input.length)];
  }

  const window = buildHannWindow(grainSamples);
  const output = new Float32Array(outputSamples);
  const spawnInterval = Math.max(1, Math.floor(grainSamples / density));

  for (let spawnPos = 0; spawnPos < outputSamples; spawnPos += spawnInterval) {
    const maxStart = Math.max(0, regionSamples - grainSamples);
    const startInRegion = Math.floor(Math.random() * (maxStart + 1));

    const outGrainLen = grainSamples;

    for (let i = 0; i < outGrainLen; i++) {
      const readPos = startInRegion + i;
      const i0 = Math.floor(readPos);
      const i1 = i0 + 1;
      if (i1 >= regionSamples) break;

      const frac = readPos - i0;
      const sample = region[i0] * (1 - frac) + region[i1] * frac;

      const envPos = (i / outGrainLen) * (grainSamples - 1);
      const e0 = Math.floor(envPos);
      const e1 = Math.min(grainSamples - 1, e0 + 1);
      const envFrac = envPos - e0;
      const env = window[e0] * (1 - envFrac) + window[e1] * envFrac;

      const outIdx = (spawnPos + i) % outputSamples;
      output[outIdx] += sample * env;
    }
  }

  return output;
}

export function buildFreezeBuffer(
  audioBuffer: AudioBuffer,
  centerSample: number,
  context: AudioContext,
): AudioBuffer {
  const sr = audioBuffer.sampleRate;
  const regionSamples = Math.round(0.25 * sr);
  const grainSamples = Math.round(0.15 * sr);
  const outputSamples = Math.round(6 * sr);
  const density = 20;

  const numChannels = audioBuffer.numberOfChannels;
  const outputBuffer = context.createBuffer(numChannels, outputSamples, sr);

  const clampedCenter = Math.max(
    Math.ceil(regionSamples / 2),
    Math.min(audioBuffer.length - Math.ceil(regionSamples / 2), centerSample),
  );

  const cached = getCachedChannels(audioBuffer);
  const channels = Array.from({ length: numChannels }, (_, ch) =>
    granularFreeze(
      cached[ch],
      clampedCenter,
      regionSamples,
      grainSamples,
      density,
      outputSamples,
    ),
  );

  const TARGET = 0.3;
  let peak = 0;
  for (const ch of channels)
    for (let i = 0; i < ch.length; i++) {
      const abs = Math.abs(ch[i]);
      if (abs > peak) peak = abs;
    }
  const gain = peak > TARGET ? TARGET / peak : 1;
  for (const ch of channels) {
    for (let i = 0; i < ch.length; i++) ch[i] *= gain;
    outputBuffer.getChannelData(channels.indexOf(ch)).set(ch);
  }

  return outputBuffer;
}
