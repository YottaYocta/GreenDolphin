import { useState } from "react";
import { PlayIcon } from "@phosphor-icons/react";
import { capture } from "../analytics";
import { length } from "../domain/geometry";
import type { Player } from "../domain/player";
import { loopPrefs, saveLoopPrefs, toLoopMode, type LoopPrefs } from "../persistence/prefs";
import { ModeToggle, NumericInput, Slider } from "./primitives";
import { usePlayer } from "./session";

const percent = (v: number) => String(Math.round(v * 100));

export function SoundSettings({ player, youtube = false }: { player: Player; youtube?: boolean }) {
  const { pitch, speed, gain } = usePlayer(player);
  const volume = youtube ? gain : Math.sqrt(gain);
  return (
    <>
      {!youtube && (
        <Slider
          label="Pitch"
          value={pitch}
          min={-12}
          max={12}
          step={0.1}
          defaultValue={0}
          display={(v) => `${v > 0 ? "+" : ""}${Math.round(v * 10) / 10}`}
          parse={(v) => v}
          unit="#"
          onChange={(v) => {
            player.setSettings({ pitch: v });
            capture("pitch_adjusted", { pitch_shift: v });
          }}
        />
      )}
      <Slider
        label="Speed"
        value={speed}
        min={youtube ? 0.25 : 0.1}
        max={youtube ? 2 : 1.9}
        step={youtube ? 0.25 : 0.01}
        defaultValue={1}
        display={percent}
        parse={(v) => v / 100}
        unit="%"
        onChange={(v) => {
          player.setSettings({ speed: v });
          capture("speed_adjusted", { playback_speed: v, source: youtube ? "youtube" : "file" });
        }}
      />
      <Slider
        label="Volume"
        value={volume}
        min={0}
        max={youtube ? 1 : 2}
        step={0.01}
        defaultValue={1}
        display={percent}
        parse={(v) => v / 100}
        unit="%"
        onChange={(v) => player.setSettings({ gain: youtube ? v : v * v })}
      />
    </>
  );
}

export function LoopSettings({ player }: { player: Player }) {
  const { loop } = usePlayer(player);
  const [prefs, setPrefs] = useState(loopPrefs);
  const loopLength = length(loop);
  const update = (patch: Partial<LoopPrefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    saveLoopPrefs(next);
    player.setLoopMode(toLoopMode(next, loopLength));
  };
  const unit = prefs.delayMode === "fixed" ? "s" : "%";
  const shown = String(Math.round(prefs.delayValue * 10) / 10);

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <div className="font-inria text-sm text-black/50">Loop Mode</div>
        <ModeToggle
          options={[
            { value: "manual", label: "Manual" },
            { value: "automatic", label: "Automatic" },
          ]}
          value={prefs.mode}
          onChange={(mode) => {
            update({ mode });
            capture("loop_mode_changed", { loop_mode: mode });
          }}
        />
        <p className="font-inria text-sm text-black/50 pt-1">
          {prefs.mode === "manual" ? (
            <>
              Pauses at loop end; press <PlayIcon size={12} weight="fill" color="var(--color-play)" className="inline align-middle" /> to replay.
            </>
          ) : (
            "Playback loops automatically, with an optional delay between loops."
          )}
        </p>
      </div>
      {prefs.mode === "automatic" && (
        <div className="flex flex-col gap-1.5">
          <div className="font-inria text-sm text-black/50">Loop Delay</div>
          <div className="flex items-center gap-4">
            <ModeToggle
              options={[
                { value: "fixed", label: "Fixed" },
                { value: "relative", label: "Relative" },
              ]}
              value={prefs.delayMode}
              onChange={(delayMode) => {
                const seconds = toLoopMode(prefs, loopLength);
                const s = seconds.type === "automatic" ? seconds.delay : 0;
                update({ delayMode, delayValue: delayMode === "fixed" ? s : loopLength > 0 ? (s / loopLength) * 100 : 0 });
                capture("loop_delay_changed", { delay_mode: delayMode });
              }}
            />
            <NumericInput
              value={shown}
              unit={unit}
              onCommit={(v) => {
                update({ delayValue: Math.max(0, v) });
                capture("loop_delay_changed", { delay_value: v, delay_mode: prefs.delayMode });
              }}
            />
          </div>
          <p className="font-inria text-sm text-black/50 pt-1">{`A ${shown}${unit} delay will occur between loops.`}</p>
        </div>
      )}
    </>
  );
}
