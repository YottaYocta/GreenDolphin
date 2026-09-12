import { useContext, useState } from "react";
import { CaretDownIcon, SlidersIcon } from "@phosphor-icons/react";
import { PlaybackContext } from "../playback/PlaybackContext";
import { AudioSlider } from "../components/PlaybackSettings";
import { capture } from "../lib/posthog";
import { YT_MIN_RATE, YT_MAX_RATE } from "./YouTubePlaybackProvider";

// Only the settings the YouTube IFrame API supports: playback rate and volume.
export function YouTubeSettings() {
  const playback = useContext(PlaybackContext);
  if (!playback)
    throw new Error("YouTubeSettings must be used within a PlaybackProvider");
  const { playbackSettings, setAudioSettings } = playback;
  const { playbackSpeed, gain } = playbackSettings;
  const [expanded, setExpanded] = useState(false);

  const sliders = (
    <div className="flex justify-between h-min p-5 pt-2 gap-16 max-md:flex-col max-md:gap-4">
      <AudioSlider
        label="Speed"
        value={playbackSpeed}
        defaultValue={1}
        min={YT_MIN_RATE}
        max={YT_MAX_RATE}
        step={0.05}
        onChange={(v) => {
          setAudioSettings({ playbackSpeed: v });
          capture("speed_adjusted", { playback_speed: v, source: "youtube" });
        }}
        formatValue={(v) => `${Math.round(v * 100)}`}
        unit="%"
        onCommit={(v) => {
          const rounded =
            Math.max(YT_MIN_RATE * 100, Math.min(YT_MAX_RATE * 100, Math.round(v))) /
            100;
          setAudioSettings({ playbackSpeed: rounded });
          capture("speed_adjusted", {
            playback_speed: rounded,
            source: "youtube",
          });
        }}
      />
      <AudioSlider
        label="Volume"
        value={gain}
        defaultValue={1}
        min={0}
        max={1}
        step={0.01}
        onChange={(v) => setAudioSettings({ gain: v })}
        formatValue={(v) => `${Math.round(v * 100)}`}
        unit="%"
        onCommit={(v) =>
          setAudioSettings({ gain: Math.max(0, Math.min(100, Math.round(v))) / 100 })
        }
      />
    </div>
  );

  return (
    <div className="flex flex-col border-b border-border">
      <button
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        className="btn-surface rounded-none border-0 gap-3 w-full h-12 shrink-0 cursor-pointer flex items-center justify-center"
      >
        <SlidersIcon
          size={20}
          weight="fill"
          color="var(--color-icon)"
          style={{ opacity: 0.54, flexShrink: 0 }}
        />
        <span className="font-inria text-black/50 text-base/5">Settings</span>
        <CaretDownIcon
          size={14}
          weight="bold"
          color="var(--color-icon)"
          style={{ opacity: 0.4, flexShrink: 0 }}
          className={`transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>
      {expanded && sliders}
    </div>
  );
}
