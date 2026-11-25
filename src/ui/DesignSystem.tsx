import { useState, type ReactNode } from "react";
import { FileIcon, MusicNotesPlusIcon, PauseIcon, PlayIcon, SkipBackIcon, SnowflakeIcon } from "@phosphor-icons/react";
import { Dialog, IconButton, Loading, ModeToggle, NumericInput, Slider, Toggle } from "./shared/primitives";

const COLORS = ["page-bg", "surface-active", "surface-input", "neutral-2", "play", "play-hover", "play-active", "freeze", "freeze-hover", "freeze-active", "waiting", "waiting-hover", "waiting-active"];
const INKS = ["text-black/25", "text-black/40", "text-black/55", "text-black/70"];
const TYPE = [
  ["text-[29px]/9 font-bold text-play", "29 bold · app title"],
  ["text-lg", "18 · dialog title, file name"],
  ["text-base/5", "16 · rows, buttons"],
  ["text-sm", "14 · labels, dates"],
  ["text-xs", "12 · tutorial counter"],
  ["font-space-mono text-sm", "14 mono · values, links"],
  ["font-space-mono text-[10px]", "10 mono · ruler ticks"],
];
const CONTROL = "btn-surface rounded-xl size-20";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-sm text-black/40">{title}</h2>
      <div className="flex flex-wrap items-start gap-4">{children}</div>
    </section>
  );
}

export default function DesignSystem() {
  const [on, setOn] = useState(true);
  const [mode, setMode] = useState<"manual" | "automatic">("automatic");
  const [value, setValue] = useState(1);
  const [open, setOpen] = useState(false);
  return (
    <main className="max-w-220 mx-auto p-6 flex flex-col gap-12">
      <h1 className="text-[29px]/9 font-bold text-play">Design system</h1>
      <Section title="Colours">
        <Swatch name="white" className="bg-white" />
        {COLORS.map((name) => (
          <Swatch key={name} name={name} style={{ backgroundColor: `var(--color-${name})` }} />
        ))}
      </Section>
      <Section title="Ink (black at an opacity)">
        {INKS.map((ink) => (
          <p key={ink} className={`${ink} w-40`}>
            {ink.slice(5)} · The quick brown fox
          </p>
        ))}
      </Section>
      <Section title="Type">
        <div className="flex flex-col gap-3">
          {TYPE.map(([className, note]) => (
            <p key={note} className={className}>
              GreenDolphin 0:30 <span className="text-sm font-normal font-sans text-black/25">{note}</span>
            </p>
          ))}
        </div>
      </Section>
      <Section title="Icon buttons (on the page)">
        <IconButton icon={MusicNotesPlusIcon} fill="white" className="h-13 px-4">
          White
        </IconButton>
        <IconButton icon={FileIcon} fill="none" className="h-13 px-4">
          None
        </IconButton>
      </Section>
      <Section title="Buttons (on a card)">
        <div className="flex flex-wrap items-center gap-4 rounded-xl bg-white p-4">
          <IconButton icon={MusicNotesPlusIcon} className="h-12 px-4">
            Gray
          </IconButton>
          <IconButton icon={MusicNotesPlusIcon} disabled className="h-12 px-4">
            Disabled
          </IconButton>
          <button className="btn-surface h-10 px-4 rounded-lg">Plain</button>
          <button className="h-10 px-4 rounded-lg bg-red-500 text-white hover:bg-red-600 cursor-pointer">Destructive</button>
          <button className="btn-surface px-3 py-1 text-sm bg-play hover:bg-play-hover active:bg-play-active text-white">Primary</button>
          <button onClick={() => setOpen(true)} className="btn-surface h-10 px-4 rounded-lg">
            Open dialog
          </button>
        </div>
      </Section>
      <Section title="Transport">
        <button className={`${CONTROL} bg-white hover:bg-surface-active`}>
          <PlayIcon size={40} weight="fill" color="var(--color-play)" />
        </button>
        <button className={`${CONTROL} bg-play hover:bg-play-hover active:bg-play-active`}>
          <PauseIcon size={36} weight="fill" color="white" />
        </button>
        <button className={`${CONTROL} bg-waiting hover:bg-waiting-hover active:bg-waiting-active font-space-mono text-white text-lg`}>1.5</button>
        <button className={`${CONTROL} bg-white hover:bg-surface-active`}>
          <SnowflakeIcon size={40} weight="fill" color="var(--color-freeze)" />
        </button>
        <button className={`${CONTROL} bg-freeze hover:bg-freeze-hover active:bg-freeze-active`}>
          <SnowflakeIcon size={40} weight="fill" color="white" />
        </button>
        <button className={`${CONTROL} bg-white hover:bg-surface-active`}>
          <SkipBackIcon size={32} weight="fill" className="opacity-55" />
        </button>
      </Section>
      <Section title="Inputs (on a card)">
        <div className="flex flex-col gap-6 w-84 rounded-xl bg-white p-6">
          <Toggle label="Toggle" checked={on} onChange={setOn} />
          <ModeToggle
            options={[
              { value: "manual", label: "Manual" },
              { value: "automatic", label: "Automatic" },
            ]}
            value={mode}
            onChange={setMode}
          />
          <Slider label="Slider" value={value} min={0} max={2} step={0.01} defaultValue={1} display={(v) => String(Math.round(v * 100))} parse={(v) => v / 100} unit="%" onChange={setValue} />
          <NumericInput value="100" unit="s" onCommit={() => {}} />
        </div>
      </Section>
      <Section title="Surfaces">
        <div className="rounded-xl bg-white p-4 w-40 text-sm text-black/40">Card · rounded-xl</div>
        <div className="rounded-lg bg-white p-4 w-40 text-sm text-black/40">List · rounded-lg</div>
        <div className="rounded-xl bg-white shadow-menu p-4 w-40 text-sm text-black/40">Menu shadow</div>
        <div className="rounded-xl bg-white shadow-dialog p-4 w-40 text-sm text-black/40">Dialog shadow</div>
        <ul className="rounded-lg bg-white h-24 w-40 overflow-y-auto scrollbar-slim text-sm text-black/40">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <li key={i} className="p-3">
              Slim scrollbar {i}
            </li>
          ))}
        </ul>
      </Section>
      <Section title="Loading">
        <div className="h-24 w-40 overflow-hidden rounded-xl bg-white [&>div]:size-full">
          <Loading />
        </div>
      </Section>
      <Dialog title="Dialog" open={open} onOpenChange={setOpen}>
        <p className="text-black/70">Dialog body text.</p>
      </Dialog>
    </main>
  );
}

function Swatch({ name, ...rest }: { name: string; className?: string; style?: { backgroundColor: string } }) {
  return (
    <div className="flex flex-col gap-1 text-xs text-black/40">
      <div {...rest} className={`size-16 rounded-lg ring-1 ring-black/12 ${rest.className ?? ""}`} />
      {name}
    </div>
  );
}
