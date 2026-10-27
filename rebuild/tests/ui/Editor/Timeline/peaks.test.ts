import { expect, test } from "vitest";
import { buildPeaks } from "../../../../src/ui/Editor/Timeline/Waveform/peaks";

const fakeBuffer = (data: Float32Array) =>
  ({
    length: data.length,
    numberOfChannels: 1,
    sampleRate: 1000,
    copyFromChannel: (dest: Float32Array, _c: number, start = 0) => dest.set(data.subarray(start, start + dest.length)),
  }) as unknown as AudioBuffer;

test("peak levels hold mean |x| and halve in size until small", async () => {
  const data = Float32Array.from({ length: 200_000 }, (_, i) => (i < 100_000 ? 0.5 : -0.25));
  const { levels } = await buildPeaks(fakeBuffer(data));
  expect(levels[0][0].length).toBe(Math.ceil(200_000 / 64));
  expect(levels[0][0][0]).toBeCloseTo(0.5);
  expect(levels[0][0][levels[0][0].length - 1]).toBeCloseTo(0.25);
  expect(levels[levels.length - 1][0].length).toBeLessThanOrEqual(1024);
  for (let l = 1; l < levels.length; l++) expect(levels[l][0].length).toBe(Math.ceil(levels[l - 1][0].length / 2));
});
