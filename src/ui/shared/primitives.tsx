import { useRef, type ReactNode } from "react";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { ArrowClockwiseIcon, XIcon } from "@phosphor-icons/react";
import { clamp } from "../Editor/Timeline/geometry";
import { drag } from "./drag";

export function Dialog({ title, open, onOpenChange, children }: { title: string; open: boolean; onOpenChange: (open: boolean) => void; children: ReactNode }) {
  return (
    <BaseDialog.Root open={open} onOpenChange={onOpenChange}>
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="fixed inset-0 bg-black/20 z-40" />
        <BaseDialog.Popup className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-84 max-w-[calc(100vw-2rem)] rounded-xl bg-white border border-border [box-shadow:var(--shadow-dialog)] flex flex-col outline-none">
          <div className="flex items-center justify-center h-12 px-8 border-b border-border relative">
            <BaseDialog.Title className="font-inria text-black/40 text-lg/6">{title}</BaseDialog.Title>
            <BaseDialog.Close aria-label="Close" className="btn-surface size-8 absolute right-2 outline-none">
              <XIcon size={16} weight="bold" className="opacity-40" />
            </BaseDialog.Close>
          </div>
          <div className="p-6">{children}</div>
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}

export function ModeToggle<T extends string>({ options, value, onChange }: { options: readonly { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div role="radiogroup" className="flex flex-1 gap-0.5 rounded-lg border border-border bg-surface-track p-0.5 [box-shadow:var(--shadow-inset-dim)]">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-md px-2 py-1 font-inria text-sm/4.5 cursor-pointer ${value === o.value ? "bg-white text-black border border-border [box-shadow:var(--shadow-btn)]" : "text-black/40 hover:text-black/70"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function NumericInput({ value, unit, onCommit }: { value: string; unit?: string; onCommit: (v: number) => void }) {
  return (
    <label className="flex items-center gap-1 px-1 py-0.5 rounded-sm bg-surface-input w-18 shrink-0 cursor-text">
      <input
        key={value}
        defaultValue={value}
        inputMode="decimal"
        className="font-space-mono text-black/60 text-base/5 tabular-nums bg-transparent outline-none min-w-0 w-full text-right"
        onFocus={(e) => e.currentTarget.select()}
        onBlur={(e) => {
          const n = parseFloat(e.currentTarget.value.replace(/^\+/, ""));
          if (Number.isFinite(n)) onCommit(n);
          else e.currentTarget.value = value;
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            e.currentTarget.value = value;
            e.currentTarget.blur();
          }
        }}
      />
      {unit && <span className="text-sm text-black/20 shrink-0">{unit}</span>}
    </label>
  );
}

export interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  display: (v: number) => string;
  parse: (entered: number) => number;
  unit: string;
  onChange: (v: number) => void;
}

export function Slider({ label, value, min, max, step, defaultValue, display, parse, unit, onChange }: SliderProps) {
  const track = useRef<HTMLDivElement>(null);
  const set = (v: number) => onChange(clamp(Math.round(v / step) * step, min, max));
  const fromX = (x: number) => {
    const r = track.current!.getBoundingClientRect();
    set(min + clamp((x - r.left) / r.width, 0, 1) * (max - min));
  };
  return (
    <div className="flex flex-col self-stretch">
      <div className="font-inria text-black/50 text-sm flex items-center gap-1.5 h-5">
        {label}
        {value !== defaultValue && (
          <button aria-label={`Reset ${label}`} onClick={() => onChange(defaultValue)} className="size-5 rounded-sm text-black/40 hover:text-black/70 hover:bg-black/5 flex items-center justify-center cursor-pointer">
            <ArrowClockwiseIcon size={13} weight="fill" />
          </button>
        )}
      </div>
      <div className="flex items-center gap-4">
        <div
          ref={track}
          role="slider"
          aria-label={label}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          className="relative flex-1 h-2 rounded-[3px] bg-surface-track border border-border cursor-pointer touch-none"
          onPointerDown={(e) => {
            fromX(e.clientX);
            drag(e, fromX);
          }}
        >
          <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-3 rounded-xs [box-shadow:var(--shadow-btn)] bg-surface border border-border" style={{ left: `${((value - min) / (max - min)) * 100}%` }} />
        </div>
        <NumericInput value={display(value)} unit={unit} onCommit={(v) => set(parse(v))} />
      </div>
    </div>
  );
}
