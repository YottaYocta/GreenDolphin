import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { mouseDrag, openDemo, swipe, touch, waitForEditor } from "./helpers";

const desktop = () => test.skip(test.info().project.name !== "desktop", "mouse");
const mobile = () => test.skip(test.info().project.name !== "mobile", "touch");

const toggle = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
const notes = (page: Page) => page.evaluate(() => window.__gd!.notes.get());
const savedNotes = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<unknown[][]>((resolve) => {
        const open = indexedDB.open("greendolphin");
        open.onsuccess = () => {
          const all = open.result.transaction("notes").objectStore("notes").getAll();
          all.onsuccess = () => resolve(all.result);
        };
      }),
  );

async function showRoll(page: Page, pen = true) {
  await page.getByRole("switch", { name: "Show piano" }).click();
  if (pen) await toggle(page, "Pen").click();
}

async function point(page: Page, x: number, y: number) {
  const box = (await page.locator("#note-canvas").boundingBox())!;
  return { x: box.x + box.width * x, y: box.y + box.height * y };
}

async function seedNotes(page: Page) {
  await page.evaluate(() => {
    const { notes, player } = window.__gd!;
    const d = player.duration;
    notes.commit([[60, 0.2], [61, 0.3], [62, 0.4], [64, 0.8]].map(([pitch, s]) => ({ pitch, start: s * d, length: 0.05 * d })));
  });
}

async function onNote(page: Page, index: number, fraction = 0.5) {
  const box = (await page.locator("#note-canvas").boundingBox())!;
  return page.evaluate(
    ({ box, index, fraction }) => {
      const { player, notes } = window.__gd!;
      const note = notes.get()[index];
      const keys = document.querySelector<HTMLElement>("[data-key]")!.parentElement!.getBoundingClientRect();
      return { x: box.x + ((note.start + note.length * fraction) / player.duration) * box.width, y: keys.y + ((108 - note.pitch + 0.5) * keys.height) / 88 };
    },
    { box, index, fraction },
  );
}

const pitches = async (page: Page) => (await notes(page)).map((n) => n.pitch).sort((a, b) => a - b);

test("write, play and export only appear with the piano, which replaces the full waveform", async ({ page }) => {
  await openDemo(page);
  await expect(toggle(page, "Pen")).toHaveCount(0);
  await expect(page.locator("#note-canvas")).toHaveCount(0);
  await expect(toggle(page, "Export notes")).toHaveCount(0);
  const tall = (await page.locator("#waveform-canvas").boundingBox())!.height;
  await showRoll(page, false);
  await expect(toggle(page, "Pen")).toBeVisible();
  await expect(toggle(page, "Undo")).toBeDisabled();
  await expect(toggle(page, "Export notes")).toBeDisabled();
  await expect(toggle(page, "Play notes")).toBeVisible();
  expect((await page.locator("#waveform-canvas").boundingBox())!.height).toBeLessThan(tall / 2);
  const [strip, roll] = [(await page.locator("#waveform-canvas").boundingBox())!, (await page.locator("#note-canvas").boundingBox())!];
  expect(strip.x).toBe(roll.x);
  expect(strip.width).toBe(roll.width);
});

test("with write off a drag pans time and pitch and leaves the notes alone", async ({ page }) => {
  desktop();
  await openDemo(page);
  await showRoll(page, false);
  const keyY = () => page.evaluate(() => document.querySelector<HTMLElement>('[data-key="60"]')!.getBoundingClientRect().y);
  const before = await keyY();
  const from = await point(page, 0.5, 0.5);
  await mouseDrag(page, from, { x: from.x, y: from.y + 60 });
  await expect.poll(keyY).toBeGreaterThan(before + 50);
  await page.mouse.move(from.x, from.y);
  await page.mouse.wheel(0, 60);
  await expect.poll(keyY).toBeLessThan(before + 10);
  await page.keyboard.press("j");
  await page.keyboard.press("j");
  await page.keyboard.press("k");
  const zoomedPrefs = () => page.evaluate(() => JSON.parse(localStorage.getItem("gd2:recordings") ?? "{}"));
  await page.keyboard.press("k");
  await page.keyboard.press("k");
  await expect.poll(async () => Object.values(await zoomedPrefs()).some((p) => !!(p as { view?: { start: number } }).view)).toBe(true);
  const viewAt = async () => (Object.values(await zoomedPrefs())[0] as { view: { start: number } }).view.start;
  const start = await viewAt();
  await mouseDrag(page, from, { x: from.x - 120, y: from.y });
  await expect.poll(viewAt).toBeGreaterThan(start);
  expect(await notes(page)).toEqual([]);
});

