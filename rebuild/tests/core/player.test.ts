import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { Player, continues, positionAt, type Output, type Playback, type PlayerOptions } from "../../src/core";

let clock = 0;
let renders: Playback[] = [];
const output: Output = { now: () => clock, render: (p) => void renders.push(p) };
const last = () => renders[renders.length - 1];
const jumped = () => renders.length > 1 && !continues(renders[renders.length - 2], last());
const advance = (seconds: number) => {
  for (let ms = 0; ms < Math.round(seconds * 1000); ms++) {
    clock += 0.001;
    vi.advanceTimersByTime(1);
  }
};
const make = (options: Partial<PlayerOptions> = {}) =>
  new Player(output, { duration: 60, position: 12, loop: { start: 10, end: 20 }, loopMode: { type: "automatic", delay: 0 }, speed: 1, ...options });

beforeEach(() => {
  vi.useFakeTimers();
  clock = 100;
  renders = [];
});
afterEach(() => vi.useRealTimers());

test("the clock advances only while playing, scaled by speed", () => {
  const p = make({ speed: 0.5 });
  advance(2);
  expect(p.position()).toBe(12);
  p.dispatch({ type: "toggle-play" });
  advance(2);
  expect(p.position()).toBeCloseTo(13);
  expect(last()).toMatchObject({ mode: "playing", anchorPosition: 12, rate: 0.5, loopWraps: true });
});

test("a wrapping loop needs no events: the trajectory wraps by itself", () => {
  const p = make();
  p.dispatch({ type: "toggle-play" });
  const count = renders.length;
  advance(8.5);
  expect(p.getState().playState).toBe("playing");
  expect(p.position()).toBeCloseTo(10.5);
  expect(renders.length).toBe(count);
});

test("speed changes re-anchor on the same trajectory", () => {
  const p = make();
  p.dispatch({ type: "toggle-play" });
  advance(2);
  p.setSpeed(0.5);
  expect(jumped()).toBe(false);
  advance(2);
  expect(p.position()).toBeCloseTo(15);
});

test("a loop delay waits at the end, then jumps back to the loop start", () => {
  const p = make({ loopMode: { type: "automatic", delay: 2 } });
  p.dispatch({ type: "toggle-play" });
  expect(last().loopWraps).toBe(false);
  advance(8.1);
  expect(p.getState().playState).toBe("waiting");
  expect(last().mode).toBe("silent");
  expect(p.position()).toBe(20);
  expect(p.delayRemaining()).toBeCloseTo(1.9, 1);
  advance(2);
  expect(p.getState().playState).toBe("playing");
  expect(p.position()).toBeCloseTo(10.1, 1);
});

test("manual mode pauses at the loop start", () => {
  const p = make({ loopMode: { type: "manual" } });
  p.dispatch({ type: "toggle-play" });
  advance(9);
  expect(p.getState().playState).toBe("paused");
  expect(p.position()).toBe(10);
});

test("clicking outside the loop: playing goes to the loop start, paused stays", () => {
  const p = make();
  p.dispatch({ type: "move", position: 40 });
  expect(p.position()).toBe(40);
  p.dispatch({ type: "toggle-play" });
  expect(p.position()).toBe(10);
  advance(1);
  p.dispatch({ type: "move", position: 45 });
  expect(p.position()).toBe(10);
  expect(jumped()).toBe(true);
});

test("scrubbing while playing streams the freeze, then resumes at the drop", () => {
  const p = make();
  p.dispatch({ type: "toggle-play" });
  p.scrubTo(15);
  expect(last()).toMatchObject({ mode: "scrubbing", anchorPosition: 15 });
  advance(30);
  expect(p.position()).toBe(15);
  p.endScrub();
  expect(last()).toMatchObject({ mode: "playing", anchorPosition: 15 });
  p.scrubTo(50);
  p.endScrub();
  expect(p.position()).toBe(10);
});

test("scrubbing while frozen moves the freeze; paused scrubs are silent", () => {
  const p = make();
  p.dispatch({ type: "toggle-freeze" });
  p.scrubTo(30);
  expect(last()).toMatchObject({ mode: "scrubbing", anchorPosition: 30 });
  p.endScrub();
  expect(last()).toMatchObject({ mode: "frozen", anchorPosition: 30 });
  p.dispatch({ type: "toggle-freeze" });
  p.scrubTo(5);
  expect(last().mode).toBe("silent");
  p.endScrub();
  expect(p.getState().playState).toBe("paused");
  expect(p.position()).toBe(5);
});

test("lifting the loop plays free; committing outside the playhead jumps to its start", () => {
  const p = make();
  p.dispatch({ type: "toggle-play" });
  p.setLoop(null);
  expect(last().loop).toEqual({ start: 0, end: 60 });
  expect(jumped()).toBe(false);
  advance(9);
  expect(p.position()).toBeCloseTo(21);
  p.setLoop({ start: 30, end: 40 });
  expect(p.position()).toBe(30);
  expect(jumped()).toBe(true);
  p.setLoop({ start: 25, end: 45 });
  expect(p.position()).toBe(30);
  expect(jumped()).toBe(false);
});

test("outputs see the same playhead the player reports", () => {
  const p = make();
  p.dispatch({ type: "toggle-play" });
  advance(3.3);
  p.setSpeed(1.5);
  advance(1.1);
  expect(positionAt(last(), clock)).toBe(p.position());
});
