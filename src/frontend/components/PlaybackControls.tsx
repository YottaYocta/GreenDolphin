import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { tinykeys } from "tinykeys";
import {
  PauseIcon,
  PlayIcon,
  SnowflakeIcon,
  SkipBackIcon,
  SkipForwardIcon,
} from "@phosphor-icons/react";
import {
  PlaybackContext,
  effectiveLoopDelay,
} from "../playback/PlaybackContext";
import { capture } from "../lib/posthog";

export function PlaybackControls({
  showFreeze = true,
  disabled = false,
}: {
  showFreeze?: boolean;
  disabled?: boolean;
}) {
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

  const toggleFreeze = useCallback(() => {
    if (disabled) return;
    triggerAction("freeze");
  }, [disabled, triggerAction]);

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
      ...(showFreeze ? { f: () => toggleFreeze() } : {}),
      h: () => rewindFiveSeconds(),
      l: () => fastForwardFiveSeconds(),
    });
  }, [
    disabled,
    showFreeze,
    triggerAction,
    togglePlay,
    toggleFreeze,
    rewindFiveSeconds,
    fastForwardFiveSeconds,
  ]);

  const btn = `btn-surface rounded-xl h-full min-h-0 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed p-5 ${
    showFreeze ? "md:p-10" : "md:p-6"
  }`;

  return (
    <div
      className={`grid gap-4 w-full h-min rounded-xl max-md:flex-1 ${
        showFreeze
          ? "max-md:grid-cols-2 grid-cols-4 max-md:grid-rows-2"
          : "grid-cols-2 md:grid-cols-3"
      }`}
    >
      <button
        onClick={togglePlay}
        disabled={disabled}
        className={`${btn} ${showFreeze ? "" : "max-md:order-last max-md:col-span-2 md:p-8"} ${
          playState === "waiting"
            ? "bg-waiting hover:bg-waiting-hover active:bg-waiting-active [box-shadow:var(--shadow-btn-colored)]"
            : playState === "playing"
              ? "bg-play hover:bg-play-hover active:bg-play-active [box-shadow:var(--shadow-btn-colored)]"
              : ""
        }`}
      >
        {/* fixed-size content box so icon size changes don't shift layout */}
        <span className="size-10 shrink-0 flex items-center justify-center">
          {playState === "playing" ? (
            <PauseIcon
              size={36}
              weight="fill"
              color="var(--color-icon-white)"
              style={{ flexShrink: 0 }}
            />
          ) : playState === "waiting" ? (
            <span className="font-space-mono text-white text-lg tabular-nums">
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
        </span>
      </button>
      {showFreeze && (
        <button
          onClick={toggleFreeze}
          className={`${btn} ${playState === "frozen" ? "bg-freeze hover:bg-freeze-hover active:bg-freeze-active [box-shadow:var(--shadow-btn-colored)]" : ""}`}
        >
          <SnowflakeIcon
            size={40}
            weight="fill"
            color={playState === "frozen" ? "#FFFFFF" : "var(--color-freeze)"}
            style={{ flexShrink: 0 }}
          />
        </button>
      )}
      <button onClick={rewindFiveSeconds} disabled={disabled} className={btn}>
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
        className={btn}
      >
        <SkipForwardIcon
          size={32}
          weight="fill"
          color="var(--color-icon)"
          style={{ opacity: 0.67, flexShrink: 0 }}
        />
      </button>
    </div>
  );
}
