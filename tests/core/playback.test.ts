import { expect, test } from "vitest";
import { core, type Playback } from "../../src/core";

const base: Playback = { mode: "playing", anchorPosition: 12, anchorTime: 100, rate: 0.5, loop: { start: 10, end: 20 }, loopWraps: true };

test("the playhead follows the trajectory while playing and holds otherwise", () => {
  expect(core.positionAt(base, 104)).toBe(14);
  expect(core.positionAt({ ...base, mode: "frozen" }, 104)).toBe(12);
  expect(core.positionAt({ ...base, mode: "silent" }, 104)).toBe(12);
});

test("wrapping loops wrap; non-wrapping loops hold at the loop end", () => {
  expect(core.positionAt(base, 100 + 2 * 9)).toBeCloseTo(11);
  expect(core.positionAt({ ...base, loopWraps: false }, 100 + 2 * 9)).toBe(20);
});

test("a playhead that starts outside the loop is not pulled into it", () => {
  expect(core.positionAt({ ...base, anchorPosition: 25 }, 102)).toBe(26);
});

test("re-anchoring on the same trajectory continues; anything else is a jump", () => {
  const later = { ...base, anchorTime: 104, anchorPosition: core.positionAt(base, 104) };
  expect(core.continues(base, later)).toBe(true);
  expect(core.continues(base, { ...later, rate: 2 })).toBe(true);
  expect(core.continues(base, { ...later, anchorPosition: 15 })).toBe(false);
  expect(core.continues(base, { ...later, mode: "frozen" })).toBe(false);
});
