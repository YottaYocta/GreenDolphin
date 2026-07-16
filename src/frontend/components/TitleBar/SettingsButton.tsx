import { useContext, useEffect, useState } from "react";
import { GearIcon } from "@phosphor-icons/react";
import { Dialog } from "@base-ui/react/dialog";
import { AppDialog } from "../AppDialog";
import { NumericInput } from "../AudioSettings";
import { PlaybackContext } from "../../playback/PlaybackContext";
import { loadSession, saveSession } from "../../lib/useSessionPersistence";
import { capture } from "../../lib/posthog";

export function SettingsButton() {
  return (
    <AppDialog
      title="Settings"
      trigger={
        <Dialog.Trigger className="btn-surface rounded-lg gap-2 px-3.25 py-3.25 cursor-pointer w-full h-12">
          <GearIcon
            size={16}
            weight="fill"
            color="var(--color-icon)"
            style={{ opacity: 0.5, flexShrink: 0 }}
          />
          <span className="opacity-40 font-inria text-black text-base/5 whitespace-nowrap max-md:hidden">
            Settings
          </span>
        </Dialog.Trigger>
      }
    >
      <div className="flex flex-col gap-6 pb-2">
        <LoopDelaySettings />
      </div>
    </AppDialog>
  );
}

function LoopDelaySettings() {
  const playback = useContext(PlaybackContext);
  if (!playback)
    throw new Error("SettingsButton must be used within a PlaybackProvider");
  const { playbackSettings, setAudioSettings, loopLength } = playback;

  const [delayMode, setDelayMode] = useState<"fixed" | "relative">(
    () => loadSession()?.delayMode ?? "fixed",
  );
  const [delayValue, setDelayValue] = useState(() => {
    const session = loadSession();
    const mode = session?.delayMode ?? "fixed";
    if (session && mode === "relative") {
      return loopLength > 0
        ? (playbackSettings.loopDelay / loopLength) * 100
        : 0;
    }
    return playbackSettings.loopDelay || 1;
  });

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
    saveSession({ delayMode: next });
    capture("loop_delay_changed", { delay_mode: next });
  };

  const displayValue = String(Math.round(delayValue * 10) / 10);

  return (
    <div className="flex flex-col gap-1.5 self-stretch">
      <div className="font-inria text-sm text-black/50">Loop Delay</div>
      <div className="flex items-center gap-4 self-stretch">
        <div className="flex items-start gap-2 flex-1">
          {(["fixed", "relative"] as const).map((m) => (
            <button
              key={m}
              onClick={() => handleModeChange(m)}
              className={`mode-btn ${delayMode === m ? "active" : ""}`}
            >
              {m === "fixed" ? "Fixed" : "Relative"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <NumericInput
            value={displayValue}
            onCommit={(v) => {
              setDelayValue(v);
              capture("loop_delay_changed", {
                delay_value: v,
                delay_mode: delayMode,
              });
            }}
          />
          <div className="text-black/50 text-sm w-4 shrink-0 flex items-center">
            {delayMode === "fixed" ? "s" : "%"}
          </div>
        </div>
      </div>
    </div>
  );
}
