import { expect, test } from "vitest";
import { analyze, getFFT, hann, synthesize } from "../src/frontend/lib/fft";
import { vocode } from "./pipeline/vocoder";

const sine = (len: number, freq: number, sr = 44100) =>
  Float32Array.from({ length: len }, (_, i) => Math.sin((2 * Math.PI * freq * i) / sr));

test("FFT forward + inverse round-trips", () => {
  const n = 1024;
  const re = Float64Array.from({ length: n }, () => Math.random() - 0.5);
  const original = Float64Array.from(re);
  const im = new Float64Array(n);
  getFFT(n)(re, im);
  getFFT(n)(re, im, true);
  re.forEach((v, i) => expect(v).toBeCloseTo(original[i], 9));
});

test("analyze + synthesize recovers the windowed frame", () => {
  const n = 2048;
  const x = sine(n, 440);
  const w = hann(n);
  const { mag, phase } = analyze(x, 0, n, w);
  const y = synthesize(mag, phase, n);
  y.forEach((v, i) => expect(v).toBeCloseTo(x[i] * w[i], 6));
});

test("vocoder at neutral settings preserves a sine", () => {
  const x = sine(44100, 440);
  const y = vocode(x, 1, 0);
  expect(y.length).toBe(x.length);
  let err = 0;
  for (let i = 4096; i < x.length - 4096; i++) err = Math.max(err, Math.abs(y[i] - x[i]));
  expect(err).toBeLessThan(0.05);
});

test("vocoder speed halves duration, pitch shift moves the peak bin", () => {
  expect(vocode(sine(44100, 440), 2, 0).length).toBe(22050);
  const n = 8192;
  const y = vocode(sine(44100, 440), 1, 12);
  const { mag } = analyze(y, 16384, n, hann(n));
  const peak = mag.indexOf(Math.max(...mag));
  expect((peak * 44100) / n).toBeCloseTo(880, -1);
});
