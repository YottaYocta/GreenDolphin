import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { tinykeys } from "tinykeys";
import {
  PauseIcon,
  PlayIcon,
  SkipBackIcon,
  SkipForwardIcon,
} from "@phosphor-icons/react";
import {
  PlaybackContext,
  effectiveLoopDelay,
} from "../playback/PlaybackContext";
import { capture } from "../lib/posthog";

// PlaybackControls without freeze — freezing isn't possible through the
// YouTube IFrame API.
export function YouTubeControls({ disabled }: { disabled?: boolean }) {
  const playback = useContext(PlaybackContext);
  if (!playback)
    throw new Error("YouTubeControls must be used within a PlaybackProvider");
  const {
    playbackPosition,
    loopPosition,
    loopLength,
    playState,
    triggerAction,
    playbackSettings,
  } = playback;
  const { loopOptions } = playbackSettings;
  const loopDelay = effectiveLoopDelay(loopOptions);

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
    if (disabled) return;
    triggerAction({
      type: "move",
      position: Math.max(0, playbackPosition.current - 5000),
    });
  }, [disabled, playbackPosition, triggerAction]);

  const fastForwardFiveSeconds = useCallback(() => {
    if (disabled) return;
    triggerAction({
      type: "move",
      position: Math.max(0, playbackPosition.current + 5000),
    });
  }, [disabled, playbackPosition, triggerAction]);

  const togglePlay = useCallback(() => {
    if (disabled) return;
    if (playState === "playing" || playState === "waiting") {
      capture("playback_paused");
      triggerAction("pause");
    } else {
      capture("playback_started");
      triggerAction("play");
    }
  }, [disabled, playState, triggerAction]);

  useEffect(() => {
    return tinykeys(window, {
      "0": () => {
        if (!disabled) triggerAction({ type: "move", position: 0 });
      },
      Space: (e) => {
        e.preventDefault();
        togglePlay();
      },
      p: () => togglePlay(),
      h: () => rewindFiveSeconds(),
      l: () => fastForwardFiveSeconds(),
    });
  }, [
    disabled,
    triggerAction,
    togglePlay,
    rewindFiveSeconds,
    fastForwardFiveSeconds,
  ]);

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 w-full h-min rounded-xl max-md:flex-1">
      <button
        onClick={rewindFiveSeconds}
        disabled={disabled}
        className="btn-surface rounded-xl md:p-6 p-5 h-full min-h-0 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
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
        disabled={disabled}
        className="btn-surface rounded-xl md:p-6 p-5 h-full min-h-0 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <SkipForwardIcon
          size={32}
          weight="fill"
          color="var(--color-icon)"
          style={{ opacity: 0.67, flexShrink: 0 }}
        />
      </button>
      <button
        onClick={togglePlay}
        disabled={disabled}
        className={`col-span-2 md:col-span-1 md:order-first btn-surface rounded-xl md:p-8 p-5 h-full min-h-0 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
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
    </div>
  );
}
