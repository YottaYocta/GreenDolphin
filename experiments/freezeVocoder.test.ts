import { expect, test } from "vitest";
import { FreezeVocoder } from "../src/frontend/playback/freeze/vocoder";

const sr = 44100;
const x = Float32Array.from({ length: sr }, (_, i) => 0.5 * Math.sin((2 * Math.PI * 330 * i) / sr));

test("holding the read position sustains a steady tone", () => {
  const v = new FreezeVocoder(2048, 2);
  for (let k = 0; k < 80; k++) {
    const out = v.frame(x, 20000);
    if (k < 4) continue;
    const level = Math.sqrt(out.reduce((a, s) => a + s * s, 0) / out.length);
    expect(level).toBeCloseTo(0.5 / Math.SQRT2, 1);
  }
});

test("moving the read position at 1x reproduces the recording", () => {
  const v = new FreezeVocoder(2048, 0);
  let err = 0;
  for (let k = 0; k < 30; k++) {
    const p = 8000 + k * v.hop;
    const out = v.frame(x, p);
    if (k < 4) continue;
    for (let i = 0; i < v.hop; i++) err = Math.max(err, Math.abs(out[i] - x[p - 1024 + i]));
  }
  expect(err).toBeLessThan(0.02);
});
