import { useEffect, useMemo, useState, type FC } from "react";
import { PlayIcon, StopIcon } from "@phosphor-icons/react";
import { SoundTouchNode } from "@soundtouchjs/audio-worklet";
import { AudioSlider } from "../../src/frontend/components/PlaybackSettings";
import { formatBytes, formatMs, formatTime } from "../shared/format";
import type { Player } from "../shared/player";
import {
  ActionButton,
  Field,
  Panel,
  Segmented,
  Stats,
  Table,
  WaveformPicker,
} from "../shared/ui";
import {
  ENGINES,
  ENGINE_LABELS,
  concat,
  measureLatency,
  renderChunk,
  soundTouchProcessorUrl,
  type EngineId,
  type Settings,
} from "./engines";

type Mode = "full" | "chunk" | "stitched";
const MODE_LABELS: Record<Mode, string> = {
  full: "Whole file",
  chunk: "First chunk",
  stitched: "Stitched chunks",
};
const CHUNK_OPTIONS = [2, 5, 10, 30].map((v) => ({ value: v, label: `${v} s` }));
const PREROLL_OPTIONS = [0, 0.1, 0.25, 0.5].map((v) => ({ value: v, label: `${v} s` }));
/** Cap stitched renders so a long file doesn't lock the page. */
const STITCH_SECONDS = 60;

interface Run {
  engine: EngineId;
  mode: Mode;
  settings: Settings;
  /** Time until the first playable audio exists. */
  firstMs: number;
  totalMs: number;
  outputSeconds: number;
  latency: number;
  buffer: AudioBuffer;
}

interface LiveStats {
  underruns: number;
  blocks: number;
  latencyMs: number;
}

