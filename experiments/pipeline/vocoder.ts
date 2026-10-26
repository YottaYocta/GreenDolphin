import { analyze, hann, lockPhases, olaGain, synthesize, wrapPhase } from "../../src/frontend/lib/fft";

/**
 * Offline phase-vocoder time stretch + pitch shift (identity phase locking).
 * Stretches by pitch/speed, then resamples by pitch, so output length is input/speed.
 */
export const vocode = (input: Float32Array, speed: number, semitones: number, n = 4096): Float32Array => {
  const pitch = 2 ** (semitones / 12);
  const stretch = pitch / speed;
  const hs = n / 4;
  const ha = hs / stretch;
  const window = hann(n);
  const bins = n / 2 + 1;
  const frames = Math.ceil(input.length / ha);
  const stretched = new Float64Array(frames * hs + n);
  const gain = olaGain(window, hs);

  let prevPhase = new Float64Array(bins);
  let prevPos = -Math.round(ha);
  const acc = new Float64Array(bins);

  for (let m = 0; m < frames; m++) {
    const pos = Math.round(m * ha);
    const { mag, phase } = analyze(input, pos - n / 2, n, window);
    const d = Math.max(1, pos - prevPos);
    for (let k = 0; k < bins; k++) {
      const binOmega = (2 * Math.PI * k) / n;
      const omega = m === 0 ? binOmega : binOmega + wrapPhase(phase[k] - prevPhase[k] - binOmega * d) / d;
      acc[k] = m === 0 ? phase[k] : acc[k] + omega * hs;
    }
    const frame = synthesize(mag, lockPhases(mag, phase, acc), n);
    const out = m * hs;
    for (let i = 0; i < n; i++) stretched[out + i] += (frame[i] * window[i]) / gain;
    prevPhase = phase;
    prevPos = pos;
  }

  const outLen = Math.round(input.length / speed);
  const result = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const src = i * pitch + n / 2;
    const i0 = Math.floor(src);
    const frac = src - i0;
    result[i] = (stretched[i0] ?? 0) * (1 - frac) + (stretched[i0 + 1] ?? 0) * frac;
  }
  return result;
};