test("the pen enters a note per click; notes move, resize and survive a reload", async ({ page }) => {
  desktop();
  await openDemo(page);
  await showRoll(page);
  const [first, second] = [await point(page, 0.2, 0.5), await point(page, 0.5, 0.5)];
  await page.mouse.click(first.x, first.y);
  await page.mouse.click(second.x, second.y);
  expect(await notes(page)).toHaveLength(2);
  expect(await page.evaluate(() => window.__gd!.notes.selected().size)).toBe(1);

  const [note] = await notes(page);
  const body = await onNote(page, 0);
  await mouseDrag(page, body, { x: body.x + 40, y: body.y - 36 });
  const moved = (await notes(page)).find((n) => n.pitch === note.pitch + 3)!;
  expect(moved.start).toBeGreaterThan(note.start);
  expect(moved.length).toBeCloseTo(note.length);

  const edge = await onNote(page, 1, 0.99);
  await mouseDrag(page, edge, { x: edge.x + 50, y: edge.y });
  const resized = (await notes(page)).at(-1)!;
  expect(resized.length).toBeGreaterThan(note.length);

  const all = await notes(page);
  await expect.poll(async () => (await savedNotes(page)).flat()).toEqual(all);
  await page.reload();
  await waitForEditor(page);
  expect(await notes(page)).toEqual(all);
  await expect(toggle(page, "Pen")).toHaveAttribute("aria-pressed", "false");
});

test("dragging empty space with the pen lassos every touched note; they move and delete together", async ({ page }) => {
  desktop();
  await openDemo(page);
  await showRoll(page);
  await seedNotes(page);
  const [a, b] = [await onNote(page, 0), await onNote(page, 2)];
  await mouseDrag(page, { x: a.x - 60, y: a.y }, { x: b.x, y: b.y });
  expect(await page.evaluate(() => [...window.__gd!.notes.selected()].map((n) => n.pitch))).toEqual([60, 61, 62]);
  expect(await notes(page)).toHaveLength(4);

  const grab = await onNote(page, 1);
  await mouseDrag(page, grab, { x: grab.x, y: grab.y - 24 });
  expect(await pitches(page)).toEqual([62, 63, 64, 64]);

  await page.keyboard.press("Delete");
  expect(await pitches(page)).toEqual([64]);
});

test("double-clicking a note deletes it, and undo and redo walk the note history", async ({ page }) => {
  desktop();
  await openDemo(page);
  await showRoll(page);
  await seedNotes(page);
  const target = await onNote(page, 3);
  await page.mouse.dblclick(target.x, target.y);
  expect(await pitches(page)).toEqual([60, 61, 62]);

  await page.keyboard.press("ControlOrMeta+z");
  expect(await pitches(page)).toEqual([60, 61, 62, 64]);
  await expect.poll(async () => (await savedNotes(page)).flat()).toHaveLength(4);
  await page.keyboard.press("ControlOrMeta+Shift+z");
  expect(await pitches(page)).toEqual([60, 61, 62]);
  await toggle(page, "Undo").click();
  expect(await pitches(page)).toEqual([60, 61, 62, 64]);
});

test("touch: a tap enters a note, a double tap deletes it, two fingers pinch without editing", async ({ page }) => {
  mobile();
  await openDemo(page);
  await showRoll(page);
  const spot = await point(page, 0.5, 0.5);
  await page.touchscreen.tap(spot.x, spot.y);
  await expect.poll(async () => (await notes(page)).length).toBe(1);

  const body = await onNote(page, 0);
  await touch(page, swipe(body, { x: body.x, y: body.y - 36 }));
  const before = (await notes(page))[0];
  const [a, b] = [await point(page, 0.3, 0.8), await point(page, 0.7, 0.8)];
  await touch(page, [
    ["touchStart", [{ ...a, id: 1 }, { ...b, id: 2 }]],
    ["touchMove", [{ x: a.x - 30, y: a.y, id: 1 }, { x: b.x + 30, y: b.y, id: 2 }]],
    ["touchMove", [{ x: a.x - 60, y: a.y, id: 1 }, { x: b.x + 60, y: b.y, id: 2 }]],
    ["touchEnd"],
  ]);
  expect(await notes(page)).toEqual([before]);

  const again = await onNote(page, 0);
  await page.touchscreen.tap(again.x, again.y);
  await page.touchscreen.tap(again.x, again.y);
  await expect.poll(async () => (await notes(page)).length).toBe(0);
});

