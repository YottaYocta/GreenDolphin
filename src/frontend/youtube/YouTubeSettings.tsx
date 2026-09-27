import { useContext } from "react";
import { PlaybackContext } from "../playback/PlaybackContext";
import { AudioSlider } from "../components/PlaybackSettings";
import { capture } from "../lib/posthog";
import {
  YT_MIN_RATE,
  YT_MAX_RATE,
  YT_RATE_STEP,
} from "./YouTubePlaybackProvider";

/** Speed / Volume sliders bound to the YouTube playback context. */
export function YouTubeSliders() {
  const playback = useContext(PlaybackContext);
  if (!playback)
    throw new Error("YouTubeSliders must be used within a PlaybackProvider");
  const { playbackSettings, setAudioSettings } = playback;
  const { playbackSpeed, gain } = playbackSettings;

  return (
    <>
      <AudioSlider
        label="Speed"
        value={playbackSpeed}
        defaultValue={1}
        min={YT_MIN_RATE}
        max={YT_MAX_RATE}
        step={YT_RATE_STEP}
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
}
