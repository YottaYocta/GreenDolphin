import { useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  PauseIcon,
  PlayIcon,
  SnowflakeIcon,
  SkipBackIcon,
  SkipForwardIcon,
} from "@phosphor-icons/react";
import { PlaybackContext } from "../playback/PlaybackContext";
import { capture } from "../lib/posthog";

export function PlaybackControls() {
  const playback = useContext(PlaybackContext);
  if (!playback)
    throw new Error("PlaybackControls must be used within a PlaybackProvider");
  const {
    playbackPosition,
    loopPosition,
    loopLength,
    playState,
    triggerAction,
    playbackSettings,
  } = playback;
  const { loop, loopDelay } = playbackSettings;

  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownRafRef = useRef(0);

  useEffect(() => {
    if (playState !== "waiting") {
      cancelAnimationFrame(countdownRafRef.current);
      setCountdown(null);
      return;
    }
    const tick = () => {
      const elapsed = loopPosition.current - loopLength;
      const remaining = loopDelay - elapsed;
      setCountdown(Math.max(0, remaining));
      countdownRafRef.current = requestAnimationFrame(tick);
    };
    countdownRafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(countdownRafRef.current);
  }, [playState, loopPosition, loopLength, loopDelay]);

  const rewindFiveSeconds = useCallback(() => {
    triggerAction({
      type: "move",
      position: Math.max(0, playbackPosition.current - 5000),
    });
  }, [playbackPosition, triggerAction]);

  const fastForwardFiveSeconds = useCallback(() => {
    triggerAction({
      type: "move",
      position: Math.max(0, playbackPosition.current + 5000),
    });
  }, [playbackPosition, triggerAction]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "0") {
        const currentStart = loop ? loop.start : 0;
        triggerAction({ type: "move", position: currentStart });
        triggerAction("play");
      } else if (e.key === "p") {
        if (playState === "paused" || playState === "frozen") {
          triggerAction("play");
        } else {
          triggerAction("pause");
        }
      } else if (e.key === "f") {
        if (playState === "frozen") triggerAction("pause");
        else triggerAction("freeze");
      }
    };
    window.addEventListener("keypress", handleKey);
    return () => window.removeEventListener("keypress", handleKey);
  }, [loop, playState, triggerAction]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "h") rewindFiveSeconds();
      else if (e.key === "l") fastForwardFiveSeconds();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [rewindFiveSeconds, fastForwardFiveSeconds]);

  return (
    <div className="flex items-start gap-4 flex-col rounded-xl max-md:flex-1 bg-white border border-border [box-shadow:var(--shadow-panel)] p-4">
      <div className="flex items-start gap-4 flex-1 self-stretch">
        <button
          onClick={() => {
            if (playState === "playing" || playState === "waiting") {
              capture("playback_paused");
              triggerAction("pause");
            } else {
              capture("playback_started");
              triggerAction("play");
            }
          }}
          className={`btn-surface p-3 flex-1 self-stretch cursor-pointer ${
            playState === "waiting"
              ? "bg-waiting hover:bg-waiting-hover active:bg-waiting-active [box-shadow:var(--shadow-btn-colored)]"
              : playState === "playing"
                ? "bg-play hover:bg-play-hover active:bg-play-active [box-shadow:var(--shadow-btn-colored)]"
                : ""
          }`}
        >
          {playState === "playing" ? (
            <PauseIcon
              size={36}
              weight="fill"
              color="var(--color-icon-white)"
              style={{ flexShrink: 0 }}
            />
          ) : playState === "waiting" ? (
            <span
              className="font-space-mono text-white text-lg tabular-nums"
              style={{ flexShrink: 0 }}
            >
              {countdown !== null ? countdown.toFixed(1) : "…"}
            </span>
          ) : (
            <PlayIcon
              size={40}
              weight="fill"
              color="var(--color-play)"
              style={{ flexShrink: 0 }}
            />
          )}
        </button>
        <button
          onClick={() => {
            triggerAction("freeze");
          }}
          className={`btn-surface p-3 flex-1 self-stretch cursor-pointer ${playState === "frozen" ? "bg-freeze hover:bg-freeze-hover active:bg-freeze-active [box-shadow:var(--shadow-btn-colored)]" : ""}`}
        >
          <SnowflakeIcon
            size={48}
            weight="fill"
            color={playState === "frozen" ? "#FFFFFF" : "var(--color-freeze)"}
            style={{ flexShrink: 0 }}
          />
        </button>
      </div>
      <div className="flex items-start gap-4 flex-1 self-stretch">
        <button
          onClick={rewindFiveSeconds}
          className="btn-surface p-3 flex-1 self-stretch cursor-pointer"
        >
          <SkipBackIcon
            size={32}
            weight="fill"
            color="var(--color-icon)"
            style={{ opacity: 0.67, flexShrink: 0 }}
          />
        </button>
        <button
          onClick={fastForwardFiveSeconds}
          className="btn-surface p-3 flex-1 self-stretch cursor-pointer"
        >
          <SkipForwardIcon
            size={32}
            weight="fill"
            color="var(--color-icon)"
            style={{ opacity: 0.67, flexShrink: 0 }}
          />
        </button>
      </div>
    </div>
  );
}
