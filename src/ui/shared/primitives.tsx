import { useRef, type ComponentProps, type ReactNode } from "react";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { ArrowClockwiseIcon, SpinnerIcon, XIcon, type Icon } from "@phosphor-icons/react";
import { clamp } from "../Editor/Timeline/geometry";
import { drag } from "./drag";

export const DialogClose = BaseDialog.Close;

export function Dialog({ title, open, onOpenChange, children }: { title: string; open: boolean; onOpenChange: (open: boolean) => void; children: ReactNode }) {
  return (
    <BaseDialog.Root open={open} onOpenChange={onOpenChange}>
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="fixed inset-0 bg-black/25 z-40" />
        <BaseDialog.Popup className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-84 max-w-[calc(100vw-2rem)] rounded-xl bg-white shadow-dialog outline-none">
          <div className="flex items-center justify-center h-12 px-8 rounded-t-xl bg-surface-active relative">
            <BaseDialog.Title className="text-ink-40 text-lg">{title}</BaseDialog.Title>
            <BaseDialog.Close aria-label="Close" className="btn-surface bg-transparent size-8 absolute right-2 outline-none">
              <XIcon size={16} weight="bold" className="text-ink-40" />
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
    <div role="radiogroup" className="flex flex-1 gap-0.5 rounded-lg bg-surface-active p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-md px-2 py-1 text-sm cursor-pointer ${value === o.value ? "bg-white text-ink-70" : "text-ink-40 hover:text-ink-55"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function NumericInput({ value, unit, onCommit }: { value: string; unit: string; onCommit: (v: number) => void }) {
  return (
    <label className="flex items-center gap-1 px-1 py-0.5 rounded-sm bg-surface-input w-18 shrink-0 cursor-text">
      <input
        key={value}
        defaultValue={value}
        inputMode="decimal"
        className="font-space-mono text-ink-55 text-base/5 tabular-nums bg-transparent outline-none min-w-0 w-full text-right"
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
      <span className="text-sm text-ink-25 shrink-0">{unit}</span>
    </label>
  );
}

interface SliderProps {
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
    <div>
      <div className="text-ink-40 text-sm flex items-center gap-0.5 h-5">
        {label}
        {value !== defaultValue && (
          <button aria-label={`Reset ${label}`} onClick={() => onChange(defaultValue)} className="size-5 rounded-sm text-ink-40 hover:text-ink-55 hover:bg-ink-12 flex items-center justify-center cursor-pointer">
            <ArrowClockwiseIcon size={13} weight="bold" />
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
          className="relative flex-1 h-2 rounded-xs bg-surface-input cursor-pointer touch-none"
          onPointerDown={(e) => {
            fromX(e.clientX);
            drag(e, fromX);
          }}
        >
          <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-3 rounded-xs bg-ink-25" style={{ left: `${((value - min) / (max - min)) * 100}%` }} />
        </div>
        <NumericInput value={display(value)} unit={unit} onCommit={(v) => set(parse(v))} />
      </div>
    </div>
  );
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-4 text-sm text-ink-40">
      {label}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`flex items-center shrink-0 w-9 h-5 p-0.5 rounded-full cursor-pointer outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-play focus-visible:ring-offset-2 motion-reduce:transition-none ${checked ? "bg-play" : "bg-ink-12 hover:bg-ink-25"}`}
      >
        <span className={`size-4 rounded-full bg-white transition-transform duration-150 ease-out motion-reduce:transition-none ${checked ? "translate-x-4" : "translate-x-0"}`} />
      </button>
    </label>
  );
}

const FILL = { gray: "", white: "bg-white hover:bg-surface-active", none: "bg-transparent hover:bg-surface-active" };

export function IconButton({ icon: Icon, size = 20, fill = "gray", className = "", children, ...rest }: { icon: Icon; size?: number; fill?: keyof typeof FILL } & ComponentProps<"button">) {
  return (
    <button {...rest} className={`btn-surface gap-2 rounded-lg text-ink-40 enabled:hover:text-ink-55 disabled:text-ink-25 disabled:cursor-not-allowed ${FILL[fill]} ${className}`}>
      <Icon size={size} weight="fill" className="shrink-0" />
      {children}
    </button>
  );
}

export const Loading = () => (
  <div className="w-screen h-dvh flex items-center justify-center">
    <SpinnerIcon size={32} className="animate-spin text-ink-40" />
  </div>
);
