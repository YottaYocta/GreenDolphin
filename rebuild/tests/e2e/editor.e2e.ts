import { expect, test } from "@playwright/test";
import { callPlayer, center, expectNear, lanePoint, mouseDrag, openDemo, recordingPrefs, rowPoint, snapshot, swipe, touch, DEMO } from "./helpers";

const desktop = () => test.skip(test.info().project.name !== "desktop", "mouse, wheel and keyboard");
const mobile = () => test.skip(test.info().project.name !== "mobile", "touch");

test.beforeEach(async ({ page }) => openDemo(page));

test("play, pause and freeze follow the transition table", async ({ page }) => {
  const play = page.getByRole("button", { name: /^(Play|Pause)$/ });
  const freeze = page.getByRole("button", { name: "Freeze" });
  await play.click();
  await expect.poll(async () => (await snapshot(page)).mode).toBe("playing");
  await freeze.click();
  expect(await snapshot(page)).toMatchObject({ playState: "frozen", mode: "frozen" });
  await freeze.click();
  expect(await snapshot(page)).toMatchObject({ playState: "paused", mode: "silent" });
  await freeze.click();
  await play.click();
  expect(await snapshot(page)).toMatchObject({ playState: "playing", mode: "playing" });
  await play.click();
  expect((await snapshot(page)).playState).toBe("paused");
});

test("keyboard shortcuts drive the transport and are ignored while typing", async ({ page }) => {
  desktop();
  await page.keyboard.press("Space");
  expect((await snapshot(page)).playState).toBe("playing");
  await page.keyboard.press("f");
  expect((await snapshot(page)).playState).toBe("frozen");
  await page.keyboard.press("p");
  await page.keyboard.press("p");
  await page.keyboard.press("0");
  const start = (await snapshot(page)).position;
  await page.keyboard.press("l");
  expectNear((await snapshot(page)).position, start + 5, 0.05);
  await page.keyboard.press("ArrowLeft");
  expectNear((await snapshot(page)).position, start + 4.8, 0.05);
  await page.getByRole("button", { name: "Settings" }).click();
  const field = page.getByRole("textbox").first();
  await field.click();
  await page.keyboard.press("p");
  await page.keyboard.press("ArrowLeft");
  expect((await snapshot(page)).playState).toBe("paused");
  expectNear((await snapshot(page)).position, start + 4.8, 0.05);
});

test("clicking outside the loop: paused stays, playing goes to the loop start", async ({ page }) => {
  const handle = page.getByLabel("Loop end");
  const from = await center(page, '[aria-label="Loop end"]');
  const to = await rowPoint(page, "timeline-loop", 0.5);
  if (test.info().project.name === "mobile") await touch(page, swipe(from, to));
  else await mouseDrag(page, from, to);
  await expect(handle).toBeVisible();
  const { loop, duration } = await snapshot(page);
  expectNear(loop.end, duration / 2, duration * 0.02);

  const tap = async (f: number) => {
    const p = await lanePoint(page, f);
    if (test.info().project.name === "mobile") await page.touchscreen.tap(p.x, p.y);
    else await page.mouse.click(p.x, p.y);
  };
  await tap(0.75);
  const paused = await snapshot(page);
  expect(paused.playState).toBe("paused");
  expectNear(paused.position, duration * 0.75, duration * 0.02);

  await page.getByRole("button", { name: "Play" }).click();
  const playing = await snapshot(page);
  expect(playing.playState).toBe("playing");
  expectNear(playing.position, playing.loop.start, 0.3);

  await tap(0.25);
  expectNear((await snapshot(page)).position, duration * 0.25, duration * 0.02);
  await tap(0.8);
  expectNear((await snapshot(page)).position, playing.loop.start, 0.3);
});

