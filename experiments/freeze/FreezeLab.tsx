import { useMemo, useState, type FC } from "react";
import { PlayIcon, SnowflakeIcon, StopIcon } from "@phosphor-icons/react";
import { getCachedChannels } from "../../src/frontend/lib/channelCache";
import { bandSpectrum, compareSpectra, type SpectrumComparison } from "../dsp/spectrum";
import { formatMs, formatTime } from "../shared/format";
import type { Player } from "../shared/player";
import {
  ActionButton,
  Panel,
  ParamControls,
  Segmented,
  SpectrumChart,
  Stats,
  Table,
  WaveformPicker,
  type Series,
} from "../shared/ui";
import { ALGORITHMS, defaultParams, type Params } from "./algorithms";

const MOMENT_SECONDS = 0.3;
const LEAD_SECONDS = 2.5;
const COLORS = ["var(--color-freeze)", "#8b5cf6", "#f97316", "#ec4899"];

interface Result {
  algo: string;
  buffer: AudioBuffer;
  ms: number;
  bands: number[];
  comparison: SpectrumComparison;
}

const db = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1)} dB`;
const pct = (v: number) => `${(v * 100).toFixed(0)}%`;

export const FreezeLab: FC<{ ctx: AudioContext; buffer: AudioBuffer; player: Player }> = ({ ctx, buffer, player }) => {
  const sr = buffer.sampleRate;
  const [cursor, setCursor] = useState(() => Math.round(buffer.length * 0.3));
  const [algoId, setAlgoId] = useState(ALGORITHMS[2].id);
  const [params, setParams] = useState<Record<string, Params>>(() =>
    Object.fromEntries(ALGORITHMS.map((a) => [a.id, defaultParams(a)])),
  );
  const [results, setResults] = useState<Result[]>([]);
  const [busy, setBusy] = useState(false);

  const algo = ALGORITHMS.find((a) => a.id === algoId)!;
  const half = Math.round((MOMENT_SECONDS / 2) * sr);
  const moment = useMemo(() => ({ start: cursor - half, end: cursor + half }), [cursor, half]);
  const sourceBands = useMemo(
    () => bandSpectrum(getCachedChannels(buffer), moment.start, moment.end, sr),
    [buffer, moment, sr],
  );

  const render = (id: string): Result => {
    const a = ALGORITHMS.find((x) => x.id === id)!;
    const t0 = performance.now();
    const out = a.run(buffer, cursor, ctx, params[id]);
    const ms = performance.now() - t0;
    const bands = bandSpectrum(getCachedChannels(out), 0, Math.min(out.length, 2 * sr), sr);
    return { algo: id, buffer: out, ms, bands, comparison: compareSpectra(sourceBands, bands) };
  };

  // Defer heavy work a frame so the busy state paints first.
  const withBusy = (work: () => void) => {
    setBusy(true);
    requestAnimationFrame(() =>
      setTimeout(() => {
        try {
          work();
        } finally {
          setBusy(false);
        }
      }),
    );
  };

  const renderOne = (andPlay: "freeze" | "lead" | null) =>
    withBusy(() => {
      const r = render(algoId);
      setResults((prev) => [r, ...prev.filter((p) => p.algo !== algoId)]);
      if (andPlay === "freeze") player.play(r.buffer, { loop: true });
      if (andPlay === "lead") player.leadIn(buffer, cursor / sr, LEAD_SECONDS, r.buffer);
    });

  const compareAll = () => withBusy(() => setResults(ALGORITHMS.map((a) => render(a.id))));

  const current = results.find((r) => r.algo === algoId);
  const series: Series[] = [
    { label: "Source moment", color: "var(--color-neutral-2)", bands: sourceBands },
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
          }}
          highlight={moment}
        />
        <div className="flex flex-wrap gap-2">
          <ActionButton
            tone="play"
            onClick={() => player.play(buffer, { offset: Math.max(0, cursor / sr - LEAD_SECONDS), duration: LEAD_SECONDS + 1 })}
          >
            <PlayIcon weight="fill" /> Play around cursor
          </ActionButton>
          <ActionButton onClick={() => player.play(buffer, { offset: moment.start / sr, duration: MOMENT_SECONDS, loop: false })}>
            Play moment ({MOMENT_SECONDS * 1000} ms)
          </ActionButton>
          <ActionButton onClick={player.stop}>
            <StopIcon weight="fill" /> Stop
          </ActionButton>
        </div>
      </Panel>

      <div className="grid gap-4 md:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <Panel title="Algorithm">
          <Segmented options={ALGORITHMS.map((a) => ({ value: a.id, label: a.label }))} value={algoId} onChange={setAlgoId} />
          <p className="font-inria text-sm text-black/60">{algo.description}</p>
          <ParamControls
            specs={algo.params}
            values={params[algoId]}
            onChange={(next) => setParams((prev) => ({ ...prev, [algoId]: next }))}
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