export const PipelineLab: FC<{ ctx: AudioContext; buffer: AudioBuffer; player: Player }> = ({ ctx, buffer, player }) => {
  const sr = buffer.sampleRate;
  const [settings, setSettings] = useState<Settings>({ semitones: 0, speed: 1 });
  const [playhead, setPlayhead] = useState(0);
  const [chunkSeconds, setChunkSeconds] = useState(5);
  const [preroll, setPreroll] = useState(0.25);
  const [runs, setRuns] = useState<Run[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [live, setLive] = useState<{ node: SoundTouchNode; source: AudioBufferSourceNode } | null>(null);
  const [liveStats, setLiveStats] = useState<LiveStats | null>(null);
  const [workletReady, setWorkletReady] = useState(false);

  useEffect(() => {
    SoundTouchNode.register(ctx, soundTouchProcessorUrl).then(() => setWorkletReady(true));
  }, [ctx]);

  // Live settings follow the sliders, like the app's audio chain.
  useEffect(() => {
    if (!live) return;
    live.node.pitchSemitones.value = settings.semitones;
    live.node.playbackRate.value = settings.speed;
    live.source.playbackRate.value = settings.speed;
  }, [live, settings]);

  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => {
      const m = live.node.metrics;
      setLiveStats({
        underruns: m?.underrunCount ?? 0,
        blocks: m?.blockCount ?? 0,
        latencyMs: ((ctx.baseLatency ?? 0) + (ctx.outputLatency ?? 0)) * 1000,
      });
    }, 500);
    return () => clearInterval(id);
  }, [live, ctx]);

  const stopLive = () => {
    live?.source.stop();
    live?.node.disconnect();
    setLive(null);
  };

  const startLive = () => {
    stopLive();
    player.stop();
    void ctx.resume();
    const node = new SoundTouchNode({ context: ctx });
    node.setStretchParameters({ overlapMs: 4 });
    node.connect(ctx.destination);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(node);
    source.start(0, playhead / sr);
    setLiveStats(null);
    setLive({ node, source });
  };

  const run = async (engineId: EngineId, mode: Mode) => {
    stopLive();
    setBusy(`${engineId}:${mode}`);
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r)));
    try {
      const engine = ENGINES[engineId];
      const s = { ...settings };
      const t0 = performance.now();
      if (mode === "full") {
        const out = await engine(buffer, s);
        const ms = performance.now() - t0;
        setRuns((prev) => [
          { engine: engineId, mode, settings: s, firstMs: ms, totalMs: ms, outputSeconds: out.duration, latency: 0, buffer: out },
          ...prev,
        ]);
        return;
      }
      const latency = await measureLatency(engine, s, sr);
      const tChunks = performance.now();
      const length = Math.round(chunkSeconds * sr);
      const end = mode === "chunk" ? playhead + length : Math.min(buffer.length, playhead + STITCH_SECONDS * sr);
      const parts: AudioBuffer[] = [];
      let firstMs = 0;
      for (let start = playhead; start < end; start += length) {
        parts.push(
          await renderChunk(engine, buffer, s, { start, length: Math.min(length, end - start), preroll: Math.round(preroll * sr), latency }),
        );
        if (parts.length === 1) firstMs = performance.now() - tChunks;
      }
      const out = concat(parts);
      setRuns((prev) => [
        {
          engine: engineId,
          mode,
          settings: s,
          firstMs,
          totalMs: performance.now() - tChunks,
          outputSeconds: out.duration,
          latency,
          buffer: out,
        },
        ...prev,
      ]);
    } finally {
      setBusy(null);
    }
  };

  const highlight = useMemo(
    () => ({ start: playhead, end: Math.min(buffer.length, playhead + chunkSeconds * sr) }),
    [playhead, chunkSeconds, sr, buffer.length],
  );

  return (
    <div className="flex flex-col gap-4">
      <Panel
        title="Playhead and chunk"
        aside={<span className="font-space-mono text-sm tabular-nums text-black/60">{formatTime(playhead / sr)}</span>}
      >
        <WaveformPicker buffer={buffer} cursor={playhead} onCursor={setPlayhead} highlight={highlight} />
      </Panel>

      <div className="grid gap-4 md:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <Panel title="Settings">
          <AudioSlider
            label="Pitch"
            value={settings.semitones}
            defaultValue={0}
            min={-12}
            max={12}
            step={0.1}
            onChange={(v) => setSettings((s) => ({ ...s, semitones: v }))}
            formatValue={(v) => `${v > 0 ? "+" : ""}${Math.round(v * 10) / 10}`}
            unit="#"
            onCommit={(v) => setSettings((s) => ({ ...s, semitones: Math.max(-12, Math.min(12, v)) }))}
            signed
          />
          <AudioSlider
            label="Speed"
            value={settings.speed}
            defaultValue={1}
            min={0.1}
            max={1.9}
            step={0.01}
            onChange={(v) => setSettings((s) => ({ ...s, speed: v }))}
            formatValue={(v) => `${Math.round(v * 100)}`}
            unit="%"
            onCommit={(v) => setSettings((s) => ({ ...s, speed: Math.max(10, Math.min(190, v)) / 100 }))}
          />
          <Field label="Chunk length">
            <Segmented options={CHUNK_OPTIONS} value={chunkSeconds} onChange={setChunkSeconds} />
          </Field>
          <Field label="Preroll (warm-up, discarded)">
            <Segmented options={PREROLL_OPTIONS} value={preroll} onChange={setPreroll} />
          </Field>
        </Panel>

        <Panel title="Live pipeline (current app)">
          <p className="font-inria text-sm text-black/60">
            BufferSource → SoundTouch worklet → output, exactly like the app. Sliders apply instantly; the audio thread
            does the work every render quantum.
          </p>
          <div className="flex flex-wrap gap-2">
            <ActionButton tone="play" disabled={!workletReady} onClick={startLive}>
              <PlayIcon weight="fill" /> Play live from playhead
            </ActionButton>
            <ActionButton onClick={stopLive}>
              <StopIcon weight="fill" /> Stop
            </ActionButton>
          </div>
          {liveStats && (
            <Stats
              items={[
                ["Underruns", liveStats.underruns],
                ["Render blocks", liveStats.blocks],
                ["Output latency", formatMs(liveStats.latencyMs)],
              ]}
            />
          )}
        </Panel>
      </div>

      <Panel title="Offline rendering" aside={busy && <span className="text-sm text-black/40">Rendering…</span>}>
        <p className="font-inria text-sm text-black/60">
          “First chunk” is what a settings change would cost before audio could resume from the playhead. “Stitched”
          renders up to {STITCH_SECONDS} s of consecutive chunks so seams are audible.
        </p>
        <div className="flex flex-col gap-2">
          {(Object.keys(ENGINES) as EngineId[]).map((engineId) => (
            <div key={engineId} className="flex flex-wrap items-center gap-2">
              <span className="font-inria text-sm w-64 shrink-0">{ENGINE_LABELS[engineId]}</span>
              {(Object.keys(MODE_LABELS) as Mode[]).map((mode) => (
                <ActionButton key={mode} disabled={!!busy} onClick={() => run(engineId, mode)}>
                  {MODE_LABELS[mode]}
                </ActionButton>
              ))}
            </div>
          ))}
        </div>
        {runs.length > 0 && (
          <Table
            head={["Engine", "Mode", "Pitch / speed", "First audio", "Total", "× realtime", "Latency", "Output RAM", ""]}
            rows={runs.map((r) => [
              r.engine === "soundtouch" ? "SoundTouch" : "TS vocoder",
              MODE_LABELS[r.mode],
              `${r.settings.semitones > 0 ? "+" : ""}${r.settings.semitones} / ${Math.round(r.settings.speed * 100)}%`,
              formatMs(r.firstMs),
              formatMs(r.totalMs),
              `${(r.outputSeconds / (r.totalMs / 1000)).toFixed(1)}×`,
              `${r.latency} smp`,
              formatBytes(r.buffer.length * r.buffer.numberOfChannels * 4),
              <button
                type="button"
                className="font-inria text-play-active hover:underline cursor-pointer"
                onClick={() => {
                  stopLive();
                  player.play(r.buffer);
                }}
              >
                Listen
              </button>,
            ])}
          />
        )}
      </Panel>
    </div>
  );
};
