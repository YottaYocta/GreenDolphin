import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { Player, type Backend, type Output, type PlayerInit } from "../src/domain/player";

let clock = 0;
let outputs: Output[] = [];
const backend = (nativeLoop = true): Backend => ({ nativeLoop, now: () => clock, apply: (o) => outputs.push(o) });
const last = () => outputs[outputs.length - 1];
const advance = (seconds: number) => {
  for (let ms = 0; ms < Math.round(seconds * 1000); ms++) {
    clock += 0.001;
    vi.advanceTimersByTime(1);
  }
};
const make = (init: Partial<PlayerInit> = {}, nativeLoop = true) =>
  new Player(backend(nativeLoop), 60, {
    position: 12,
    loop: { start: 10, end: 20 },
    loopMode: { type: "automatic", delay: 0 },
    speed: 1,
    pitch: 0,
    gain: 1,
    ...init,
  });

beforeEach(() => {
  vi.useFakeTimers();
  clock = 100;
  outputs = [];
});
afterEach(() => vi.useRealTimers());

test("the clock advances only while playing, scaled by speed", () => {
  const p = make({ speed: 0.5 });
  advance(2);
  expect(p.position()).toBe(12);
  p.dispatch({ type: "toggle-play" });
  advance(2);
  expect(p.position()).toBeCloseTo(13);
  expect(last()).toMatchObject({ mode: "play", position: 12, stopAt: null });
});

test("delay 0 wraps natively without restarting output", () => {
  const p = make();
  p.dispatch({ type: "toggle-play" });
  const gen = last().generation;
  advance(8.5);
  expect(p.getState().playState).toBe("playing");
  expect(p.position()).toBeCloseTo(10.5);
  expect(last().generation).toBe(gen);
});

test("delay 0 restarts output when the backend can't loop natively", () => {
  const p = make({}, false);
  p.dispatch({ type: "toggle-play" });
  const gen = last().generation;
  advance(8.5);
  expect(p.position()).toBeCloseTo(10.5);
  expect(last()).toMatchObject({ mode: "play", position: 10 });
  expect(last().generation).toBeGreaterThan(gen);
});

test("a loop delay waits at the end, then plays from the loop start", () => {
  const p = make({ loopMode: { type: "automatic", delay: 2 } });
  p.dispatch({ type: "toggle-play" });
  expect(last().stopAt).toBeCloseTo(clock + 8);
  advance(8.1);
  expect(p.getState().playState).toBe("waiting");
  expect(last().mode).toBe("silent");
  expect(p.position()).toBe(20);
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
  p.dispatch({ type: "move", position: 45 });
  expect(p.position()).toBe(10);
  expect(p.getState().playState).toBe("playing");
});

test("scrubbing while playing streams the freeze, then resumes at the drop", () => {
  const p = make();
  p.dispatch({ type: "toggle-play" });
  p.scrubTo(15);
  expect(last()).toMatchObject({ mode: "scrub", position: 15 });
  advance(30);
  expect(p.getState().playState).toBe("playing");
  expect(p.position()).toBe(15);
  p.endScrub();
  expect(last()).toMatchObject({ mode: "play", position: 15 });
  p.scrubTo(50);
  p.endScrub();
  expect(p.position()).toBe(10);
});

test("scrubbing while frozen moves the freeze; paused scrubs are silent", () => {
  const p = make();
  p.dispatch({ type: "toggle-freeze" });
  p.scrubTo(30);
  expect(last()).toMatchObject({ mode: "scrub", position: 30 });
  p.endScrub();
  expect(last()).toMatchObject({ mode: "freeze", position: 30 });
  p.dispatch({ type: "toggle-freeze" });
  p.scrubTo(5);
  expect(last().mode).toBe("silent");
  p.endScrub();
  expect(p.getState().playState).toBe("paused");
  expect(p.position()).toBe(5);
});

test("changing speed keeps the position continuous", () => {
  const p = make();
  p.dispatch({ type: "toggle-play" });
  advance(2);
  p.setSettings({ speed: 0.5 });
  advance(2);
  expect(p.position()).toBeCloseTo(15);
});

test("lifting the loop plays free; committing outside the playhead restarts at its start", () => {
  const p = make();
  p.dispatch({ type: "toggle-play" });
  p.setLoop(null);
  expect(last().loop).toEqual({ start: 0, end: 60 });
  advance(9);
  expect(p.position()).toBeCloseTo(21);
  p.setLoop({ start: 30, end: 40 });
  expect(p.position()).toBe(30);
  p.setLoop({ start: 25, end: 45 });
  expect(p.position()).toBe(30);
});

test("switching to a loop delay while playing schedules a stop", () => {
  const p = make();
  p.dispatch({ type: "toggle-play" });
  advance(1);
  p.setLoopMode({ type: "automatic", delay: 1 });
  expect(last().stopAt).toBeCloseTo(clock + 7);
});
