import { fft, ifft, hannWindow } from "./fft";

const FFT_SIZE = 8192;
const NUM_GRAINS = 64;
const HOP_SIZE = FFT_SIZE / 4;

export function buildFreezeBuffer(
  audioBuffer: AudioBuffer,
  centerSample: number,
  context: AudioContext,
): AudioBuffer {
  const sampleRate = audioBuffer.sampleRate;
  const numChannels = audioBuffer.numberOfChannels;
  const outputLength = NUM_GRAINS * HOP_SIZE + FFT_SIZE;
  const hann = hannWindow(FFT_SIZE);

  const outputBuffer = context.createBuffer(
    numChannels,
    outputLength,
    sampleRate,
  );

  const windowStart = Math.max(0, centerSample - FFT_SIZE / 2);
  const windowEnd = Math.min(audioBuffer.length, windowStart + FFT_SIZE);
  const actualSize = windowEnd - windowStart;

  for (let ch = 0; ch < numChannels; ch++) {
    const src = audioBuffer.getChannelData(ch);
    const out = outputBuffer.getChannelData(ch);

    const real = new Float64Array(FFT_SIZE);
    const imag = new Float64Array(FFT_SIZE);
    for (let i = 0; i < actualSize; i++) {
      real[i] = src[windowStart + i] * hann[i];
    }
    fft(real, imag);

    const mag = new Float64Array(FFT_SIZE);
    for (let k = 0; k < FFT_SIZE; k++) {
      mag[k] = Math.sqrt(real[k] * real[k] + imag[k] * imag[k]);
    }

    const grainReal = new Float64Array(FFT_SIZE);
    const grainImag = new Float64Array(FFT_SIZE);

    for (let g = 0; g < NUM_GRAINS; g++) {
      for (let k = 0; k < FFT_SIZE; k++) {
        const phase = Math.random() * 2 * Math.PI;
        grainReal[k] = mag[k] * Math.cos(phase);
        grainImag[k] = mag[k] * Math.sin(phase);
      }

      ifft(grainReal, grainImag);

      const offset = g * HOP_SIZE;
      for (let i = 0; i < FFT_SIZE; i++) {
        out[offset + i] += grainReal[i] * hann[i];
      }

      grainReal.fill(0);
      grainImag.fill(0);
    }

    let peak = 0;
    for (let i = 0; i < outputLength; i++) {
      const abs = Math.abs(out[i]);
      if (abs > peak) peak = abs;
    }
    if (peak > 0) {
      for (let i = 0; i < outputLength; i++) {
        out[i] /= peak;
      }
    }
  }

  return outputBuffer;
}
