import { expect, test } from "vitest";
import { PV_PHASE, PhaseVocoder } from "./dsp/pv";

const sr = 44100;
const x = Float32Array.from({ length: sr }, (_, i) => 0.5 * Math.sin((2 * Math.PI * 330 * i) / sr));
const opts = { phase: PV_PHASE.locked, spreadFrames: 0 };

test("moving the read head at 1× reproduces the recording", () => {
  const pv = new PhaseVocoder(4096);
  const p0 = 8000;
  let err = 0;
  for (let k = 0; k < 20; k++) {
    const p = p0 + k * pv.hop;
    const out = pv.frame(x, p, opts);
    if (k < 4) continue;
    for (let i = 0; i < pv.hop; i++) err = Math.max(err, Math.abs(out[i] - x[p - pv.n / 2 + i]));
  }
  expect(err).toBeLessThan(0.02);
});

test("holding the read head sustains a steady tone", () => {
  const pv = new PhaseVocoder(4096);
  const levels: number[] = [];
  for (let k = 0; k < 60; k++) {
    const out = pv.frame(x, 20000, { ...opts, spreadFrames: 2 });
    if (k >= 4) levels.push(Math.sqrt(out.reduce((a, v) => a + v * v, 0) / out.length));
  }
  for (const l of levels) expect(l).toBeCloseTo(0.5 / Math.SQRT2, 1);
});
