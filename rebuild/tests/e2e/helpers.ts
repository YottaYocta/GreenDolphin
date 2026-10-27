import { expect, type CDPSession, type Page } from "@playwright/test";
import type { Player } from "../../src/core";
import type { AudioEngine } from "../../src/audio";

declare global {
  interface Window {
    __gd?: { player: Player; engine?: AudioEngine };
  }
}

export const DEMO = "Wynton Kelly - On Green Dolphin Street";

export interface Snapshot {
  playState: string;
  position: number;
  duration: number;
  loop: { start: number; end: number };
  mode: string;
  speed: number;
  loopMode: { type: string; delay?: number };
}

/** Fresh app with the tutorial already seen, opened on the demo track. */
export async function openDemo(page: Page, { tutorial = false } = {}) {
  if (!tutorial) await page.addInitScript(() => localStorage.setItem("gd2:flag:tutorial", JSON.stringify({ on: true })));
  await page.goto("/");
  await page.getByRole("button", { name: `Play ${DEMO}.mp3` }).click();
  await waitForEditor(page);
}

export const waitForEditor = (page: Page) =>
  page.waitForFunction(() => window.__gd?.player && document.querySelector("#timeline-loop"));

export const snapshot = (page: Page) =>
  page.evaluate(() => {
    const gd = window.__gd!;
    const internals = { player: gd.player as unknown as { loopMode: Snapshot["loopMode"] }, engine: gd.engine as unknown as { last: { mode: string } | null } | undefined };
    return { ...gd.player.getState(), position: gd.player.position(), duration: gd.player.duration, loopMode: internals.player.loopMode, mode: internals.engine?.last?.mode ?? "silent" } as Snapshot;
  });

/** Runs a method on the live player (for setups too slow to drive by hand, e.g. tiny loops). */
export const callPlayer = (page: Page, method: string, ...args: unknown[]) =>
  page.evaluate(({ method, args }) => (window.__gd!.player as unknown as Record<string, (...a: unknown[]) => unknown>)[method](...args), { method, args });

export const recordingPrefs = (page: Page, name: string) =>
  page.evaluate((n) => JSON.parse(localStorage.getItem("gd2:recordings") ?? "{}")[n] ?? {}, name);

/** Screen point at `fraction` across the timeline content lane, `y` (0..1) down it. */
export async function lanePoint(page: Page, fraction: number, y = 0.5) {
  const box = (await page.locator("#waveform-canvas, #timeline-loop").first().boundingBox())!;
  return { x: box.x + box.width * fraction, y: box.y + box.height * y };
}

export async function rowPoint(page: Page, id: "timeline-ruler" | "timeline-loop", fraction: number) {
  const row = (await page.locator(`#${id}`).boundingBox())!;
  const inner = { x: row.x + 16, width: row.width - 32 };
  return { x: inner.x + inner.width * fraction, y: row.y + row.height / 2 };
}

export async function center(page: Page, selector: string) {
  const b = (await page.locator(selector).boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

export async function mouseDrag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, steps = 10) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps });
  await page.mouse.up();
}

type Touch = { x: number; y: number; id: number };
export type TouchStep = ["touchStart" | "touchMove", Touch[]] | ["touchEnd"];

/** Raw touch input through the DevTools protocol (each step lists every finger still down). */
const sessions = new WeakMap<Page, Promise<CDPSession>>();
export async function touch(page: Page, steps: TouchStep[]) {
  if (!sessions.has(page)) sessions.set(page, page.context().newCDPSession(page));
  const cdp = await sessions.get(page)!;
  for (const [type, touchPoints = []] of steps) await cdp.send("Input.dispatchTouchEvent", { type, touchPoints });
}

export const swipe = (from: { x: number; y: number }, to: { x: number; y: number }, id = 1): TouchStep[] => [
  ["touchStart", [{ ...from, id }]],
  ...[1, 2, 3, 4].map((i): TouchStep => ["touchMove", [{ x: from.x + ((to.x - from.x) * i) / 4, y: from.y + ((to.y - from.y) * i) / 4, id }]]),
  ["touchEnd"],
];

export const expectNear = (actual: number, expected: number, tolerance: number) => expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
