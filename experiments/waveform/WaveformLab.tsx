import { useEffect, useMemo, useRef, useState, type FC } from "react";
import { MIN_RANGE_THRESHOLD } from "../../src/frontend/lib/constants";
import { clampSection } from "../../src/frontend/lib/util";
import { renderWaveform, type Section } from "../../src/frontend/lib/waveform";
import { ActionButton, Field, Panel, Segmented, Stats, Table } from "../shared/ui";
import { formatBytes, formatMs } from "../shared/format";
import { buildPyramid, renderPyramid, type PeakMode } from "./peaks";

const SWEEP_MS = 4000;

interface Timing {
  avg: number;
  p95: number;
  max: number;
}

const summarise = (samples: number[]): Timing => {
  const sorted = [...samples].sort((a, b) => a - b);
  return {
    avg: samples.reduce((a, b) => a + b, 0) / Math.max(1, samples.length),
    p95: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
    max: sorted[sorted.length - 1] ?? 0,
  };
};

export const WaveformLab: FC<{ buffer: AudioBuffer; encodedBytes: number }> = ({ buffer, encodedBytes }) => {
  const currentRef = useRef<HTMLCanvasElement>(null);
  const pyramidRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<PeakMode>("mean");
  const [live, setLive] = useState<{ current: number; pyramid: number; block: number; zoom: number } | null>(null);
  const [sweep, setSweep] = useState<{ current: Timing; pyramid: Timing; frames: number } | null>(null);
  const [sweeping, setSweeping] = useState(false);

  const build = useMemo(() => {
    const t0 = performance.now();
    const pyramid = buildPyramid(buffer);
    const pyramidMs = performance.now() - t0;
    // Time a fresh copy; getCachedChannels may already be warm from another tab.
    const t1 = performance.now();
    for (let c = 0; c < buffer.numberOfChannels; c++) buffer.copyFromChannel(new Float32Array(buffer.length), c);
    return { pyramid, pyramidMs, cacheMs: performance.now() - t1 };
  }, [buffer]);

  // Mutable view + timing shared by the rAF loop and gesture handlers (not React state).
  const view = useMemo(
    () => ({
      viewport: { start: 0, end: buffer.length } as Section,
      dirty: true,
      times: { current: 0, pyramid: 0, block: 0 },
      sweep: null as null | { t0: number; current: number[]; pyramid: number[] },
    }),
    [buffer],
  );

  useEffect(() => {
    const canvases = [currentRef.current!, pyramidRef.current!];
    const bounds = { start: 0, end: buffer.length };
    const minLen = Math.floor(MIN_RANGE_THRESHOLD * buffer.length);
    let raf = 0;

    const resize = () => {
      for (const c of canvases) {
        c.width = c.clientWidth;
        c.height = c.clientHeight;
      }
      view.dirty = true;
    };

    const frame = (now: number) => {
      const s = view.sweep;
      if (s) {
        // Zoom from the full file into the minimum range around the middle and back out.
        const t = Math.min(1, (now - s.t0) / SWEEP_MS);
        const depth = 1 - Math.abs(2 * t - 1);
        const len = buffer.length * (minLen / buffer.length) ** depth;
        const mid = buffer.length / 2;
        view.viewport = clampSection({ start: Math.floor(mid - len / 2), end: Math.floor(mid + len / 2) }, bounds);
        view.dirty = true;
      }
      if (view.dirty) {
        view.dirty = false;
        const t0 = performance.now();
        renderWaveform({ data: buffer, viewport: view.viewport }, { resolution: 10000 }, canvases[0]);
        const t1 = performance.now();
        view.times.block = renderPyramid(build.pyramid, buffer, view.viewport, canvases[1], mode);
        const t2 = performance.now();
        view.times.current = t1 - t0;
        view.times.pyramid = t2 - t1;
        if (s) {
          s.current.push(t1 - t0);
          s.pyramid.push(t2 - t1);
          if (now - s.t0 >= SWEEP_MS) {
            view.sweep = null;
            setSweep({ current: summarise(s.current), pyramid: summarise(s.pyramid), frames: s.current.length });
            setSweeping(false);
          }
        }
      }
      raf = requestAnimationFrame(frame);
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const { start, end } = view.viewport;
      const len = end - start;
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        const shift = e.deltaX * (len / 400);
        view.viewport = clampSection({ start: start + shift, end: end + shift }, bounds);
      } else {
        const f = (e.clientX - rect.left) / rect.width;
        const anchor = start + f * len;
        const next = Math.max(minLen, Math.min(buffer.length, len * (1 + e.deltaY / (e.ctrlKey ? 100 : 500))));
        view.viewport = clampSection({ start: anchor - next * f, end: anchor + next * (1 - f) }, bounds);
      }
      view.dirty = true;
    };

    const onPointerDown = (e: PointerEvent) => {
      const el = e.currentTarget as HTMLElement;
      el.setPointerCapture(e.pointerId);
      const startX = e.clientX;
      const initial = view.viewport;
      const width = el.getBoundingClientRect().width;
      const move = (m: PointerEvent) => {
        const shift = ((startX - m.clientX) / width) * (initial.end - initial.start);
        view.viewport = clampSection({ start: initial.start + shift, end: initial.end + shift }, bounds);
        view.dirty = true;
      };
      const up = () => {
        el.removeEventListener("pointermove", move);
        el.removeEventListener("pointerup", up);
      };
      el.addEventListener("pointermove", move);
      el.addEventListener("pointerup", up);
    };

    const observer = new ResizeObserver(resize);
    for (const c of canvases) {
      observer.observe(c);
      c.addEventListener("wheel", onWheel, { passive: false });
      c.addEventListener("pointerdown", onPointerDown);
    }
    const stats = setInterval(() => {
      const { start, end } = view.viewport;
      setLive({ ...view.times, zoom: buffer.length / (end - start) });
    }, 250);
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(stats);
      observer.disconnect();
      for (const c of canvases) {
        c.removeEventListener("wheel", onWheel);
        c.removeEventListener("pointerdown", onPointerDown);
      }
    };
  }, [buffer, build, mode, view]);

  const decodedBytes = buffer.length * buffer.numberOfChannels * 4;
  const canvasClass = "block w-full h-40 rounded-lg border border-border bg-white pixelated touch-none cursor-grab";

  return (
    <div className="flex flex-col gap-4">
      <Panel
        title="Side by side"
        aside={
          live && (
            <span className="font-space-mono text-sm tabular-nums text-black/60">
              {live.zoom.toFixed(1)}× · {live.block === 1 ? "raw" : `${live.block} smp/bin`}
            </span>
          )
        }
      >
        <p className="font-inria text-sm text-black/60">Scroll to zoom, shift-scroll or drag to pan. Both canvases share the viewport.</p>
        <Field label={`Current: renderWaveform scan · ${live ? formatMs(live.current) : "–"} / frame`}>
          <canvas ref={currentRef} className={canvasClass} />
        </Field>
        <Field label={`Peak pyramid · ${live ? formatMs(live.pyramid) : "–"} / frame`}>
          <canvas ref={pyramidRef} className={canvasClass} />
        </Field>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-64">
            <Field label="Pyramid bar value">
              <Segmented
                options={[
                  { value: "mean", label: "Mean |x| (current look)" },
                  { value: "peak", label: "Peak" },
                ]}
                value={mode}
                onChange={setMode}
              />
            </Field>
          </div>
          <ActionButton
            disabled={sweeping}
            onClick={() => {
              setSweeping(true);
              view.sweep = { t0: performance.now(), current: [], pyramid: [] };
            }}
          >
            {sweeping ? "Sweeping…" : "Benchmark zoom sweep"}
          </ActionButton>
        </div>
        {sweep && (
          <Table
            head={["Renderer", "Avg / frame", "p95", "Max", "Frames"]}
            rows={[
              ["Current scan", formatMs(sweep.current.avg), formatMs(sweep.current.p95), formatMs(sweep.current.max), sweep.frames],
              ["Peak pyramid", formatMs(sweep.pyramid.avg), formatMs(sweep.pyramid.p95), formatMs(sweep.pyramid.max), sweep.frames],
            ]}
          />
        )}
      </Panel>

      <Panel title="Memory">
        <Stats
          items={[
            ["Encoded file", formatBytes(encodedBytes)],
            ["Decoded AudioBuffer", formatBytes(decodedBytes)],
            ["Channel cache copy (current)", formatBytes(decodedBytes)],
            ["Peak pyramid", formatBytes(build.pyramid.bytes)],
            ["Pyramid build", formatMs(build.pyramidMs)],
            ["Cache copy build", formatMs(build.cacheMs)],
            ["Levels", `${build.pyramid.levels.length} (${build.pyramid.levels[0].blockSize}–${build.pyramid.levels[build.pyramid.levels.length - 1].blockSize})`],
          ]}
        />
        <p className="font-inria text-sm text-black/60">
          The decoded buffer is needed for playback today, so the pyramid alone doesn't free it. It removes the per-frame
          scan and the duplicate channel copy, and makes the waveform independent of the decoded audio if playback ever
          streams from the encoded file.
        </p>
      </Panel>
    </div>
  );
};
