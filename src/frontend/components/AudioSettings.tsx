import { useContext, useEffect, useRef, useState, type FC } from "react";
import { PlaybackContext } from "../playback/PlaybackContext";
import { useDrag } from "../lib/useDrag";
import { Menu } from "@base-ui/react/menu";

export function AudioSettings() {
  const playback = useContext(PlaybackContext);
  if (!playback)
    throw new Error("AudioSettings must be used within a PlaybackProvider");
  const { playbackSettings, setAudioSettings, loopLength } = playback;
  const { pitchShift, playbackSpeed } = playbackSettings;

  const [renderedGain, setRenderedGain] = useState(1);
  useEffect(() => {
    setAudioSettings({ gain: renderedGain * renderedGain });
  }, [renderedGain, setAudioSettings]);

  const [delayMode, setDelayMode] = useState<"fixed" | "relative">("fixed");
  const [delayValue, setDelayValue] = useState(1);

  useEffect(() => {
    if (delayMode === "fixed") {
      setAudioSettings({ loopDelay: delayValue });
    } else {
      setAudioSettings({ loopDelay: (delayValue / 100) * loopLength });
    }
  }, [delayMode, delayValue, loopLength, setAudioSettings]);

  const handleModeChange = (next: "fixed" | "relative") => {
    if (next === delayMode) return;
    if (next === "fixed") {
      setDelayValue((delayValue / 100) * loopLength);
    } else {
      setDelayValue(loopLength > 0 ? (delayValue / loopLength) * 100 : 0);
    }
    setDelayMode(next);
  };

  const sliders = (
    <>
      <LoopDelayInput
        mode={delayMode}
        onModeChange={handleModeChange}
        displayValue={String(Math.round(delayValue * 10) / 10)}
        onChange={setDelayValue}
      />
      <AudioSlider
        label="Pitch"
        value={pitchShift}
        min={-12}
        max={12}
        step={0.2}
        onChange={(v) => {
          const rounded = Math.round(v * 10) / 10;
          setAudioSettings({ pitchShift: rounded });
        }}
        formatValue={(v) => `${Math.round(v * 10) / 10}`}
        unit={"#"}
      />
      <AudioSlider
        label="Speed"
        value={playbackSpeed}
        min={0.1}
        max={1.9}
        step={0.1}
        onChange={(v) => {
          const rounded = Math.round(v * 10) / 10;
          setAudioSettings({ playbackSpeed: rounded });
        }}
        formatValue={(v) => `${Math.round(v * 100)}`}
        unit="%"
      />
      <AudioSlider
        label="Volume"
        value={renderedGain}
        min={0}
        max={2}
        step={0.1}
        onChange={(v) => setRenderedGain(Math.round(v * 10) / 10)}
        formatValue={(v) => `${Math.round(v * 100)}`}
        unit="%"
      />
    </>
  );

  return (
    <div className="flex flex-col items-end gap-3.25 flex-1 max-md:grow-0 w-full min-w-0">
      <Menu.Root>
        <Menu.Trigger className="btn-surface rounded-lg gap-3 w-full h-12 shrink-0 cursor-pointer max-md:flex hidden">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 256 256"
            style={{ opacity: 0.54, flexShrink: 0 }}
          >
            <path
              d="M84,136a28,28,0,0,1-20,26.83V216a8,8,0,0,1-16,0V162.83a28,28,0,0,1,0-53.66V40a8,8,0,0,1,16,0v69.17A28,28,0,0,1,84,136Zm52-74.83V40a8,8,0,0,0-16,0V61.17a28,28,0,0,0,0,53.66V216a8,8,0,0,0,16,0V114.83a28,28,0,0,0,0-53.66Zm72,80V40a8,8,0,0,0-16,0V141.17a28,28,0,0,0,0,53.66V216a8,8,0,0,0,16,0V194.83a28,28,0,0,0,0-53.66Z"
              fill="#000000"
            />
          </svg>
          <span className="font-inria text-black/60 text-base/5">Settings</span>
        </Menu.Trigger>

        <Menu.Portal>
          <Menu.Positioner side="bottom" align="start" sideOffset={8}>
            <Menu.Popup className="z-50 rounded-xl py-5 px-4 shrink-0 [box-shadow:var(--shadow-panel)] bg-white border border-border w-min">
              <div className="flex flex-col justify-center self-stretch gap-2 w-[calc(100vw-4rem)] px-4">
                {sliders}
              </div>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
      <div className="flex flex-col justify-center self-stretch rounded-xl py-5 px-4 gap-4 shrink-0 [box-shadow:var(--shadow-panel)] bg-white border border-border max-md:hidden">
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
    <div className="w-20 shrink-0 font-inria text-black text-base/5 whitespace-nowrap flex justify-end max-md:justify-start max-md:text-sm max-md:opacity-60">
      {label}
    </div>
    <div className="flex items-center gap-4 self-stretch flex-1 w-full">
      <div className="flex-1">{center}</div>
      {right}
    </div>
  </div>
);

const LoopDelayInput: FC<{
  mode: "fixed" | "relative";
  onModeChange: (mode: "fixed" | "relative") => void;
  displayValue: string;
  onChange: (v: number) => void;
}> = ({ mode, onModeChange, displayValue, onChange }) => {
  const commit = (el: HTMLInputElement) => {
    const n = parseFloat(el.value);
    if (!isNaN(n) && n >= 0) {
      onChange(n);
    } else {
      el.value = displayValue;
    }
  };

  return (
    <SettingsRow
      label="Loop Delay"
      center={
        <div className="flex items-start gap-2 w-full">
          {(["fixed", "relative"] as const).map((m) => (
            <button
              key={m}
              onClick={() => onModeChange(m)}
              className={`mode-btn ${mode === m ? "active" : ""}`}
            >
              {m === "fixed" ? "Fixed" : "Relative"}
            </button>
          ))}
        </div>
      }
      right={
        <div className="flex items-center gap-1.5  shrink-0">
          <div className="flex items-center px-1 py-0.5 rounded-sm bg-surface-input cursor-text w-14 overflow-hidden">
            <input
              key={displayValue}
              defaultValue={displayValue}
              className="font-space-mono text-black text-base/5 tabular-nums bg-transparent outline-none w-full min-w-0 text-right"
              onFocus={(e) => e.currentTarget.select()}
              onBlur={(e) => commit(e.currentTarget)}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") {
                  e.currentTarget.value = displayValue;
                  e.currentTarget.blur();
                }
              }}
            />
          </div>
          <div className="text-black/60 text-sm w-4 shrink-0 flex items-center">
            {mode === "fixed" ? "s" : "%"}
          </div>
        </div>
      }
    />
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
}> = ({ label, value, min, max, step, onChange, formatValue, unit }) => {
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
          <div className="flex items-center px-1 py-0.5 rounded-sm bg-surface-input w-14">
            <span className="font-space-mono text-black text-base/5 tabular-nums w-full text-right">
              {formatValue(value)}
            </span>
          </div>
          <div className="text-black/60 text-sm w-4 shrink-0 flex items-center">
            {unit}
          </div>
        </div>
      }
    />
  );
};