test("exports the notes as a MIDI file named after the recording", async ({ page }) => {
  desktop();
  await openDemo(page);
  await showRoll(page);
  const spot = await point(page, 0.2, 0.5);
  await page.mouse.click(spot.x, spot.y);
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export notes" }).click()]);
  expect(download.suggestedFilename()).toMatch(/Street\.mid$/);
  expect(readFileSync(await download.path()).subarray(0, 4).toString()).toBe("MThd");
});

test("play sounds notes as the playhead reaches them, and only while on and playing", async ({ page }) => {
  await openDemo(page);
  await showRoll(page, false);
  await page.evaluate(() => {
    const { engine, notes, player } = window.__gd!;
    const calls: number[] = [];
    const original = engine!.playNote.bind(engine);
    engine!.playNote = (frequency, delay, duration) => {
      calls.push(frequency);
      original(frequency, delay, duration);
    };
    Object.assign(window, { noteCalls: calls });
    const start = player.position() + 0.3;
    notes.commit([{ pitch: 69, start, length: 0.2 }]);
  });
  const calls = () => page.evaluate(() => (window as unknown as { noteCalls: number[] }).noteCalls);
  await page.keyboard.press("p");
  await page.waitForTimeout(700);
  expect(await calls()).toEqual([]);
  await page.keyboard.press("p");
  await page.evaluate(() => window.__gd!.player.dispatch({ type: "move", position: window.__gd!.notes.get()[0].start - 0.3 }));
  await toggle(page, "Play notes").click();
  await page.keyboard.press("p");
  await expect.poll(calls).toEqual([440]);
});

test("YouTube recordings get the same notes, sounded by their own synth", async ({ page }) => {
  test.slow();
  await page.addInitScript(() => localStorage.setItem("gd2:flag:tutorial", JSON.stringify({ on: true })));
  await page.goto("/");
  await page.getByRole("button", { name: "New Recording" }).first().click();
  await page.getByLabel("YouTube link").fill("https://youtu.be/jNQXAC9IVRw");
  await page.getByRole("button", { name: "Add Video" }).click();
  await waitForEditor(page);
  await showRoll(page);
  const spot = await point(page, 0.2, 0.5);
  if (test.info().project.name === "desktop") await page.mouse.click(spot.x, spot.y);
  else await page.touchscreen.tap(spot.x, spot.y);
  await expect.poll(async () => (await notes(page)).length).toBe(1);
  const [note] = await notes(page);
  await expect.poll(async () => (await savedNotes(page)).flat()).toEqual([note]);
  await page.reload();
  await waitForEditor(page);
  expect(await notes(page)).toEqual([note]);
  await expect(page.locator("#piano")).toBeVisible();
  expect((await page.getByRole("button", { name: "Home" }).boundingBox())!.y).toBeGreaterThanOrEqual(0);
  const bottom = (await page.getByRole("button", { name: "Play", exact: true }).boundingBox())!;
  expect(bottom.y + bottom.height).toBeLessThanOrEqual(page.viewportSize()!.height);

  await page.evaluate(() => {
    const { notes, player, synth } = window.__gd!;
    const calls: number[] = [];
    synth!.playNote = (frequency) => void calls.push(frequency);
    Object.assign(window, { noteCalls: calls });
    notes.commit([{ pitch: 69, start: player.position() + 0.5, length: 0.2 }]);
  });
  await toggle(page, "Play notes").click();
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { noteCalls: number[] }).noteCalls), { timeout: 20_000 }).toContain(440);
});

test("upgrading the database keeps recordings saved before notes existed", async ({ page }) => {
  await page.goto("/favicon/favicon.svg");
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const req = indexedDB.open("greendolphin", 1);
        req.onupgradeneeded = () => {
          req.result.createObjectStore("recordings", { keyPath: "id" });
          req.result.createObjectStore("audio");
        };
        req.onsuccess = () => {
          const tx = req.result.transaction("recordings", "readwrite");
          tx.objectStore("recordings").put({ id: "kept", title: "Kept video", addedAt: 1, source: { kind: "youtube", videoId: "jNQXAC9IVRw" } });
          tx.oncomplete = () => (req.result.close(), resolve());
        };
      }),
  );
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Play Kept video" })).toBeVisible();
});
