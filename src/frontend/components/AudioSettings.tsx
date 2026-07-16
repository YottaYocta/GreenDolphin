import { useContext, useEffect, useRef, useState, type FC } from "react";
import { SlidersIcon } from "@phosphor-icons/react";
import { PlaybackContext } from "../playback/PlaybackContext";
import { useDrag } from "../lib/useDrag";
import { Dialog } from "@base-ui/react/dialog";
import { AppDialog } from "./AppDialog";
import { capture } from "../lib/posthog";

export function AudioSettings() {
  const playback = useContext(PlaybackContext);
  if (!playback)
    throw new Error("AudioSettings must be used within a PlaybackProvider");
  const { playbackSettings, setAudioSettings } = playback;
  const { pitchShift, playbackSpeed } = playbackSettings;

  const [renderedGain, setRenderedGain] = useState(
    Math.sqrt(playbackSettings.gain),
  );
  useEffect(() => {
    setAudioSettings({ gain: renderedGain * renderedGain });
  }, [renderedGain, setAudioSettings]);

  const sliders = (
    <>
      <AudioSlider
        label="Pitch"
        value={pitchShift}
        min={-12}
        max={12}
        step={0.1}
        onChange={(v) => {
          setAudioSettings({ pitchShift: v });
          capture("pitch_adjusted", { pitch_shift: v });
        }}
        formatValue={(v) => `${v > 0 ? "+" : ""}${Math.round(v * 10) / 10}`}
        unit="#"
        onCommit={(v) => {
          setAudioSettings({ pitchShift: Math.round(v * 10) / 10 });
          capture("pitch_adjusted", { pitch_shift: v });
        }}
        signed
      />
      <AudioSlider
        label="Speed"
        value={playbackSpeed}
        min={0.1}
        max={1.9}
        step={0.01}
        onChange={(v) => {
          setAudioSettings({ playbackSpeed: v });
          capture("speed_adjusted", { playback_speed: v });
        }}
        formatValue={(v) => `${Math.round(v * 100)}`}
        unit="%"
        onCommit={(v) => {
          const rounded = Math.max(10, Math.min(190, Math.round(v))) / 100;
          setAudioSettings({ playbackSpeed: rounded });
          capture("speed_adjusted", { playback_speed: rounded });
        }}
      />
      <AudioSlider
        label="Volume"
        value={renderedGain}
        min={0}
        max={2}
        step={0.01}
        onChange={(v) => setRenderedGain(v)}
        formatValue={(v) => `${Math.round(v * 100)}`}
        unit="%"
        onCommit={(v) => setRenderedGain(Math.max(0, Math.min(200, Math.round(v))) / 100)}
      />
    </>
  );

  return (
    <div className="flex flex-col">
      <AppDialog
        title="Settings"
        trigger={
          <Dialog.Trigger className="btn-surface rounded-lg gap-3 w-full h-12 shrink-0 cursor-pointer max-md:flex hidden">
            <SlidersIcon
              size={24}
              weight="fill"
              color="var(--color-icon)"
              style={{ opacity: 0.54, flexShrink: 0 }}
            />
            <span className="font-inria text-black/50 text-base/5">
              Settings
            </span>
          </Dialog.Trigger>
        }
      >
        <div className="flex flex-col gap-6 pb-4">{sliders}</div>
      </AppDialog>
      <div className="flex flex-col justify-center self-stretch rounded-xl py-5 px-4 gap-6 bg-white border border-border [box-shadow:var(--shadow-panel)] max-md:hidden">
        {sliders}
      </div>
    </div>
  );
}

const SettingsRow: FC<{
  label: string;
  center: React.ReactNode;
  right: React.ReactNode;
}> = ({ label, center, right }) => (
  <div className="flex items-center gap-4 self-stretch max-md:flex-col max-md:items-start max-md:gap-1.5">
    <div className="w-20 shrink-0 font-inria text-black text-base/5 whitespace-nowrap flex justify-end max-md:justify-start max-md:text-sm max-md:text-black/50">
      {label}
    </div>
    <div className="flex items-center gap-4 self-stretch flex-1">
      <div className="flex-1">{center}</div>
      {right}
    </div>
  </div>
);

export const NumericInput: FC<{
  value: string;
  onCommit: (v: number) => void;
  signed?: boolean;
}> = ({ value, onCommit, signed }) => {
  const commit = (el: HTMLInputElement) => {
    const n = parseFloat(el.value.replace(/^\+/, ""));
    if (!isNaN(n) && (signed || n >= 0)) {
      onCommit(n);
    } else {
      el.value = value;
    }
  };

  return (
    <div className="flex items-center px-1 py-0.5 rounded-sm bg-surface-input cursor-text w-14 overflow-hidden">
      <input
        key={value}
        defaultValue={value}
        className="font-space-mono text-black text-base/5 tabular-nums bg-transparent outline-none w-full min-w-0 text-right"
        onFocus={(e) => e.currentTarget.select()}
        onBlur={(e) => commit(e.currentTarget)}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            e.currentTarget.value = value;
            e.currentTarget.blur();
          }
        }}
      />
    </div>
  );
};

const AudioSlider: FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  formatValue: (v: number) => string;
  unit: React.ReactNode;
  onCommit?: (v: number) => void;
  signed?: boolean;
}> = ({ label, value, min, max, step, onChange, formatValue, unit, onCommit, signed }) => {
  const trackRef = useRef<HTMLDivElement>(null);

  const setValue = (clientX: number) => {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const raw = min + pct * (max - min);
    const snapped = Math.round(raw / step) * step;
    onChange(Math.max(min, Math.min(max, snapped)));
  };

  const [startDrag] = useDrag(({ clientX }) => setValue(clientX));

  const thumbPct = (value - min) / (max - min);

  return (
    <SettingsRow
      label={label}
      center={
        <div
          ref={trackRef}
          className="relative w-full h-5 rounded-[3px] bg-surface-track border border-border cursor-pointer"
          onMouseDown={(e) => {
            setValue(e.clientX);
            startDrag(e.clientX);
          }}
          onTouchStart={(e) => {
            if (e.touches[0]) {
              setValue(e.touches[0].clientX);
              startDrag(e.touches[0].clientX);
            }
          }}
        >
          <div
            className="absolute top-1/2 -translate-y-1/2 w-2.5 h-6.5 rounded-xs [box-shadow:var(--shadow-btn)] bg-surface border border-border"
            style={{ left: `calc(${thumbPct * 100}% - 5px)` }}
          />
        </div>
      }
      right={
        <div className="flex items-center gap-1.5  shrink-0">
          {onCommit ? (
            <NumericInput
              value={formatValue(value)}
              onCommit={onCommit}
              signed={signed}
            />
          ) : (
            <div className="flex items-center px-1 py-0.5 rounded-sm bg-surface-input w-14">
              <span className="font-space-mono text-black text-base/5 tabular-nums w-full text-right">
                {formatValue(value)}
              </span>
            </div>
          )}
          <div className="text-black/50 text-sm w-4 shrink-0 flex items-center">
            {unit}
          </div>
        </div>
      }
    />
  );
};
