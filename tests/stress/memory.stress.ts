import { test, type Browser, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import "../e2e/helpers";

const RECORDINGS = "tests/stress/recordings";
const RESULTS = process.env.STRESS_RESULTS!;
const LENGTHS = (process.env.STRESS_MINUTES ?? "10,30,60,120").split(",").map(Number);
const LOOP_LENGTHS = (process.env.STRESS_LOOP_MINUTES ?? "10,30").split(",").map(Number);
const SCRUB_LENGTH = Number(process.env.STRESS_SCRUB_MINUTES ?? 60);
const SWITCH_LENGTHS = (process.env.STRESS_SWITCH_MINUTES ?? "30,60").split(",").map(Number);
const LOOP_ITERATIONS = 10;
const SWITCH_ROUND_TRIPS = 3;
const OPEN_TIMEOUT = 10 * 60_000;
const UNITS: Record<string, number> = { B: 2 ** -20, K: 2 ** -10, M: 1, G: 2 ** 10 };

type Megabytes = number;
type Outcome = "ok" | "tab crashed" | "decode failed" | "timed out";
interface Row {
  scenario: string;
  recording: string;
  outcome: Outcome;
  baseline: Megabytes;
  peak: Megabytes;
  settled: Megabytes;
  notes: string;
}

const fileFor = (minutes: number) => readdirSync(RECORDINGS).find((name) => name.startsWith(`${minutes}min.`))!;
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const round = (mb: Megabytes) => Math.round(mb);

async function meter(browser: Browser, page: Page) {
  const processes = await browser.newBrowserCDPSession();
  const tab = await page.context().newCDPSession(page);
  const read = async (): Promise<Megabytes> => {
    const { processInfo } = await processes.send("SystemInfo.getProcessInfo");
    const top = execFileSync("top", ["-l", "1", "-stats", "pid,mem", ...processInfo.flatMap((p) => ["-pid", String(p.id)])]).toString();
    return [...top.matchAll(/^\d+\s+(\d+)([BKMG])/gm)].reduce((sum, [, amount, unit]) => sum + Number(amount) * UNITS[unit], 0);
  };
  const settled = async () => {
    let last = await read();
    for (let i = 0; i < 10; i++) {
      await tab.send("HeapProfiler.collectGarbage").catch(() => {});
      await pause(3000);
      const now = await read().catch(() => last);
      const stable = Math.abs(now - last) < Math.max(20, last * 0.02);
      last = now;
      if (stable) break;
    }
    return last;
  };
  const baseline = await settled();
  let peak = baseline;
  let watching = true;
  const watcher = (async () => {
    while (watching) {
      peak = Math.max(peak, await read().catch(() => 0));
      await pause(250);
    }
  })();
  return {
    baseline,
    settled,
    peak: () => peak,
    stop: async () => {
      watching = false;
      await watcher;
    },
  };
}

function waitForOpen(page: Page, minutes: number): Promise<Outcome> {
  const never = new Promise<never>(() => {});
  return Promise.race<Outcome>([
    new Promise((resolve) => page.once("crash", () => resolve("tab crashed"))),
    pause(OPEN_TIMEOUT).then(() => "timed out"),
    page.getByText("Couldn't open").waitFor({ timeout: 0 }).then(() => "decode failed" as const, () => never),
    page
      .waitForFunction(
        (seconds) => {
          const canvas = document.querySelector<HTMLCanvasElement>("#waveform-canvas");
          if (Math.abs((window.__gd?.player.duration ?? 0) - seconds) > 5 || !canvas?.width) return false;
          return canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data.some((value) => value > 0);
        },
        minutes * 60,
        { timeout: 0, polling: 500 },
      )
      .then(() => "ok" as const, () => never),
  ]);
}

async function upload(page: Page, minutes: number) {
  const opened = waitForOpen(page, minutes);
  const fromEditor = await page.getByRole("button", { name: "Switch recording" }).isVisible();
  if (fromEditor) {
    await page.getByRole("button", { name: "Switch recording" }).click();
    await page.getByRole("menuitem", { name: "New Recording" }).click();
  } else await page.getByRole("button", { name: "Load recording" }).first().click();
  await page.getByLabel("Upload audio file").setInputFiles(`${RECORDINGS}/${fileFor(minutes)}`);
  return opened;
}

async function goHome(page: Page) {
  await page.getByRole("button", { name: "Home" }).click();
  await page.getByRole("list", { name: "My Recordings" }).waitFor();
  await page.evaluate(() => delete window.__gd);
}

async function start(page: Page) {
  await page.addInitScript(() => localStorage.setItem("gd2:flag:tutorial", JSON.stringify({ on: true })));
  await page.goto("/");
  await page.getByRole("list", { name: "My Recordings" }).waitFor();
}

function record(row: Row) {
  mkdirSync(dirname(RESULTS), { recursive: true });
  const rows: Row[] = existsSync(`${RESULTS}.json`) ? JSON.parse(readFileSync(`${RESULTS}.json`, "utf8")) : [];
  rows.push({ ...row, baseline: round(row.baseline), peak: round(row.peak), settled: round(row.settled) });
  writeFileSync(`${RESULTS}.json`, JSON.stringify(rows, null, 2));
  const table = [
    "| scenario | recording | outcome | baseline MB | peak MB | settled MB | notes |",
    "|---|---|---|---|---|---|---|",
    ...rows.map((r) => `| ${r.scenario} | ${r.recording} | ${r.outcome} | ${r.baseline} | ${r.peak} | ${r.settled} | ${r.notes} |`),
  ].join("\n");
  writeFileSync(`${RESULTS}.md`, `${table}\n`);
  return table;
}

test.afterAll(() => console.log(`\n${readFileSync(`${RESULTS}.md`, "utf8")}\nResults: ${RESULTS}.md and .json`));

for (const minutes of LENGTHS)
  test(`open ${minutes} min`, async ({ browser, page }) => {
    await start(page);
    const memory = await meter(browser, page);
    const began = Date.now();
    const outcome = await upload(page, minutes);
    const seconds = Math.round((Date.now() - began) / 1000);
    const settled = outcome === "ok" ? await memory.settled() : 0;
    await memory.stop();
    const sampleRate = outcome === "ok" ? await page.evaluate(() => new AudioContext().sampleRate) : 0;
    record({ scenario: "open", recording: fileFor(minutes), outcome, baseline: memory.baseline, peak: memory.peak(), settled, notes: `${seconds} s to editor and waveform${sampleRate ? `, decoded at ${sampleRate} Hz` : ""}` });
  });

for (const minutes of LOOP_LENGTHS)
  test(`open and close ${minutes} min ${LOOP_ITERATIONS} times`, async ({ browser, page }) => {
    await start(page);
    const memory = await meter(browser, page);
    let outcome = await upload(page, minutes);
    const afterClose: Megabytes[] = [];
    for (let i = 0; i < LOOP_ITERATIONS && outcome === "ok"; i++) {
      await goHome(page);
      afterClose.push(round(await memory.settled()));
      if (i === LOOP_ITERATIONS - 1) break;
      const opened = waitForOpen(page, minutes);
      await page.getByRole("button", { name: `Open ${fileFor(minutes)}` }).click();
      outcome = await opened;
    }
    await memory.stop();
    const growth = afterClose.length > 1 ? round((afterClose[afterClose.length - 1] - afterClose[0]) / (afterClose.length - 1)) : 0;
    record({ scenario: "open/close loop", recording: fileFor(minutes), outcome, baseline: memory.baseline, peak: memory.peak(), settled: afterClose[afterClose.length - 1] ?? 0, notes: `after each close: ${afterClose.join(", ")}; ${growth} MB per iteration` });
  });

test(`freeze and scrub ${SCRUB_LENGTH} min`, async ({ browser, page }) => {
  await start(page);
  const memory = await meter(browser, page);
  const outcome = await upload(page, SCRUB_LENGTH);
  let notes = "";
  if (outcome === "ok") {
    const opened = round(await memory.settled());
    await page.getByRole("button", { name: "Freeze" }).click();
    await page.evaluate(async () => {
      const { player } = window.__gd!;
      player.startScrub(0);
      for (let pass = 0; pass < 2; pass++)
        for (let step = 0; step <= 200; step++) {
          player.scrubTo((player.duration * (pass ? 200 - step : step)) / 200);
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      player.endScrub();
    });
    notes = `${opened} MB settled before freezing`;
  }
  const settled = outcome === "ok" ? await memory.settled() : 0;
  await memory.stop();
  record({ scenario: "freeze and scrub", recording: fileFor(SCRUB_LENGTH), outcome, baseline: memory.baseline, peak: memory.peak(), settled, notes });
});

test(`switch between ${SWITCH_LENGTHS.join(" and ")} min`, async ({ browser, page }) => {
  await start(page);
  const memory = await meter(browser, page);
  let outcome: Outcome = "ok";
  for (const minutes of SWITCH_LENGTHS) outcome = outcome === "ok" ? await upload(page, minutes) : outcome;
  const afterSwitch: Megabytes[] = [];
  for (let i = 0; i < SWITCH_ROUND_TRIPS * 2 && outcome === "ok"; i++) {
    const minutes = SWITCH_LENGTHS[i % 2];
    const opened = waitForOpen(page, minutes);
    await page.getByRole("button", { name: "Switch recording" }).click();
    await page.getByRole("menuitem", { name: fileFor(minutes).replace(/\.\w+$/, "") }).click();
    outcome = await opened;
    if (outcome === "ok") afterSwitch.push(round(await memory.settled()));
  }
  await memory.stop();
  record({ scenario: "switch", recording: SWITCH_LENGTHS.map(fileFor).join(" ↔ "), outcome, baseline: memory.baseline, peak: memory.peak(), settled: afterSwitch[afterSwitch.length - 1] ?? 0, notes: `after each switch: ${afterSwitch.join(", ")}` });
});
