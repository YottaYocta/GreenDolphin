import { expect, test } from "vitest";
import { buildFreezeBuffer } from "../src/frontend/lib/freeze";
import { context, shim } from "./freeze/shim";

const sr = 44100;
const x = Float32Array.from(
  { length: sr * 2 },
  (_, i) => 0.4 * Math.sin((2 * Math.PI * 330.7 * i) / sr) + 0.2 * Math.sin((2 * Math.PI * 523.9 * i) / sr),
);
const out = buildFreezeBuffer(shim([x], sr), sr, context as AudioContext).getChannelData(0);

test("freeze level stays constant over the whole loop", () => {
  const block = Math.round(0.05 * sr);
  const levels: number[] = [];
  for (let s = 0; s + block <= out.length; s += block) {
    let e = 0;
    for (let i = s; i < s + block; i++) e += out[i] * out[i];
    levels.push(Math.sqrt(e / block));
  }
  expect(Math.max(...levels) / Math.min(...levels)).toBeLessThan(1.05);
});

test("loop wraps without a jump", () => {
  let maxStep = 0;
  for (let i = 1; i < out.length; i++) maxStep = Math.max(maxStep, Math.abs(out[i] - out[i - 1]));
  expect(Math.abs(out[0] - out[out.length - 1])).toBeLessThan(maxStep * 1.5);
});
