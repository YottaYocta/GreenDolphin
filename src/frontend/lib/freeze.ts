import { getCachedChannels } from "./channelCache";
import { getFFT, hann, olaGain, wrapPhase } from "./fft";

const WINDOW = 2048;
const HOP = WINDOW / 4;
const SPREAD_SECONDS = 0.02;
const OUTPUT_SECONDS = 6;

function freezeChannel(
  x: Float32Array,
  center: number,
  spread: number,
  outputSamples: number,
): Float32Array {
  const fft = getFFT(WINDOW);
  const window = hann(WINDOW);
  const gain = olaGain(window, HOP);
  const bins = WINDOW / 2 + 1;
  const re = new Float64Array(WINDOW);
  const im = new Float64Array(WINDOW);

  const transform = (start: number) => {
    for (let i = 0; i < WINDOW; i++) {
      const idx = start + i;
      re[i] = idx >= 0 && idx < x.length ? x[idx] * window[i] : 0;
      im[i] = 0;
    }
    fft(re, im);
  };

  const mag = new Float64Array(bins);
  for (let j = -spread; j <= spread; j++) {
    transform(center + j * HOP - WINDOW / 2);
    for (let k = 0; k < bins; k++) mag[k] += re[k] * re[k] + im[k] * im[k];
  }
  for (let k = 0; k < bins; k++) mag[k] = Math.sqrt(mag[k] / (2 * spread + 1));

  const prevPhase = new Float64Array(bins);
  transform(center - HOP - WINDOW / 2);
  for (let k = 0; k < bins; k++) prevPhase[k] = Math.atan2(im[k], re[k]);
  const phase = new Float64Array(bins);
  const omega = new Float64Array(bins);
  transform(center - WINDOW / 2);
  for (let k = 0; k < bins; k++) {
    phase[k] = Math.atan2(im[k], re[k]);
    const binOmega = (2 * Math.PI * k) / WINDOW;
    omega[k] =
      binOmega + wrapPhase(phase[k] - prevPhase[k] - binOmega * HOP) / HOP;
  }

  const peaks: number[] = [];
  for (let k = 2; k < bins - 2; k++) {
    if (
      mag[k] > mag[k - 1] &&
      mag[k] > mag[k - 2] &&
      mag[k] >= mag[k + 1] &&
      mag[k] >= mag[k + 2]
    )
      peaks.push(k);
  }
  const cycle = (2 * Math.PI) / outputSamples;
  const rate = new Float64Array(bins);
  let p = 0;
  for (let k = 0; k < bins; k++) {
    while (
      p + 1 < peaks.length &&
      Math.abs(peaks[p + 1] - k) < Math.abs(peaks[p] - k)
    )
      p++;
    const w = omega[peaks.length ? peaks[p] : k];
    rate[k] = Math.round(w / cycle) * cycle;
  }

  const output = new Float32Array(outputSamples);
  for (let t = 0; t < outputSamples; t += HOP) {
    for (let k = 0; k < bins; k++) {
      const angle = phase[k] + rate[k] * t;
      re[k] = mag[k] * Math.cos(angle);
      im[k] = mag[k] * Math.sin(angle);
      if (k > 0 && k < WINDOW / 2) {
        re[WINDOW - k] = re[k];
        im[WINDOW - k] = -im[k];
      }
    }
    im[0] = 0;
    im[WINDOW / 2] = 0;
    fft(re, im, true);
    for (let i = 0; i < WINDOW; i++)
      output[(t + i) % outputSamples] += (re[i] * window[i]) / gain;
  }
  return output;
}

export function buildFreezeBuffer(
  audioBuffer: AudioBuffer,
  centerSample: number,
  context: AudioContext,
): AudioBuffer {
  const sr = audioBuffer.sampleRate;
  const spread = Math.round((SPREAD_SECONDS * sr) / HOP);
  const outputSamples = Math.round((OUTPUT_SECONDS * sr) / HOP) * HOP;
  const outputBuffer = context.createBuffer(
    audioBuffer.numberOfChannels,
    outputSamples,
    sr,
  );
  getCachedChannels(audioBuffer).forEach((channel, c) =>
    outputBuffer.copyToChannel(
      freezeChannel(channel, centerSample, spread, outputSamples),
      c,
    ),
  );
  return outputBuffer;
}
