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
  pitchJitterCents: number,
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

    const cents = (Math.random() * 2 - 1) * pitchJitterCents;
    const rate = Math.pow(2, cents / 1200);

    const outGrainLen = Math.floor(grainSamples / rate);

    for (let i = 0; i < outGrainLen; i++) {
      const readPos = startInRegion + i * rate;
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

  let peak = 0;
  for (let i = 0; i < outputSamples; i++) {
    const abs = Math.abs(output[i]);
    if (abs > peak) peak = abs;
  }
  if (peak > 0) {
    const gain = 0.85 / peak;
    for (let i = 0; i < outputSamples; i++) {
      output[i] *= gain;
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
  const regionSamples = Math.round(0.1 * sr);
  const grainSamples = Math.round(0.075 * sr);
  const outputSamples = Math.round(6 * sr);
  const density = 20;
  const pitchJitterCents = 6;

  const numChannels = audioBuffer.numberOfChannels;
  const outputBuffer = context.createBuffer(numChannels, outputSamples, sr);

  for (let ch = 0; ch < numChannels; ch++) {
    const frozen = granularFreeze(
      audioBuffer.getChannelData(ch),
      centerSample,
      regionSamples,
      grainSamples,
      density,
      pitchJitterCents,
      outputSamples,
    );
    outputBuffer.getChannelData(ch).set(frozen);
  }

  return outputBuffer;
}