test("after the loop end: delay 0 wraps, a delay waits, manual pauses at the start", async ({ page }) => {
  await callPlayer(page, "setLoop", { start: 1, end: 1.6 });
  await callPlayer(page, "dispatch", { type: "toggle-play" });
  await page.waitForTimeout(900);
  const s = await snapshot(page);
  expect(s.playState).toBe("playing");
  expect(s.position).toBeGreaterThanOrEqual(1);
  expect(s.position).toBeLessThan(1.6);

  await callPlayer(page, "setLoopMode", { type: "automatic", delay: 1 });
  await page.waitForFunction(() => window.__gd!.player.getState().playState === "waiting");
  expect((await snapshot(page)).mode).toBe("silent");
  await expect(page.getByRole("button", { name: "Play" })).toHaveAttribute("data-state", "waiting");
  await page.waitForFunction(() => window.__gd!.player.getState().playState === "playing", null, { timeout: 3000 });

  await callPlayer(page, "setLoopMode", { type: "manual" });
  await page.waitForFunction(() => window.__gd!.player.getState().playState === "paused", null, { timeout: 3000 });
  expect((await snapshot(page)).position).toBe(1);
});

test("dragging the playhead live-scrubs while playing, then resumes at the drop", async ({ page }) => {
  await page.getByRole("button", { name: "Play" }).click();
  const grip = await center(page, '[aria-label="Playhead"]');
  const drop = await rowPoint(page, "timeline-ruler", 0.6);
  if (test.info().project.name === "mobile") {
    await touch(page, [
      ["touchStart", [{ ...grip, id: 1 }]],
      ["touchMove", [{ x: grip.x + 30, y: grip.y, id: 1 }]],
    ]);
    expect((await snapshot(page)).mode).toBe("scrubbing");
    await touch(page, [["touchMove", [{ ...drop, id: 1 }]], ["touchEnd"]]);
  } else {
    await page.mouse.move(grip.x, grip.y);
    await page.mouse.down();
    await page.mouse.move(grip.x + 30, grip.y, { steps: 3 });
    expect((await snapshot(page)).mode).toBe("scrubbing");
    await page.mouse.move(drop.x, drop.y, { steps: 5 });
    await page.mouse.up();
  }
  const s = await snapshot(page);
  expect(s).toMatchObject({ playState: "playing", mode: "playing" });
  expectNear(s.position, s.duration * 0.6, s.duration * 0.03);
});

test("a press on the playhead without moving does nothing", async ({ page }) => {
  desktop();
  await page.getByRole("button", { name: "Play" }).click();
  const grip = await center(page, '[aria-label="Playhead"]');
  await page.mouse.move(grip.x, grip.y);
  await page.mouse.down();
  expect((await snapshot(page)).mode).toBe("playing");
  await page.waitForTimeout(300);
  await page.mouse.up();
  const s = await snapshot(page);
  expect(s.mode).toBe("playing");
  expect(s.position).toBeGreaterThan(0.25);
});

test("scrubbing while frozen moves the freeze; paused drags are silent", async ({ page }) => {
  desktop();
  await page.getByRole("button", { name: "Freeze" }).click();
  const grip = await center(page, '[aria-label="Playhead"]');
  await mouseDrag(page, grip, await rowPoint(page, "timeline-ruler", 0.3));
  let s = await snapshot(page);
  expect(s).toMatchObject({ playState: "frozen", mode: "frozen" });
  expectNear(s.position, s.duration * 0.3, s.duration * 0.03);
  await page.getByRole("button", { name: "Freeze" }).click();
  await page.mouse.move(...(Object.values(await center(page, '[aria-label="Playhead"]')) as [number, number]));
  await page.mouse.down();
  const to = await rowPoint(page, "timeline-ruler", 0.5);
  await page.mouse.move(to.x, to.y, { steps: 5 });
  expect((await snapshot(page)).mode).toBe("silent");
  await page.mouse.up();
  s = await snapshot(page);
  expect(s.playState).toBe("paused");
  expectNear(s.position, s.duration * 0.5, s.duration * 0.03);
});

test("wheel zoom keeps a full loop full and pans with the view", async ({ page }) => {
  desktop();
  const p = await lanePoint(page, 0.5);
  await page.mouse.move(p.x, p.y);
  await page.mouse.wheel(0, 400);
  await page.waitForTimeout(400);
  const zoomed = await recordingPrefs(page, `${DEMO}.mp3`);
  const s = await snapshot(page);
  expect(zoomed.view.end - zoomed.view.start).toBeLessThan(s.duration * 0.9);
  expect(s.loop.start).toBeCloseTo(zoomed.view.start, 3);
  expect(s.loop.end).toBeCloseTo(zoomed.view.end, 3);
  await mouseDrag(page, await lanePoint(page, 0.5), await lanePoint(page, 0.3));
  await page.waitForTimeout(400);
  const panned = await recordingPrefs(page, `${DEMO}.mp3`);
  expect(panned.view.start).toBeGreaterThan(zoomed.view.start);
  expect(panned.loop.start).toBeCloseTo(panned.view.start, 3);
});

