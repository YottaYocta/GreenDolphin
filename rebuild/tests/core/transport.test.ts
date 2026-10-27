import { describe, expect, test } from "vitest";
import { transition, type LoopMode, type PlayState, type TransportEvent } from "../../src/core";

const loop = { start: 10, end: 20 };
const auto0: LoopMode = { type: "automatic", delay: 0 };
const auto2: LoopMode = { type: "automatic", delay: 2 };
const manual: LoopMode = { type: "manual" };
const run = (state: PlayState, event: TransportEvent, position = 15, loopMode: LoopMode = auto0) =>
  transition(state, event, { position, loop, loopMode });

describe("play/pause", () => {
  test("toggles playing and paused", () => {
    expect(run("paused", { type: "toggle-play" })).toEqual({ state: "playing" });
    expect(run("playing", { type: "toggle-play" })).toEqual({ state: "paused" });
  });
  test("play from frozen resumes playback", () => {
    expect(run("frozen", { type: "toggle-play" })).toEqual({ state: "playing" });
  });
  test("play outside the loop starts at the loop start", () => {
    expect(run("paused", { type: "toggle-play" }, 25)).toEqual({ state: "playing", position: 10 });
    expect(run("paused", { type: "toggle-play" }, 20)).toEqual({ state: "playing", position: 10 });
    expect(run("frozen", { type: "toggle-play" }, 3)).toEqual({ state: "playing", position: 10 });
  });
  test("pausing during the delay returns to the loop start", () => {
    expect(run("waiting", { type: "toggle-play" }, 20, auto2)).toEqual({ state: "paused", position: 10 });
  });
});

describe("freeze", () => {
  test.each<PlayState>(["paused", "playing", "waiting"])("freeze from %s freezes", (s) => {
    expect(run(s, { type: "toggle-freeze" })).toEqual({ state: "frozen" });
  });
  test("freeze while frozen pauses", () => {
    expect(run("frozen", { type: "toggle-freeze" })).toEqual({ state: "paused" });
  });
});

describe("move", () => {
  test("paused moves anywhere and stays paused", () => {
    expect(run("paused", { type: "move", position: 3 })).toEqual({ state: "paused", position: 3 });
  });
  test("frozen moves anywhere and stays frozen", () => {
    expect(run("frozen", { type: "move", position: 30 })).toEqual({ state: "frozen", position: 30 });
  });
  test("playing inside the loop jumps there", () => {
    expect(run("playing", { type: "move", position: 12 })).toEqual({ state: "playing", position: 12 });
  });
  test("playing outside the loop goes to the loop start", () => {
    expect(run("playing", { type: "move", position: 25 })).toEqual({ state: "playing", position: 10 });
    expect(run("playing", { type: "move", position: 20 })).toEqual({ state: "playing", position: 10 });
  });
  test("moving during the delay plays from the move or the loop start", () => {
    expect(run("waiting", { type: "move", position: 12 }, 20, auto2)).toEqual({ state: "playing", position: 12 });
    expect(run("waiting", { type: "move", position: 2 }, 20, auto2)).toEqual({ state: "playing", position: 10 });
  });
});

describe("loop end", () => {
  test("delay 0 wraps to the loop start", () => {
    expect(run("playing", { type: "loop-end" }, 20, auto0)).toEqual({ state: "playing", position: 10 });
  });
  test("delay > 0 waits at the loop end, then plays from the start", () => {
    expect(run("playing", { type: "loop-end" }, 20, auto2)).toEqual({ state: "waiting", position: 20 });
    expect(run("waiting", { type: "delay-end" }, 20, auto2)).toEqual({ state: "playing", position: 10 });
  });
  test("manual pauses at the loop start", () => {
    expect(run("playing", { type: "loop-end" }, 20, manual)).toEqual({ state: "paused", position: 10 });
  });
  test("is ignored outside playing", () => {
    expect(run("paused", { type: "loop-end" })).toEqual({ state: "paused" });
    expect(run("paused", { type: "delay-end" })).toEqual({ state: "paused" });
  });
});

describe("loop change", () => {
  test("playing outside the new loop goes to its start", () => {
    expect(run("playing", { type: "loop-change" }, 25)).toEqual({ state: "playing", position: 10 });
    expect(run("playing", { type: "loop-change" }, 15)).toEqual({ state: "playing" });
  });
  test("waiting restarts from the new loop start", () => {
    expect(run("waiting", { type: "loop-change" }, 20, auto2)).toEqual({ state: "playing", position: 10 });
  });
  test("paused and frozen are unaffected", () => {
    expect(run("paused", { type: "loop-change" }, 25)).toEqual({ state: "paused" });
    expect(run("frozen", { type: "loop-change" }, 25)).toEqual({ state: "frozen" });
  });
});
