import { expect, test } from "vitest";
import { FULL, MIN_LOOP, fit, isFull, pan, rescale, resizeLoop, shiftLoop, toFraction, toSection, zoom } from "../../../../src/ui/Editor/Timeline/geometry";

const D = 100;

test("fit shifts a section into bounds and keeps its length", () => {
  expect(fit({ start: -5, end: 15 }, { start: 0, end: D })).toEqual({ start: 0, end: 20 });
  expect(fit({ start: 95, end: 115 }, { start: 0, end: D })).toEqual({ start: 80, end: 100 });
  expect(fit({ start: -10, end: 200 }, { start: 0, end: D })).toEqual({ start: 0, end: 100 });
});

test("zoom keeps the anchor fixed and respects limits", () => {
  const v = zoom({ start: 0, end: 100 }, 0.25, 0.5, D);
  expect(v).toEqual({ start: 12.5, end: 62.5 });
  expect(zoom({ start: 40, end: 60 }, 0.5, 0.0001, D)).toEqual({ start: 49.75, end: 50.25 });
  expect(zoom({ start: 40, end: 60 }, 0.5, 100, D)).toEqual({ start: 0, end: 100 });
});

test("pan clamps to the recording", () => {
  expect(pan({ start: 10, end: 30 }, -50, D)).toEqual({ start: 0, end: 20 });
  expect(pan({ start: 10, end: 30 }, 5, D)).toEqual({ start: 15, end: 35 });
});

test("loop fraction round-trips through seconds", () => {
  const view = { start: 20, end: 60 };
  expect(toSection(view, { start: 0.25, end: 0.5 })).toEqual({ start: 30, end: 40 });
  expect(toFraction(view, { start: 30, end: 40 })).toEqual({ start: 0.25, end: 0.5 });
  expect(toFraction(view, { start: 0, end: 100 })).toEqual(FULL);
});

test("pan keeps the loop on screen; zoom keeps it on the recording", () => {
  const loop = { start: 0.25, end: 0.5 };
  expect(rescale({ start: 0, end: 40 }, { start: 10, end: 50 }, loop)).toBe(loop);
  const zoomed = rescale({ start: 0, end: 40 }, { start: 0, end: 20 }, loop);
  expect(zoomed.start).toBeCloseTo(0.5);
  expect(zoomed.end).toBeCloseTo(1);
});

test("zooming caps the loop to the frame but keeps a minimum width", () => {
  const capped = rescale({ start: 0, end: 100 }, { start: 0, end: 10 }, { start: 0.5, end: 0.6 });
  expect(capped.start).toBeCloseTo(1 - MIN_LOOP);
  expect(capped.end).toBeCloseTo(1);
});

test("a full-width loop stays full while zooming", () => {
  expect(rescale({ start: 0, end: 100 }, { start: 40, end: 50 }, FULL)).toEqual(FULL);
  expect(isFull(rescale({ start: 40, end: 50 }, { start: 0, end: 100 }, FULL))).toBe(true);
});

test("handles and body keep the loop valid", () => {
  expect(resizeLoop({ start: 0.2, end: 0.4 }, "start", 0.9)).toEqual({ start: 0.4 - MIN_LOOP, end: 0.4 });
  expect(resizeLoop({ start: 0.2, end: 0.4 }, "end", -1)).toEqual({ start: 0.2, end: 0.2 + MIN_LOOP });
  expect(shiftLoop({ start: 0.2, end: 0.4 }, 0.9)).toEqual({ start: 0.8, end: 1 });
});
