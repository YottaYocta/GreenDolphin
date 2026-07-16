import { useContext, useEffect, useState } from "react";
import { GearIcon, PlayIcon } from "@phosphor-icons/react";
import { Dialog } from "@base-ui/react/dialog";
import { AppDialog } from "../AppDialog";
import { NumericInput } from "../PlaybackSettings";
import { PlaybackContext } from "../../playback/PlaybackContext";
import { loadSession, saveSession } from "../../lib/useSessionPersistence";
import { capture } from "../../lib/posthog";

export function EditorSettings() {
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
        <LoopSettings />
      </div>
    </AppDialog>
  );
}

function LoopSettings() {
  const playback = useContext(PlaybackContext);
  if (!playback)
    throw new Error("EditorSettings must be used within a PlaybackProvider");
  const { playbackSettings, setAudioSettings, loopLength } = playback;
  const { loopOptions } = playbackSettings;

  const isManual = loopOptions.type === "manual";
  const currentDelay =
    loopOptions.type === "automatic" ? loopOptions.loopDelay : 0;

  const [delayMode, setDelayMode] = useState<"fixed" | "relative">(
    () => loadSession()?.delayMode ?? "fixed",
  );
  const [delayValue, setDelayValue] = useState(() => {
    const session = loadSession();
    const mode = session?.delayMode ?? "fixed";
    if (session && mode === "relative") {
      return loopLength > 0 ? (currentDelay / loopLength) * 100 : 0;
    }
    return currentDelay || 1;
  });

  useEffect(() => {
    if (isManual) return;
    const nextDelay =
      delayMode === "fixed" ? delayValue : (delayValue / 100) * loopLength;
    setAudioSettings({
      loopOptions: { type: "automatic", loopDelay: nextDelay },
    });
  }, [isManual, delayMode, delayValue, loopLength, setAudioSettings]);

  const handleLoopModeChange = (next: "manual" | "automatic") => {
    if (next === loopOptions.type) return;
    if (next === "manual") {
      setAudioSettings({ loopOptions: { type: "manual" } });
    } else {
      const nextDelay =
        delayMode === "fixed" ? delayValue : (delayValue / 100) * loopLength;
      setAudioSettings({
        loopOptions: { type: "automatic", loopDelay: nextDelay },
      });
    }
    capture("loop_mode_changed", { loop_mode: next });
  };

  const handleDelayModeChange = (next: "fixed" | "relative") => {
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
  const formatSeconds = (v: number) => (Math.round(v * 10) / 10).toString();

  return (
    <>
      <div className="flex flex-col gap-1.5 self-stretch">
        <div className="font-inria text-sm text-black/50">Loop Mode</div>
        <div className="flex items-start gap-2">
          {(["manual", "automatic"] as const).map((m) => (
            <button
              key={m}
              onClick={() => handleLoopModeChange(m)}
              className={`mode-btn ${loopOptions.type === m ? "active" : ""}`}
            >
              {m === "manual" ? "Manual" : "Automatic"}
            </button>
          ))}
        </div>
        <div className="font-inria text-sm text-black/50 leading-snug pt-1">
          {isManual ? (
            <>
              Pauses at loop end; press{" "}
              <PlayIcon
                size={12}
                weight="fill"
                color="var(--color-play)"
                style={{ display: "inline", verticalAlign: "middle" }}
              />{" "}
              to replay.
            </>
          ) : (
            "Playback loops automatically, with an optional delay between loops."
          )}
        </div>
      </div>
      {!isManual && (
        <div className="flex flex-col gap-1.5 self-stretch border-l border-border pl-4 ml-2">
          <div className="font-inria text-sm text-black/50">Loop Delay</div>
          <div className="flex items-center gap-4 self-stretch">
            <div className="flex items-start gap-2 flex-1">
              {(["fixed", "relative"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => handleDelayModeChange(m)}
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
          <div className="font-inria text-sm text-black/50 leading-snug pt-1">
            {delayMode === "fixed"
              ? `A ${formatSeconds(delayValue)}s delay will occur between loops.`
              : `A ${formatSeconds(delayValue)}% delay will occur between loops.`}
          </div>
        </div>
      )}
    </>
  );
}
