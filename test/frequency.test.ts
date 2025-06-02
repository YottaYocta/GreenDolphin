import { expect, test } from "vitest";
import {
  FrequencyBucket,
  groupFrequencies,
  FrequencyData,
  createFrequencyData,
  fromArray,
  getAmplitude,
} from "../src/lib/frequency";

const FREQUENCY_RANGE = 44100 / 2;

test("Creating frequencydata using an array of floats returns a correct representation of the frequency data in floats", () => {
  const data = fromArray([0, 1, 2]);
  expect(getAmplitude(data, 0)).toEqual(0);
  expect(getAmplitude(data, 1)).toEqual(1);
  expect(getAmplitude(data, 2)).toEqual(2);
});

test("grouping 3 frequencies of -10 decibels into five pitches should produce five group frequencies each with -10 decibels", () => {
  const data: FrequencyData = createFrequencyData(3, -10);
  const groupings: FrequencyBucket[] = [
    { start: 0, end: 10 },
    { start: 10, end: 20 },
    { start: 20, end: 30 },
    { start: 30, end: 40 },
    { start: 40, end: 50 },
  ];
  const expected = createFrequencyData(5, -10);
  expect(groupFrequencies(data, FREQUENCY_RANGE, groupings)).toEqual(expected);
});

test("grouping of 3 frequencies at different decibels into four categories should produce correctly weighted groupings", () => {
  const data = fromArray([0, -10, -20]);
  const groupings: FrequencyBucket[] = [
    { start: 0, end: FREQUENCY_RANGE / 4 },
    { start: FREQUENCY_RANGE / 4, end: FREQUENCY_RANGE / 2 },
    { start: FREQUENCY_RANGE / 2, end: (FREQUENCY_RANGE / 4) * 3 },
    { start: (FREQUENCY_RANGE / 4) * 3, end: FREQUENCY_RANGE },
  ];
  const expected = fromArray([0, (-10 / 3) * 2, (-10 * 2 + -20 * 1) / 3, -20]);
  expect(groupFrequencies(data, FREQUENCY_RANGE, groupings)).toEqual(expected);
});

test("grouping of 3 frequencies at different decibels into four groups with offset produces correctly weighted groups", () => {
  const data = fromArray([0, -10, -20, -30, -40]);
  const offset = FREQUENCY_RANGE / 8;
  const groupings: FrequencyBucket[] = [
    { start: offset, end: FREQUENCY_RANGE / 4 + offset },
    { start: FREQUENCY_RANGE / 4 + offset, end: FREQUENCY_RANGE / 2 + offset },
    {
      start: FREQUENCY_RANGE / 2 + offset,
      end: (FREQUENCY_RANGE / 4) * 3 + offset,
    },
    {
      start: (FREQUENCY_RANGE / 4) * 3 + offset,
      end: FREQUENCY_RANGE + offset,
    },
  ];

  // data is            0-1/5, 1/5-2/5, 2/5-3/5, 3/5-4/5, and 4/5-5/5
  // groupings are      1/8-3/8, 3/8-5/8, 5/8-7/8, and 7/8-9/8
  /**
   * resulting values should be:
   * [0]: (0 * (1/5 - 1/8) + (-10) * (3/8 - 1/5)) / (3/8 - 1/8)
   * [1]: (-10 * (2/5 - 3/8) + (-20) * (5/8 - 2/5)) / (5/8 - 3/8)
   * [2]: (-20 * (3/5 - 5/8) + (-30) * (4/5 - 3/5) + (-40) * (7/8 - 4/5)) / (7/8 - 5/8)
   * [4:] (-40 * (1 - 7/8) + 0 * (9/8 - 1)) / (9/8 - 7/8)
   */

  const expected = fromArray([
    (0 * (1 / 5 - 1 / 8) + -10 * (3 / 8 - 1 / 5)) / (3 / 8 - 1 / 8),
    (-10 * (2 / 5 - 3 / 8) + -20 * (3 / 5 - 2 / 5) + -30 * (5 / 8 - 3 / 5)) /
      (5 / 8 - 3 / 8),
    (-30 * (4 / 5 - 5 / 8) + -40 * (7 / 8 - 4 / 5)) / (7 / 8 - 5 / 8),
    (-40 * (1 - 7 / 8) + 0 * (9 / 8 - 1)) / (9 / 8 - 7 / 8),
  ]);
  expect(groupFrequencies(data, FREQUENCY_RANGE, groupings)).toEqual(expected);
});
