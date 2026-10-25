import { useMemo, useState } from "react";
import { MusicNotesPlusIcon, SpinnerIcon } from "@phosphor-icons/react";
import { FreezeLab } from "./freeze/FreezeLab";
import { PipelineLab } from "./pipeline/PipelineLab";
import { WaveformLab } from "./waveform/WaveformLab";
import { formatTime } from "./shared/format";
import { createPlayer } from "./shared/player";
import { ActionButton, Segmented } from "./shared/ui";
import { useAudioSource } from "./shared/useAudioSource";

const TABS = [
  { value: "freeze", label: "Freeze" },
  { value: "pipeline", label: "Pipeline" },
  { value: "waveform", label: "Waveform" },
] as const;
type Tab = (typeof TABS)[number]["value"];

const initialTab = (): Tab => {
  const hash = location.hash.slice(1);
  return TABS.some((t) => t.value === hash) ? (hash as Tab) : "freeze";
};

export function Playground() {
  const ctx = useMemo(() => new AudioContext(), []);
  const player = useMemo(() => createPlayer(ctx), [ctx]);
  const { source, loading, loadFile, loadDemo } = useAudioSource(ctx);
  const [tab, setTab] = useState<Tab>(initialTab);

  return (
    <main className="min-h-dvh bg-page-bg font-inria">
      <div className="mx-auto max-w-6xl flex flex-col gap-4 px-4 py-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col">
            <h1 className="text-xl">GreenDolphin experiments</h1>
            <p className="text-sm text-black/50">
              {source
                ? `${source.name} · ${formatTime(source.buffer.duration)} · ${source.buffer.sampleRate} Hz · ${source.buffer.numberOfChannels} ch`
                : "Load a recording to begin"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {loading && <SpinnerIcon className="animate-spin text-black/40" />}
            <label className="btn-surface h-9 px-3 gap-1.5 text-sm">
              <MusicNotesPlusIcon />
              Open file
              <input
                type="file"
                accept="audio/*"
                className="sr-only"
                onChange={(e) => {
                  const file = e.currentTarget.files?.[0];
                  if (file) {
                    player.stop();
                    void loadFile(file);
                  }
                }}
              />
            </label>
            <ActionButton onClick={() => void loadDemo()}>Demo track</ActionButton>
          </div>
        </header>

        <nav aria-label="Experiments" className="max-w-md">
          <Segmented
            options={TABS}
            value={tab}
            onChange={(t) => {
              player.stop();
              history.replaceState(null, "", `#${t}`);
              setTab(t);
            }}
          />
        </nav>

        {source &&
          (tab === "freeze" ? (
            <FreezeLab key={source.name} buffer={source.buffer} player={player} />
          ) : tab === "pipeline" ? (
            <PipelineLab key={source.name} ctx={ctx} buffer={source.buffer} player={player} />
          ) : (
            <WaveformLab key={source.name} buffer={source.buffer} encodedBytes={source.encodedBytes} />
          ))}
      </div>
    </main>
  );
}
