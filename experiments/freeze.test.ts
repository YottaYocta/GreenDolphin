import { expect, test } from "vitest";
import { ALGORITHMS, defaultParams } from "./freeze/algorithms";
import { context, shim } from "./freeze/shim";

const sr = 44100;
// A plucked-ish 220 Hz tone with noise, so tonal and noisy paths both run.
const signal = Float32Array.from({ length: sr * 2 }, (_, i) =>
  0.5 * Math.sin((2 * Math.PI * 220 * i) / sr) * Math.exp(-((i % sr) / sr) * 3) + 0.05 * (Math.random() - 0.5),
);
const input = shim([signal, signal.slice()], sr);

test.each(ALGORITHMS.map((a) => [a.id, a]))("%s renders finite, audible output", (_, algo) => {
  const out = algo.run(input, sr / 2, context, defaultParams(algo));
  expect(out.length).toBeGreaterThan(sr);
  const ch = out.getChannelData(0);
  let energy = 0;
  for (const v of ch) energy += v * v;
  expect(Number.isFinite(energy)).toBe(true);
  expect(Math.sqrt(energy / ch.length)).toBeGreaterThan(0.001);
});
