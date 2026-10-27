import { expect, test } from "vitest";
import type { Recording } from "../../../../src/audio";
import { buildPeaks } from "../../../../src/ui/Editor/Timeline/Waveform/peaks";

const fakeRecording = (data: Float32Array): Recording => ({
  duration: data.length / 1000,
  length: data.length,
  channelCount: 1,
  sampleRate: 1000,
  readChannel: (into, _channel, fromSample = 0) => into.set(data.subarray(fromSample, fromSample + into.length)),
});

test("peak levels hold mean |x| and halve in size until small", async () => {
  const data = Float32Array.from({ length: 200_000 }, (_, i) => (i < 100_000 ? 0.5 : -0.25));
  const { levels } = await buildPeaks(fakeRecording(data));
  expect(levels[0][0].length).toBe(Math.ceil(200_000 / 64));
  expect(levels[0][0][0]).toBeCloseTo(0.5);
  expect(levels[0][0][levels[0][0].length - 1]).toBeCloseTo(0.25);
  expect(levels[levels.length - 1][0].length).toBeLessThanOrEqual(1024);
  for (let l = 1; l < levels.length; l++) expect(levels[l][0].length).toBe(Math.ceil(levels[l - 1][0].length / 2));
});
