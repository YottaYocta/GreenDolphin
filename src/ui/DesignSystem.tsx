import { useMemo, useState, type ReactNode } from "react";
import { FileIcon, MusicNotesPlusIcon } from "@phosphor-icons/react";
import { Dialog, IconButton, Loading, ModeToggle, NumericInput, Slider, Toggle } from "./shared/primitives";

const SOURCES = import.meta.glob<string>(["../**/*.{ts,tsx,css}", "!./DesignSystem.tsx"], { query: "?raw", import: "default", eager: true });
const GROUPS = {
  Colour: /^(bg|text|border|ring|fill|stroke|outline|placeholder)-/,
  "Font size": /^text-/,
  "Font family and weight": /^font-/,
  Spacing: /^-?(p[xytblr]?|m[xytblr]?|gap(-[xy])?)-/,
  Sizing: /^(size|w|h|min-w|min-h|max-w|max-h)-/,
  Radius: /^rounded/,
  Shadow: /^shadow-/,
  Opacity: /^opacity-/,
};
type Group = keyof typeof GROUPS | "Everything else";

const count = (items: string[]) => [...items.reduce((m, i) => m.set(i, (m.get(i) ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1]);
const base = (cls: string) => cls.replace(/^(?:[^:[\]]+(?:\[[^\]]*\])?:)+/, "");
const px = (value: string) => (/^[\d.]+$/.test(value) ? `${+value * 4}px` : (value.match(/^\[(.+)\]$/)?.[1] ?? value));

function shade(colour: string) {
  const probe = document.body.appendChild(Object.assign(document.createElement("i"), { style: `color:${colour}` }));
  const ctx = Object.assign(document.createElement("canvas"), { width: 1, height: 1 }).getContext("2d")!;
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, 1, 1);
  ctx.fillStyle = getComputedStyle(probe).color;
  ctx.fillRect(0, 0, 1, 1);
  probe.remove();
  const [r, g, b] = [...ctx.getImageData(0, 0, 1, 1).data].map((v) => v / 255);
  const [max, min] = [Math.max(r, g, b), Math.min(r, g, b)];
  const hue = max === min ? 0 : max === r ? ((g - b) / (max - min) + 6) % 6 : max === g ? (b - r) / (max - min) + 2 : (r - g) / (max - min) + 4;
  return max - min < 0.08 ? -max : 1 + hue;
}
const byShade = <T,>(items: T[], colour: (item: T) => string) => items.map((item) => ({ item, at: shade(colour(item)) })).sort((a, b) => a.at - b.at).map(({ item }) => item);