test("zoom scales a partial loop with the recording; double-click resets it", async ({ page }) => {
  desktop();
  await mouseDrag(page, await center(page, '[aria-label="Loop end"]'), await rowPoint(page, "timeline-loop", 0.6));
  await mouseDrag(page, await center(page, '[aria-label="Loop start"]'), await rowPoint(page, "timeline-loop", 0.4));
  const before = (await snapshot(page)).loop;
  const p = await lanePoint(page, 0.5);
  await page.mouse.move(p.x, p.y);
  await page.mouse.wheel(0, 200);
  await page.waitForTimeout(400);
  const after = (await snapshot(page)).loop;
  expect(after.start).toBeCloseTo(before.start, 1);
  expect(after.end).toBeCloseTo(before.end, 1);

  const band = await rowPoint(page, "timeline-loop", 0.1);
  await page.mouse.dblclick(band.x, band.y);
  const view = (await recordingPrefs(page, `${DEMO}.mp3`)).view;
  const reset = (await snapshot(page)).loop;
  expect(reset.start).toBeCloseTo(view.start, 3);
  expect(reset.end).toBeCloseTo(view.end, 3);
});

test("dragging the loop body shifts it within the frame", async ({ page }) => {
  desktop();
  await mouseDrag(page, await center(page, '[aria-label="Loop end"]'), await rowPoint(page, "timeline-loop", 0.3));
  const before = (await snapshot(page)).loop;
  await mouseDrag(page, await rowPoint(page, "timeline-loop", 0.15), await rowPoint(page, "timeline-loop", 0.45));
  const after = (await snapshot(page)).loop;
  expectNear(after.end - after.start, before.end - before.start, 0.01);
  expect(after.start).toBeGreaterThan(before.start);
});

test("touch: one finger pans, two fingers pinch-zoom, tap sets the playhead", async ({ page }) => {
  mobile();
  const name = `${DEMO}.mp3`;
  const a = await lanePoint(page, 0.3);
  const b = await lanePoint(page, 0.7);
  await touch(page, [
    ["touchStart", [{ ...a, id: 1 }, { ...b, id: 2 }]],
    ["touchMove", [{ x: a.x - 40, y: a.y, id: 1 }, { x: b.x + 40, y: b.y, id: 2 }]],
    ["touchMove", [{ x: a.x - 80, y: a.y, id: 1 }, { x: b.x + 80, y: b.y, id: 2 }]],
    ["touchEnd"],
  ]);
  await page.waitForTimeout(400);
  const zoomed = (await recordingPrefs(page, name)).view;
  const { duration } = await snapshot(page);
  expect(zoomed.end - zoomed.start).toBeLessThan(duration * 0.8);

  const m = await lanePoint(page, 0.5);
  await touch(page, swipe(m, { x: m.x - 120, y: m.y }, 3));
  await page.waitForTimeout(400);
  const panned = (await recordingPrefs(page, name)).view;
  expect(panned.start).toBeGreaterThan(zoomed.start);
  expectNear(panned.end - panned.start, zoomed.end - zoomed.start, 0.01);

  const t = await lanePoint(page, 0.5);
  await page.touchscreen.tap(t.x, t.y);
  expectNear((await snapshot(page)).position, (panned.start + panned.end) / 2, (panned.end - panned.start) * 0.03);
});

test("piano keys play a tone at the key's pitch", async ({ page }) => {
  const key = page.locator('[data-key="57"]');
  await key.scrollIntoViewIfNeeded();
  const box = (await key.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.8);
  await page.mouse.down();
  await page.waitForTimeout(300);
  const peakHz = await page.evaluate(() => {
    const engine = window.__gd!.engine!;
    const data = engine.readSpectrum();
    let best = 0;
    for (let i = 1; i < data.length; i++) if (data[i] > data[best]) best = i;
    return best * engine.spectrumBinHz;
  });
  await page.mouse.up();
  expectNear(peakHz, 440, 10);
});
