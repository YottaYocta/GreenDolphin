import { expect, test, type Page } from "@playwright/test";
import { DEMO, expectNear, lanePoint, openDemo, openedPrefs, snapshot, waitForEditor } from "./helpers";

/** A mono 16-bit sine WAV, built in Node so uploads need no fixture files. */
function wav(seconds: number, hz: number) {
  const rate = 22050;
  const n = Math.round(seconds * rate);
  const buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write("WAVEfmt ", 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(Math.sin((2 * Math.PI * hz * i) / rate) * 8000), 44 + i * 2);
  return buf;
}

async function upload(page: Page, name: string) {
  const fromEditor = await page.getByRole("button", { name: "Switch recording" }).isVisible();
  if (fromEditor) {
    await page.getByRole("button", { name: "Switch recording" }).click();
    await page.getByRole("menuitem", { name: "New Recording" }).click();
  } else await page.getByRole("button", { name: "New Recording" }).first().click();
  await page.getByLabel("Upload audio file").setInputFiles({ name, mimeType: "audio/wav", buffer: wav(8, 330) });
  await page.waitForFunction(() => (window.__gd?.player.duration ?? Infinity) < 9);
  await waitForEditor(page);
}

const setPitch = async (page: Page, value: string) => {
  await page.getByRole("button", { name: "Settings" }).click();
  const pitch = page.getByRole("textbox").first();
  await pitch.fill(value);
  await pitch.press("Enter");
  await page.keyboard.press("Escape");
};

test("first launch seeds the demo and offers the tutorial", async ({ page }) => {
  await openDemo(page, { tutorial: true });
  await expect(page.getByText("Would you like a tutorial?")).toBeVisible();
  await page.getByRole("button", { name: "Yes" }).click();
  await expect(page.getByText("1 / 5")).toBeVisible();
  await page.getByRole("button", { name: "Skip" }).click();
  await page.reload();
  await waitForEditor(page);
  await expect(page.getByText("Would you like a tutorial?")).toBeHidden();
});

test("reopens the last recording with its view, position and settings", async ({ page }) => {
  await openDemo(page);
  await setPitch(page, "3");
  const p = await lanePoint(page, 0.5);
  if (test.info().project.name === "desktop") {
    await page.mouse.move(p.x, p.y);
    await page.mouse.wheel(0, 300);
  }
  await page.waitForTimeout(400);
  const t = await lanePoint(page, 0.4);
  await (test.info().project.name === "desktop" ? page.mouse.click(t.x, t.y) : page.touchscreen.tap(t.x, t.y));
  const before = await snapshot(page);
  const view = (await openedPrefs(page)).view;

  await page.reload();
  await waitForEditor(page);
  const after = await snapshot(page);
  expect((await openedPrefs(page)).pitch).toBe(3);
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("slider", { name: "Pitch" })).toHaveAttribute("aria-valuenow", "3");
  const enginePitch = await page.evaluate(() => (window.__gd!.engine as unknown as { stretch: { pitchSemitones: AudioParam } }).stretch.pitchSemitones.value);
  expect(enginePitch).toBe(3);
  await page.keyboard.press("Escape");
  expectNear(after.position, before.position, 0.01);
  expect((await openedPrefs(page)).view).toEqual(view);
});

test("pitch, speed and volume belong to each recording; loop settings are global", async ({ page }) => {
  await openDemo(page);
  await setPitch(page, "-2");
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("radio", { name: "Manual" }).click();
  await page.keyboard.press("Escape");

  await upload(page, "tone.wav");
  let s = await snapshot(page);
  expect((await openedPrefs(page)).pitch ?? 0).toBe(0);
  expect(s.loopMode.type).toBe("manual");

  await page.getByRole("button", { name: "Switch recording" }).click();
  await page.getByRole("menuitem", { name: DEMO }).click();
  await page.waitForFunction(() => (window.__gd?.player.duration ?? 0) > 9);
  s = await snapshot(page);
  expect((await openedPrefs(page)).pitch).toBe(-2);
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("slider", { name: "Pitch" })).toHaveAttribute("aria-valuenow", "-2");
  expect(s.loopMode.type).toBe("manual");
});

test("relative loop delay is converted to seconds from the loop length", async ({ page }) => {
  await openDemo(page);
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("radio", { name: "Relative" }).click();
  const field = page.getByRole("textbox").last();
  await field.fill("50");
  await field.press("Enter");
  const s = await snapshot(page);
  expect(s.loopMode).toEqual({ type: "automatic", delay: (s.loop.end - s.loop.start) / 2 });
});

test("Home returns to the library, and launch then stays there", async ({ page }) => {
  await openDemo(page);
  await page.getByRole("button", { name: "Home" }).click();
  await expect(page.getByRole("region", { name: "My Recordings" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("region", { name: "My Recordings" })).toBeVisible();
});

test("deleting asks first and removes the recording", async ({ page }) => {
  await openDemo(page);
  await upload(page, "doomed.wav");
  await page.getByRole("button", { name: "Home" }).click();
  await page.getByRole("button", { name: "Delete doomed.wav" }).click();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByText("doomed")).toBeVisible();
  await page.getByRole("button", { name: "Delete doomed.wav" }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByText("doomed")).toBeHidden();
  await expect(page.getByText(DEMO)).toBeVisible();
});

test("a bad YouTube link is reported without leaving the dialog", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New Recording" }).first().click();
  await page.getByLabel("YouTube link").fill("https://example.com/not-a-video");
  await page.getByRole("button", { name: "Add Video" }).click();
  await expect(page.getByText("Couldn't find a video in that link.")).toBeVisible();
});

test("a YouTube link opens the video editor and playback drives the embed", async ({ page }) => {
  test.slow();
  await page.addInitScript(() => localStorage.setItem("gd2:flag:tutorial", JSON.stringify({ on: true })));
  await page.goto("/");
  await page.getByRole("button", { name: "New Recording" }).first().click();
  await page.getByLabel("YouTube link").fill("https://youtu.be/jNQXAC9IVRw");
  await page.getByRole("button", { name: "Add Video" }).click();
  await waitForEditor(page);
  await expect(page.getByRole("button", { name: "Freeze" })).toHaveCount(0);
  await page.getByRole("button", { name: "Play" }).click();
  await expect.poll(() => page.evaluate(() => window.__gd!.player.position()), { timeout: 20_000 }).toBeGreaterThan(1);
  await page.getByRole("button", { name: "Pause" }).click();
  expect((await snapshot(page)).playState).toBe("paused");
});
