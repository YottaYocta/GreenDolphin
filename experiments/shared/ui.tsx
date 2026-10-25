import { useEffect, useRef, type FC, type ReactNode } from "react";
import { AudioSlider, ModeToggle } from "../../src/frontend/components/PlaybackSettings";
import { renderWaveform, type Section } from "../../src/frontend/lib/waveform";
import { BANDS } from "../dsp/spectrum";
import type { ParamSpec, Params } from "../freeze/algorithms";

export const Panel: FC<{ title: string; aside?: ReactNode; children: ReactNode; className?: string }> = ({
  title,
  aside,
  children,
  className = "",
}) => (
  <section
    className={`flex flex-col gap-3 p-4 rounded-xl bg-white border border-border shadow-(--shadow-panel) min-w-0 ${className}`}
  >
    <header className="flex items-center justify-between gap-2">
      <h2 className="font-inria text-black/50 text-sm">{title}</h2>
      {aside}
    </header>
    {children}
  </section>
);

export const ActionButton: FC<{
  onClick: () => void;
  children: ReactNode;
  tone?: "neutral" | "play" | "freeze";
  disabled?: boolean;
}> = ({ onClick, children, tone = "neutral", disabled }) => {
  const toneClass = {
    neutral: "btn-surface",
    play: "rounded-md bg-play hover:bg-play-hover active:bg-play-active text-white [box-shadow:var(--shadow-btn-colored)]",
    freeze:
      "rounded-md bg-freeze hover:bg-freeze-hover active:bg-freeze-active text-white [box-shadow:var(--shadow-btn-colored)]",
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${toneClass} flex items-center justify-center gap-1.5 h-9 px-3 font-inria text-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed`}
    >
      {children}
    </button>
  );
};

export const Field: FC<{ label: string; children: ReactNode }> = ({ label, children }) => (
  <div className="flex flex-col gap-1 w-full">
    <span className="font-inria text-black/50 text-sm">{label}</span>
    {children}
  </div>
);

export const Segmented = <T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) => (
  <ModeToggle
    options={options.map((o) => ({ value: String(o.value), label: o.label }))}
    value={String(value)}
    onChange={(v) => onChange(options.find((o) => String(o.value) === v)!.value)}
  />
);

export const ParamControls: FC<{ specs: ParamSpec[]; values: Params; onChange: (next: Params) => void }> = ({
  specs,
  values,
  onChange,
}) => (
  <div className="flex flex-col gap-3">
    {specs.map((spec) => {
      const set = (v: number) => onChange({ ...values, [spec.key]: v });
      if (spec.options)
        return (
          <Field key={spec.key} label={spec.label}>
            <Segmented options={spec.options} value={values[spec.key]} onChange={set} />
          </Field>
        );
      const { min = 0, max = 1, step = 1 } = spec;
      return (
        <AudioSlider
          key={spec.key}
          label={spec.label}
          value={values[spec.key]}
          defaultValue={spec.default}
          min={min}
          max={max}
          step={step}
          onChange={set}
          formatValue={(v) => String(Math.round(v / step) * step)}
          unit={spec.unit ?? ""}
          onCommit={(v) => set(Math.max(min, Math.min(max, v)))}
        />
      );
    })}
  </div>
);

export const Stats: FC<{ items: [string, ReactNode][] }> = ({ items }) => (
  <dl className="grid grid-cols-[repeat(auto-fill,minmax(8rem,1fr))] gap-2">
    {items.map(([label, value]) => (
      <div key={label} className="flex flex-col gap-0.5 px-2.5 py-2 rounded-lg bg-surface-track border border-border">
        <dt className="font-inria text-black/50 text-xs">{label}</dt>
        <dd className="font-space-mono text-sm tabular-nums">{value}</dd>
      </div>
    ))}
  </dl>
);

export const Table: FC<{ head: string[]; rows: ReactNode[][] }> = ({ head, rows }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-sm">
      <thead>
        <tr className="font-inria text-black/50 text-left">
          {head.map((h) => (
            <th key={h} scope="col" className="font-normal px-2 py-1.5 border-b border-border-solid whitespace-nowrap">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="font-space-mono tabular-nums">
        {rows.map((row, i) => (
          <tr key={i} className="border-b border-border-solid last:border-0">
            {row.map((cell, j) => (
              <td key={j} className="px-2 py-1.5 whitespace-nowrap">
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

/** Full-recording overview; click or drag to move the cursor. */
export const WaveformPicker: FC<{
  buffer: AudioBuffer;
  cursor: number;
  onCursor: (sample: number) => void;
  highlight?: Section;
}> = ({ buffer, cursor, onCursor, highlight }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const draw = () => {
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
      renderWaveform(
        { data: buffer, viewport: { start: 0, end: buffer.length } },
        { resolution: 10000 },
        canvas,
      );
    };
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [buffer]);

  const pct = (sample: number) => `${(sample / buffer.length) * 100}%`;

  const seek = (clientX: number, el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    onCursor(Math.round(Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)) * buffer.length));
  };

  return (
    <div
      className="relative h-24 rounded-lg overflow-hidden bg-white border border-border cursor-crosshair touch-none"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        seek(e.clientX, e.currentTarget);
      }}
      onPointerMove={(e) => {
        if (e.buttons) seek(e.clientX, e.currentTarget);
      }}
    >
      <canvas ref={canvasRef} className="block w-full h-full pixelated" />
      {/* Overlays, so moving the cursor never redraws the canvas. */}
      {highlight && (
        <div
          className="absolute inset-y-0 bg-freeze/10 pointer-events-none"
          style={{ left: pct(highlight.start), width: pct(highlight.end - highlight.start) }}
        />
      )}
      <div
        className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-freeze pointer-events-none"
        style={{ left: pct(cursor) }}
      />
    </div>
  );
};

export interface Series {
  label: string;
  color: string;
  bands: number[];
}

const FREQ_TICKS = [50, 100, 250, 500, 1000, 2000, 4000, 8000, 16000];
const DB_MIN = -100;
const DB_MAX = 0;

/** Band spectra on a log-frequency axis. */
export const SpectrumChart: FC<{ series: Series[] }> = ({ series }) => {
  const w = 600;
  const h = 220;
  const x = (f: number) => (Math.log2(f / BANDS[0]) / Math.log2(BANDS[BANDS.length - 1] / BANDS[0])) * w;
  const y = (db: number) => ((DB_MAX - Math.max(DB_MIN, db)) / (DB_MAX - DB_MIN)) * h;
  return (
    <figure className="flex flex-col gap-2">
      <svg viewBox={`-30 -6 ${w + 36} ${h + 24}`} className="w-full h-auto" role="img" aria-label="Band spectrum comparison">
        {[-80, -60, -40, -20].map((db) => (
          <g key={db}>
            <line x1={0} x2={w} y1={y(db)} y2={y(db)} stroke="var(--color-border-solid)" />
            <text x={-6} y={y(db) + 3} fontSize={9} textAnchor="end" fill="var(--color-icon-muted)">
              {db}
            </text>
          </g>
        ))}
        {FREQ_TICKS.map((f) => (
          <g key={f}>
            <line x1={x(f)} x2={x(f)} y1={0} y2={h} stroke="var(--color-border-solid)" />
            <text x={x(f)} y={h + 14} fontSize={9} textAnchor="middle" fill="var(--color-icon-muted)">
              {f >= 1000 ? `${f / 1000}k` : f}
            </text>
          </g>
        ))}
        {series.map((s) => (
          <polyline
            key={s.label}
            fill="none"
            stroke={s.color}
            strokeWidth={1.75}
            strokeLinejoin="round"
            points={s.bands.map((db, i) => `${x(BANDS[i])},${y(db)}`).join(" ")}
          />
        ))}
      </svg>
      <figcaption className="flex flex-wrap gap-x-4 gap-y-1 font-inria text-xs text-black/60">
        {series.map((s) => (
          <span key={s.label} className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 rounded-full" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </figcaption>
    </figure>
  );
};
