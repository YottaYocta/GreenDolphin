import { useState } from "react";
import { length } from "../Timeline/geometry";
import type { Player } from "../../../core";
import { DialogClose, ModeToggle, NumericInput, Slider, Toggle } from "../../shared/primitives";
import { usePlayer, type Sound } from "../session";
import { persistence, type EditorSettings, type LoopPrefs } from "../../../persistence";

const percent = (v: number) => String(Math.round(v * 100));
const LABEL = "text-sm text-ink-40";

export function SoundSettings(props: { player: Player; sound: Sound; onSound: (sound: Sound) => void; youtube?: boolean }) {
  const { player, sound, onSound, youtube = false } = props;
  const { speed } = usePlayer(player);
  const volume = youtube ? sound.gain : Math.sqrt(sound.gain);
  return (
    <>
      {!youtube && (
        <Slider
          label="Pitch"
          value={sound.pitch}
          min={-12}
          max={12}
          step={0.1}
          defaultValue={0}
          display={(v) => `${v > 0 ? "+" : ""}${Math.round(v * 10) / 10}`}
          parse={(v) => v}
          unit="#"
          onChange={(v) => onSound({ ...sound, pitch: v })}
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
        onChange={(v) => player.setSpeed(v)}
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
        onChange={(v) => onSound({ ...sound, gain: youtube ? v : v * v })}
      />
    </>
  );
}

const TOGGLES: [keyof EditorSettings, string][] = [
  ["piano", "Show piano roll"],
  ["inlineSound", "Show playback settings"],
  ["playheadTime", "Show time on playhead"],
  ["awake", "Keep screen awake"],
  ["replay", "Share debug info"],
];

export function GeneralSettings({ editor, onEditor, hasPiano, onTutorial }: { editor: EditorSettings; onEditor: (patch: Partial<EditorSettings>) => void; hasPiano: boolean; onTutorial: () => void }) {
  return (
    <div className="flex flex-col gap-4">
      {TOGGLES.filter(([key]) => hasPiano || key !== "piano").map(([key, label]) => (
        <Toggle key={key} label={label} checked={editor[key]} onChange={(on) => onEditor({ [key]: on })} />
      ))}
      <DialogClose onClick={onTutorial} className="btn-surface h-9 rounded-lg text-sm">
        Replay tutorial
      </DialogClose>
    </div>
  );
}

export function LoopSettings({ player }: { player: Player }) {
  const { loop } = usePlayer(player);
  const [prefs, setPrefs] = useState(persistence.loopPrefs);
  const loopLength = length(loop);
  const update = (patch: Partial<LoopPrefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    persistence.saveLoopPrefs(next);
    player.setLoopMode(persistence.toLoopMode(next, loopLength));
  };
  const unit = prefs.delayMode === "fixed" ? "s" : "%";
  const shown = String(Math.round(prefs.delayValue * 10) / 10);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className={LABEL}>Loop mode</div>
        <ModeToggle
          options={[
            { value: "manual", label: "Manual" },
            { value: "automatic", label: "Automatic" },
          ]}
          value={prefs.mode}
          onChange={(mode) => update({ mode })}
        />
      </div>
      {prefs.mode === "automatic" && (
        <div className="flex flex-col gap-2">
          <div className={LABEL}>Loop delay</div>
          <div className="flex items-center gap-4">
            <ModeToggle
              options={[
                { value: "fixed", label: "Fixed" },
                { value: "relative", label: "Relative" },
              ]}
              value={prefs.delayMode}
              onChange={(delayMode) => {
                const seconds = persistence.toLoopMode(prefs, loopLength);
                const s = seconds.type === "automatic" ? seconds.delay : 0;
                update({ delayMode, delayValue: delayMode === "fixed" ? s : loopLength > 0 ? (s / loopLength) * 100 : 0 });
              }}
            />
            <NumericInput
              value={shown}
              unit={unit}
              onCommit={(v) => update({ delayValue: Math.max(0, v) })}
            />
          </div>
        </div>
      )}
    </div>
  );
}
