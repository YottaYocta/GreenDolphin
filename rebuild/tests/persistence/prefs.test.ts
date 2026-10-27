import { beforeEach, expect, test, vi } from "vitest";
import { persistence } from "../../src/persistence";

beforeEach(() => {
  const data = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  });
});

test("settings, loop, view and position are stored per recording", () => {
  persistence.saveRecordingPrefs("a.mp3", { pitch: 3, speed: 0.75, loop: { start: 1, end: 2 } });
  persistence.saveRecordingPrefs("b.mp3", { gain: 1.5, position: 42 });
  persistence.saveRecordingPrefs("a.mp3", { view: { start: 0, end: 5 } });
  expect(persistence.recordingPrefs("a.mp3")).toEqual({ speed: 0.75, pitch: 3, gain: 1, loop: { start: 1, end: 2 }, view: { start: 0, end: 5 }, position: 0 });
  expect(persistence.recordingPrefs("b.mp3")).toMatchObject({ speed: 1, pitch: 0, gain: 1.5, position: 42, loop: null });
  persistence.removeRecordingPrefs("a.mp3");
  expect(persistence.recordingPrefs("a.mp3").pitch).toBe(0);
});

test("loop settings are global", () => {
  expect(persistence.loopPrefs()).toEqual({ mode: "automatic", delayMode: "fixed", delayValue: 0 });
  persistence.saveLoopPrefs({ delayMode: "relative", delayValue: 50 });
  expect(persistence.loopPrefs()).toEqual({ mode: "automatic", delayMode: "relative", delayValue: 50 });
});

test("loop delay always reaches the engine in seconds", () => {
  expect(persistence.toLoopMode({ mode: "automatic", delayMode: "fixed", delayValue: 2 }, 10)).toEqual({ type: "automatic", delay: 2 });
  expect(persistence.toLoopMode({ mode: "automatic", delayMode: "relative", delayValue: 50 }, 10)).toEqual({ type: "automatic", delay: 5 });
  expect(persistence.toLoopMode({ mode: "manual", delayMode: "fixed", delayValue: 2 }, 10)).toEqual({ type: "manual" });
});

test("last opened recording round-trips, including the library", () => {
  expect(persistence.lastOpened()).toBeNull();
  persistence.setLastOpened("a.mp3");
  expect(persistence.lastOpened()).toBe("a.mp3");
  persistence.setLastOpened(null);
  expect(persistence.lastOpened()).toBeNull();
});

test("corrupt storage falls back to defaults", () => {
  localStorage.setItem("gd2:loop", "{not json");
  expect(persistence.loopPrefs().mode).toBe("automatic");
});
