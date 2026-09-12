import { useContext, useState } from "react";
import { SlidersIcon } from "@phosphor-icons/react";
import { Dialog } from "@base-ui/react/dialog";
import { AppDialog } from "../components/AppDialog";
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
    <>
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
    </>
  );

  const icon = (
    <SlidersIcon
      size={18}
      weight="fill"
      color="var(--color-icon)"
      style={{ opacity: 0.54, flexShrink: 0 }}
    />
  );

  return (
    <div className="flex items-center border-b border-border shrink-0">
      {expanded && (
        <div className="max-md:hidden flex-1 flex justify-between h-min p-5 gap-16 min-w-0">
          {sliders}
        </div>
      )}
      <div className="ml-auto shrink-0 p-2 flex">
        {/* mobile: single icon opens the settings dialog */}
        <AppDialog
          title="Settings"
          trigger={
            <Dialog.Trigger
              aria-label="Settings"
              className="md:hidden btn-surface size-9 rounded-lg cursor-pointer"
            >
              {icon}
            </Dialog.Trigger>
          }
        >
          <div className="flex flex-col gap-6 pb-4">{sliders}</div>
        </AppDialog>
        {/* desktop: same icon toggles the inline settings bar */}
        <button
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          aria-label="Settings"
          className={`max-md:hidden btn-surface size-9 rounded-lg cursor-pointer ${expanded ? "bg-surface-track" : ""}`}
        >
          {icon}
        </button>
      </div>
    </div>
  );
}