function inventory() {
  const root = getComputedStyle(document.documentElement);
  const css = [...document.styleSheets].filter((sheet) => !sheet.href || sheet.href.startsWith(location.origin)).flatMap((sheet) => [...sheet.cssRules].map((rule) => rule.cssText)).join("\n");
  const code = Object.entries(SOURCES).filter(([path]) => !path.endsWith(".css"));
  const classes = count(code.flatMap(([, text]) => text.split(/[\s"'`${}]+/)).filter((token) => /^[-!\w[]/.test(token) && css.includes(`.${CSS.escape(token)}`)));
  const colourOf = (value: string) => {
    const [name, alpha] = value.split("/");
    const solid = name.match(/^\[(#.+|rgb.+|var.+)\]$/)?.[1] ?? (name.startsWith("[") ? "" : ["transparent", "black", "white"].includes(name) ? name : root.getPropertyValue(`--color-${name}`).trim());
    return solid && (alpha ? `color-mix(in oklab, ${solid} ${alpha}%, transparent)` : solid);
  };
  const grouped = Object.fromEntries([...Object.keys(GROUPS), "Everything else"].map((g) => [g, [] as { cls: string; uses: number; colour?: string }[]])) as Record<Group, { cls: string; uses: number; colour?: string }[]>;
  for (const [cls, uses] of classes) {
    const b = base(cls);
    const colour = GROUPS.Colour.test(b) ? colourOf(b.replace(GROUPS.Colour, "")) : "";
    const found = colour ? "Colour" : ((Object.keys(GROUPS) as (keyof typeof GROUPS)[]).find((g) => g !== "Colour" && GROUPS[g].test(b)) ?? "Everything else");
    const size = b.slice(5).split("/")[0];
    const group = found === "Font size" && !size.startsWith("[") && !root.getPropertyValue(`--text-${size}`) ? "Everything else" : found;
    grouped[group].push({ cls, uses, colour });
  }
  grouped.Colour = byShade(grouped.Colour, (c) => c.colour!);
  const all = Object.values(SOURCES).join("\n");
  return {
    grouped,
    tokens: [...(Object.entries(SOURCES).find(([path]) => path.endsWith("styles.css"))?.[1] ?? "").matchAll(/^\s*--([\w-]+):\s*([^;]+);/gm)].map(([, name, value]) => ({ name, value })),
    literals: count((code.map(([, text]) => text).join("\n").match(/#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?\b|#[0-9a-fA-F]{3}\b|rgba?\([^)]*\)/g) ?? []).map((c) => c.toLowerCase())),
    utilities: [...all.matchAll(/@utility ([\w-]+)/g)].map((m) => m[1]),
    components: Object.entries(SOURCES).flatMap(([path, text]) => [...text.matchAll(/^(?:export (?:default )?)?(?:function|const|class) ([A-Z][A-Za-z]+)\b(?=[^\n]*(?:\(|=>))/gm)].map((m) => `${m[1]} · ${path.replace("../", "")}`)),
  };
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-sm text-ink-40">{title}</h2>
      <div className="flex flex-wrap items-start gap-4">{children}</div>
    </section>
  );
}

export default function DesignSystem() {
  const [on, setOn] = useState(true);
  const [mode, setMode] = useState<"manual" | "automatic">("automatic");
  const [value, setValue] = useState(1);
  const [open, setOpen] = useState(false);
  const { grouped, tokens, literals, utilities, components } = useMemo(inventory, []);
  return (
    <main className="max-w-220 mx-auto p-6 flex flex-col gap-12">
      <h1 className="text-[29px]/9 font-bold text-play">Design system</h1>
      <Section title={`Theme tokens in styles.css (${tokens.length})`}>
        {byShade(
          tokens.filter(({ name }) => name.startsWith("color-")),
          ({ value }) => value,
        ).map(({ name, value }) => (
          <Swatch key={name} name={`${name.slice(6)} ${value}`} colour={value} />
        ))}
        {tokens
          .filter(({ name }) => !name.startsWith("color-"))
          .map(({ name, value }) => (
            <Chip key={name} name={`--${name}`} note={value} />
          ))}
      </Section>
      <Section title={`Colour classes (${grouped.Colour.length})`}>
        {grouped.Colour.map(({ cls, uses, colour }) => (
          <Swatch key={cls} name={`${cls} ×${uses}`} colour={colour!} />
        ))}
      </Section>
      <Section title={`Colours written in component code, such as note icons (${literals.length})`}>
        {byShade(literals, ([colour]) => colour).map(([colour, uses]) => (
          <Swatch key={colour} name={`${colour} ×${uses}`} colour={colour} />
        ))}
      </Section>
      <Section title={`Font sizes (${grouped["Font size"].length})`}>
        <div className="flex flex-col gap-3">
          {grouped["Font size"].map(({ cls, uses }) => {
            const [size, leading] = base(cls).slice(5).split("/");
            return (
              <p key={cls} style={{ fontSize: size.match(/^\[(.+)\]$/)?.[1] ?? `var(--text-${size})`, lineHeight: leading ? px(leading) : `var(--text-${size}--line-height)` }}>
                GreenDolphin 0:30 <Note>{`${cls} ×${uses}`}</Note>
              </p>
            );
          })}
        </div>
      </Section>
      <Section title="Fonts">
        <p>Inria Sans · default</p>
        <p className="font-bold">Inria Sans bold</p>
        <p className="font-space-mono">Space Mono 0:30</p>
        {grouped["Font family and weight"].map(({ cls, uses }) => (
          <Chip key={cls} name={cls} note={`×${uses}`} />
        ))}
      </Section>
      <Section title={`Spacing (${grouped.Spacing.length})`}>
        {grouped.Spacing.map(({ cls, uses }) => {
          const value = px(base(cls).replace(GROUPS.Spacing, ""));
          return (
            <div key={cls} className="flex flex-col gap-1 text-xs text-ink-40">
              <div className="h-3 bg-play" style={{ width: value }} />
              {cls} · {value} ×{uses}
            </div>
          );
        })}
      </Section>
      {(["Sizing", "Radius", "Shadow", "Opacity", "Everything else"] as const).map((group) => (
        <Section key={group} title={`${group} (${grouped[group].length})`}>
          {grouped[group].map(({ cls, uses }) => (
            <Chip key={cls} name={cls} note={group === "Sizing" ? `${px(base(cls).replace(GROUPS.Sizing, ""))} ×${uses}` : `×${uses}`} />
          ))}
        </Section>
      ))}
      <Section title={`Custom utilities (${utilities.length})`}>
        {utilities.map((name) => (
          <Chip key={name} name={name} />
        ))}
      </Section>
      <Section title={`Components (${components.length})`}>
        {components.map((name) => (
          <Chip key={name} name={name} />
        ))}
      </Section>
      <Section title="Shared components, live">
        <IconButton icon={MusicNotesPlusIcon} fill="white" className="h-13 px-4">
          IconButton white
        </IconButton>
        <IconButton icon={FileIcon} fill="none" className="h-13 px-4">
          IconButton none
        </IconButton>
        <div className="flex flex-col gap-6 w-84 rounded-xl bg-white p-6">
          <IconButton icon={MusicNotesPlusIcon} onClick={() => setOpen(true)} className="h-12">
            IconButton gray · opens Dialog
          </IconButton>
          <IconButton icon={MusicNotesPlusIcon} disabled className="h-12">
            IconButton disabled
          </IconButton>
          <Toggle label="Toggle" checked={on} onChange={setOn} />
          <ModeToggle
            options={[
              { value: "manual", label: "ModeToggle" },
              { value: "automatic", label: "Automatic" },
            ]}
            value={mode}
            onChange={setMode}
          />
          <Slider label="Slider" value={value} min={0} max={2} step={0.01} defaultValue={1} display={(v) => String(Math.round(v * 100))} parse={(v) => v / 100} unit="%" onChange={setValue} />
          <NumericInput value="100" unit="s" onCommit={() => {}} />
        </div>
        <div className="h-24 w-40 overflow-hidden rounded-xl bg-white [&>div]:size-full">
          <Loading />
        </div>
      </Section>
      <Dialog title="Dialog" open={open} onOpenChange={setOpen}>
        <p className="text-ink-70">Dialog body text.</p>
      </Dialog>
    </main>
  );
}

const Note = ({ children }: { children: string }) => <span className="text-sm font-normal font-sans text-ink-25">{children}</span>;

const Chip = ({ name, note = "" }: { name: string; note?: string }) => (
  <span className="rounded-sm bg-white px-2 py-1 font-space-mono text-xs text-ink-55">
    {name} <span className="text-ink-25">{note}</span>
  </span>
);

function Swatch({ name, colour }: { name: string; colour: string }) {
  return (
    <div className="flex flex-col gap-1 w-24 text-xs text-ink-40 break-words">
      <div className="h-12 rounded-lg ring-1 ring-ink-12" style={{ backgroundColor: colour }} />
      {name}
    </div>
  );
}
