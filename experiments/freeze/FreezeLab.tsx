import { useEffect, useMemo, useState, type FC } from "react";
import { PlayIcon, SnowflakeIcon, StopIcon } from "@phosphor-icons/react";
import { formatMs, formatTime } from "../shared/format";
import type { Player } from "../shared/player";
import {
  ActionButton,
  Panel,
  ParamControls,
  SpectrumChart,
  Stats,
  Table,
  WaveformPicker,
  type Series,
} from "../shared/ui";
import { AudioSlider } from "../../src/frontend/components/PlaybackSettings";
import { ALGORITHMS, defaultParams, type ParamSpec, type Params } from "./algorithms";
import { createFreezeWorker, type FreezeResult, type FreezeWorker } from "./client";
import { MOMENT_SECONDS, type FreezeRequest } from "./protocol";
import { createRealtimeFreeze, registerFreezeProcessor, type RealtimeFreeze } from "./realtime";
import type { RealtimeConfig } from "./realtimeProtocol";

const LEAD_SECONDS = 2.5;
const COLORS = ["var(--color-freeze)", "#8b5cf6", "#f97316", "#ec4899", "#eab308", "#06b6d4", "#ef4444"];

const db = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1)} dB`;
const pct = (v: number) => `${(v * 100).toFixed(0)}%`;

const REALTIME_SPECS: ParamSpec[] = [
  { key: "n", label: "Window", default: 2048, options: [2048, 4096, 8192, 16384].map((v) => ({ value: v, label: `${v / 1024}k` })) },
  {
    key: "phase",
    label: "Phase",
    default: 1,
    options: [
      { value: 0, label: "Random" },
      { value: 1, label: "Advance" },
      { value: 2, label: "Locked" },
    ],
  },
  { key: "spreadMs", label: "Magnitude averaging", default: 20, min: 0, max: 300, step: 10, unit: "ms" },
  { key: "spanMs", label: "Creep span (0 = unbounded)", default: 250, min: 0, max: 2000, step: 10, unit: "ms" },
  {
    key: "multires",
    label: "Multi-res",
    default: 0,
    options: [
      { value: 0, label: "Off" },
      { value: 1, label: "On" },
    ],
  },
  { key: "low", label: "Multi-res low window", default: 16384, options: [16384, 32768].map((v) => ({ value: v, label: `${v / 1024}k` })) },
  { key: "fc", label: "Multi-res crossover", default: 300, min: 80, max: 1500, step: 10, unit: "Hz" },
];
/** Slow forward creep rather than a dead stop: closest to AudioStretch by ear. */
const DEFAULT_SPEED = 0.1;
const toConfig = (p: Params) => p as unknown as RealtimeConfig;

/** Keeps one render in flight; requests made meanwhile collapse into the newest. */
const createLiveFreeze = (worker: FreezeWorker, onResult: (r: FreezeResult) => void) => {
  let next: FreezeRequest | null = null;
  let running = false;
  let generation = 0;
  const pump = async () => {
    running = true;
    while (next) {
      const req = next;
      next = null;
      const gen = generation;
      const r = await worker.render(req);
      if (gen === generation) onResult(r);
    }
    running = false;
  };
  return {
    request: (req: FreezeRequest) => {
      next = req;
      if (!running) void pump();
    },
    cancel: () => {
      generation++;
      next = null;
    },
  };
};

export const FreezeLab: FC<{ ctx: AudioContext; buffer: AudioBuffer; player: Player }> = ({ ctx, buffer, player }) => {
  const sr = buffer.sampleRate;
  const [cursor, setCursor] = useState(() => Math.round(buffer.length * 0.3));
  const [algoId, setAlgoId] = useState("scan");
  const [params, setParams] = useState<Record<string, Params>>(() =>
    Object.fromEntries(ALGORITHMS.map((a) => [a.id, defaultParams(a)])),
  );
  const [results, setResults] = useState<FreezeResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState(false);
  const [worker, setWorker] = useState<FreezeWorker | null>(null);

  useEffect(() => {
    const w = createFreezeWorker(buffer);
    setWorker(w);
    return () => w.terminate();
  }, [buffer]);

  const [rt, setRt] = useState<RealtimeFreeze | null>(null);
  const [rtOn, setRtOn] = useState(false);
  const [rtParams, setRtParams] = useState<Params>(() => Object.fromEntries(REALTIME_SPECS.map((p) => [p.key, p.default])));
  const [rtSpeed, setRtSpeed] = useState(DEFAULT_SPEED);

  useEffect(() => {
    let engine: RealtimeFreeze | null = null;
    let cancelled = false;
    void registerFreezeProcessor(ctx).then(() => {
      if (cancelled) return;
      const e = createRealtimeFreeze(ctx, buffer, ctx.destination);
      engine = e;
      e.onPosition((p) => setCursor(Math.round(p)));
      setRt(e);
    });
    return () => {
      cancelled = true;
      engine?.dispose();
    };
  }, [ctx, buffer]);

  const liveFreeze = useMemo(
    () =>
      worker &&
      createLiveFreeze(worker, (r) => {
        player.crossfade(r.buffer);
        setResults([r]);
      }),
    [worker, player],
  );

  const algo = ALGORITHMS.find((a) => a.id === algoId)!;
  const half = Math.round((MOMENT_SECONDS / 2) * sr);
  const moment = useMemo(() => ({ start: cursor - half, end: cursor + half }), [cursor, half]);

  const requestLive = (req: Partial<FreezeRequest>) => {
    if (live) liveFreeze?.request({ id: algoId, at: cursor, params: params[algoId], ...req });
  };
  const stopLive = () => {
    liveFreeze?.cancel();
    setLive(false);
    if (rtOn) {
      rt?.stop();
      setRtOn(false);
    }
  };

  const startRealtime = () => {
    if (!rt) return;
    stopLive();
    player.stop();
    rt.configure(toConfig(rtParams));
    rt.seek(cursor, true);
    rt.setRate(rtSpeed);
    rt.start();
    setRtOn(true);
  };

  const setSpeed = (v: number) => {
    setRtSpeed(v);
    rt?.setRate(v);
  };

  const withBusy = async (work: (w: FreezeWorker) => Promise<void>) => {
    if (!worker) return;
    setBusy(true);
    try {
      await work(worker);
    } finally {
      setBusy(false);
    }
  };

  const renderOne = (andPlay: "freeze" | "lead") => {
    stopLive();
    void withBusy(async (w) => {
      const r = await w.render({ id: algoId, at: cursor, params: params[algoId] });
      setResults((prev) => [r, ...prev.filter((p) => p.algo !== algoId)]);
      if (andPlay === "freeze") player.play(r.buffer, { loop: true });
      else player.leadIn(buffer, cursor / sr, LEAD_SECONDS, r.buffer);
    });
  };

  const compareAll = () =>
    void withBusy(async (w) =>
      setResults(await Promise.all(ALGORITHMS.map((a) => w.render({ id: a.id, at: cursor, params: params[a.id] })))),
    );

  const current = results.find((r) => r.algo === algoId);
  const series: Series[] = [
    ...(results[0] ? [{ label: "Source moment", color: "var(--color-neutral-2)", bands: results[0].source }] : []),
    ...results.map((r, i) => ({
      label: ALGORITHMS.find((a) => a.id === r.algo)!.label,
      color: COLORS[i % COLORS.length],
      bands: r.bands,
    })),
  ];

  return (
    <div className="flex flex-col gap-4">
      <Panel
        title="Freeze point"
        aside={<span className="font-space-mono text-sm tabular-nums text-black/60">{formatTime(cursor / sr)}</span>}
      >
        <WaveformPicker
          buffer={buffer}
          cursor={cursor}
          onCursor={(c) => {
            setCursor(c);
            setResults([]);
            requestLive({ at: c });
            if (rtOn) rt?.seek(c);
          }}
          highlight={moment}
        />
        <div className="flex flex-wrap gap-2">
          <ActionButton
            tone="play"
            onClick={() => {
              stopLive();
              player.play(buffer, { offset: Math.max(0, cursor / sr - LEAD_SECONDS), duration: LEAD_SECONDS + 1 });
            }}
          >
            <PlayIcon weight="fill" /> Play around cursor
          </ActionButton>
          <ActionButton
            onClick={() => {
              stopLive();
              player.play(buffer, { offset: moment.start / sr, duration: MOMENT_SECONDS });
            }}
          >
            Play moment ({MOMENT_SECONDS * 1000} ms)
          </ActionButton>
          <ActionButton
            tone={live ? "freeze" : "neutral"}
            onClick={() => {
              if (live) {
                stopLive();
                player.stop();
              } else {
                setLive(true);
                liveFreeze?.request({ id: algoId, at: cursor, params: params[algoId] });
              }
            }}
          >
            <SnowflakeIcon weight="fill" /> {live ? "Live freeze on" : "Live freeze"}
          </ActionButton>
          <ActionButton
            onClick={() => {
              stopLive();
              player.stop();
            }}
          >
            <StopIcon weight="fill" /> Stop
          </ActionButton>
        </div>
      </Panel>

      <Panel
        title="Realtime freeze (AudioWorklet phase vocoder)"
        aside={
          <ActionButton
            tone={rtOn ? "freeze" : "neutral"}
            disabled={!rt}
            onClick={() => {
              if (rtOn) stopLive();
              else startRealtime();
            }}
          >
            <SnowflakeIcon weight="fill" /> {rtOn ? "Realtime on" : "Start realtime"}
          </ActionButton>
        }
      >
        <p className="font-inria text-sm text-black/60">
          Synthesises one frame at a time from the read head; nothing is pre-rendered. Drag the freeze point to scrub;
          at 0% speed it holds, at 100% it plays the recording.
        </p>
        <AudioSlider
          label="Speed"
          value={rtSpeed}
          defaultValue={DEFAULT_SPEED}
          min={0}
          max={1.5}
          step={0.01}
          onChange={setSpeed}
          formatValue={(v) => `${Math.round(v * 100)}`}
          unit="%"
          onCommit={(v) => setSpeed(Math.max(0, Math.min(150, v)) / 100)}
        />
        <div className="grid gap-x-6 md:grid-cols-2">
          <ParamControls
            specs={REALTIME_SPECS.slice(0, 4)}
            values={rtParams}
            onChange={(next) => {
              setRtParams(next);
              if (rtOn) rt?.configure(toConfig(next));
            }}
          />
          <ParamControls
            specs={REALTIME_SPECS.slice(4)}
            values={rtParams}
            onChange={(next) => {
              setRtParams(next);
              if (rtOn) rt?.configure(toConfig(next));
            }}
          />
        </div>
      </Panel>

      <div className="grid gap-4 md:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <Panel title="Algorithm">
          <select
            aria-label="Algorithm"
            value={algoId}
            onChange={(e) => {
              const id = e.currentTarget.value;
              setAlgoId(id);
              requestLive({ id, params: params[id] });
            }}
            className="h-9 px-2 rounded-lg border border-border bg-surface-track font-inria text-sm cursor-pointer"
          >
            {ALGORITHMS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
          <p className="font-inria text-sm text-black/60">{algo.description}</p>
          <ParamControls
            specs={algo.params}
            values={params[algoId]}
            onChange={(next) => {
              setParams((prev) => ({ ...prev, [algoId]: next }));
              requestLive({ params: next });
            }}
          />
          <div className="flex flex-wrap gap-2 pt-1">
            <ActionButton tone="freeze" disabled={busy} onClick={() => renderOne("lead")}>
              <SnowflakeIcon weight="fill" /> Lead-in → freeze
            </ActionButton>
            <ActionButton disabled={busy} onClick={() => renderOne("freeze")}>
              Freeze only
            </ActionButton>
            <ActionButton disabled={busy} onClick={compareAll}>
              Compare all
            </ActionButton>
          </div>
        </Panel>

        <Panel title="Spectrum: source moment vs freeze" aside={busy && <span className="text-sm text-black/40">Rendering…</span>}>
          <SpectrumChart series={series} />
          {current && (
            <Stats
              items={[
                ["Build time", formatMs(current.ms)],
                ["Level vs source", db(current.comparison.levelDb)],
                ["Timbre distance", `${current.comparison.shapeDb.toFixed(1)} dB`],
                ["Low (<250 Hz) share", `${pct(current.comparison.lowShare[0])} → ${pct(current.comparison.lowShare[1])}`],
              ]}
            />
          )}
          {results.length > 1 && (
            <Table
              head={["Algorithm", "Build", "Level", "Timbre dist.", "Low share", ""]}
              rows={results.map((r) => [
                ALGORITHMS.find((a) => a.id === r.algo)!.label,
                formatMs(r.ms),
                db(r.comparison.levelDb),
                `${r.comparison.shapeDb.toFixed(1)} dB`,
                `${pct(r.comparison.lowShare[0])} → ${pct(r.comparison.lowShare[1])}`,
                <button
                  type="button"
                  className="font-inria text-freeze hover:underline cursor-pointer"
                  onClick={() => player.leadIn(buffer, cursor / sr, LEAD_SECONDS, r.buffer)}
                >
                  Listen
                </button>,
              ])}
            />
          )}
        </Panel>
      </div>
    </div>
  );
};
