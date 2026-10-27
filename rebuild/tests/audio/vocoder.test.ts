import { expect, test } from "vitest";
import { createFreezeVocoder } from "../../src/audio/vocoder";

const sr = 44100;
const chord = Float32Array.from(
  { length: sr },
  (_, i) => 0.4 * Math.sin((2 * Math.PI * 330.7 * i) / sr) + 0.2 * Math.sin((2 * Math.PI * 523.9 * i) / sr),
);
const rms = (x: Float32Array) => Math.sqrt(x.reduce((a, v) => a + v * v, 0) / x.length);

test("holding the read position is a static, steady snapshot", () => {
  const v = createFreezeVocoder(2048, 2);
  const levels: number[] = [];
  for (let k = 0; k < 400; k++) {
    const out = v.frame(chord, 20000);
    if (k >= 8) levels.push(rms(out));
  }
  const blocks = Array.from({ length: levels.length / 8 }, (_, b) => Math.hypot(...levels.slice(b * 8, b * 8 + 8)));
  expect(Math.max(...blocks) / Math.min(...blocks)).toBeLessThan(1.05);
  expect(levels[0]).toBeGreaterThan(0.2);
});

test("moving the read position at 1x reproduces the recording", () => {
  const v = createFreezeVocoder(2048, 0);
  let err = 0;
  for (let k = 0; k < 40; k++) {
    const p = 8000 + k * v.hop;
    const out = v.frame(chord, p);
    if (k < 4) continue;
    for (let i = 0; i < v.hop; i++) err = Math.max(err, Math.abs(out[i] - chord[p - 1024 + i]));
  }
  expect(err).toBeLessThan(0.03);
});
