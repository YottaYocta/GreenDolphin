import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { PlaybackContext } from "../playback/PlaybackContext";
const iconStyle = {
  width: 24,
  height: "auto",
  overflow: "visible",
  flexShrink: 0,
} as const;

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
    <div className="flex items-start gap-4 flex-col p-4 rounded-xl [box-shadow:var(--shadow-panel)] bg-white border border-border max-md:flex-1">
      <div className="flex items-start gap-4 flex-1 self-stretch">
        <button
          onClick={() => {
            if (playState === "playing" || playState === "waiting") {
              triggerAction("pause");
            } else {
              triggerAction("play");
            }
          }}
          className={`btn-surface p-3.25 flex-1 self-stretch cursor-pointer ${
            playState === "waiting"
              ? "bg-waiting hover:bg-waiting-hover active:bg-waiting-active [box-shadow:var(--shadow-btn-colored)]"
              : playState === "playing"
                ? "bg-play hover:bg-play-hover active:bg-play-active [box-shadow:var(--shadow-btn-colored)]"
                : ""
          }`}
        >
          {playState === "playing" ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="32"
              height="32"
              viewBox="0 0 256 256"
              style={iconStyle}
            >
              <path
                d="M216,48H168a16,16,0,0,0-16,16V192a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V64A16,16,0,0,0,216,48ZM88,48H40A16,16,0,0,0,24,64V192a16,16,0,0,0,16,16H88a16,16,0,0,0,16-16V64A16,16,0,0,0,88,48Z"
                fill="#FFFFFF"
              />
            </svg>
          ) : playState === "waiting" ? (
            <span
              className="font-space-mono text-white text-lg tabular-nums"
              style={{ flexShrink: 0 }}
            >
              {countdown !== null ? countdown.toFixed(1) : "…"}
            </span>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="32"
              height="32"
              viewBox="0 0 256 256"
              style={iconStyle}
            >
              <path
                d="M240,128a15.74,15.74,0,0,1-7.6,13.51L88.32,229.65a16,16,0,0,1-16.2.3A15.86,15.86,0,0,1,64,216.13V39.87a15.86,15.86,0,0,1,8.12-13.82,16,16,0,0,1,16.2.3L232.4,114.49A15.74,15.74,0,0,1,240,128Z"
                fill="var(--color-play)"
              />
            </svg>
          )}
        </button>
        <button
          onClick={() => {
            if (playState === "frozen") {
              triggerAction("pause");
            } else {
              triggerAction("freeze");
            }
          }}
          className={`btn-surface p-3.25 flex-1 self-stretch cursor-pointer ${playState === "frozen" ? "bg-freeze hover:bg-freeze-hover active:bg-freeze-active [box-shadow:var(--shadow-btn-colored)]" : ""}`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="32"
            height="32"
            viewBox="0 0 256 256"
            style={{ overflow: "visible", flexShrink: 0 }}
          >
            <path
              d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm42.37,119.22,18.94-6.76a8,8,0,1,1,5.38,15.08l-15.48,5.52,4.52,16.87a8,8,0,0,1-5.66,9.8A8.23,8.23,0,0,1,176,184a8,8,0,0,1-7.73-5.93l-5.57-20.8L136,141.86v30.83l13.66,13.65a8,8,0,0,1-11.32,11.32L128,187.31l-10.34,10.35a8,8,0,0,1-11.32-11.32L120,172.69V141.86L93.3,157.27l-5.57,20.8A8,8,0,0,1,80,184a8.23,8.23,0,0,1-2.07-.27,8,8,0,0,1-5.66-9.8l4.52-16.87-15.48-5.52a8,8,0,0,1,5.38-15.08l18.94,6.76L112,128,85.63,112.78l-18.94,6.76A8.18,8.18,0,0,1,64,120a8,8,0,0,1-2.69-15.54l15.48-5.52L72.27,82.07a8,8,0,0,1,15.46-4.14l5.57,20.8L120,114.14V83.31L106.34,69.66a8,8,0,0,1,11.32-11.32L128,68.69l10.34-10.35a8,8,0,0,1,11.32,11.32L136,83.31v30.83l26.7-15.41,5.57-20.8a8,8,0,0,1,15.46,4.14l-4.52,16.87,15.48,5.52A8,8,0,0,1,192,120a8.18,8.18,0,0,1-2.69-.46l-18.94-6.76L144,128Z"
              fill={playState === "frozen" ? "#FFFFFF" : "var(--color-freeze)"}
            />
          </svg>
        </button>
      </div>
      <div className="flex items-start gap-4 flex-1 self-stretch">
        <button
          onClick={rewindFiveSeconds}
          className="btn-surface p-3.25 flex-1 self-stretch cursor-pointer"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="32"
            height="32"
            viewBox="0 0 256 256"
            style={{ ...iconStyle, opacity: 0.67 }}
          >
            <path
              d="M208,47.88V208.12a16,16,0,0,1-24.43,13.43L64,146.77V216a8,8,0,0,1-16,0V40a8,8,0,0,1,16,0v69.23L183.57,34.45A15.95,15.95,0,0,1,208,47.88Z"
              fill="#000000"
            />
          </svg>
        </button>
        <button
          onClick={fastForwardFiveSeconds}
          className="btn-surface p-3.25 flex-1 self-stretch cursor-pointer"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="32"
            height="32"
            viewBox="0 0 256 256"
            style={{
              ...iconStyle,
              opacity: 0.67,
              rotate: "180deg",
              transformOrigin: "50% 50%",
            }}
          >
            <path
              d="M208,47.88V208.12a16,16,0,0,1-24.43,13.43L64,146.77V216a8,8,0,0,1-16,0V40a8,8,0,0,1,16,0v69.23L183.57,34.45A15.95,15.95,0,0,1,208,47.88Z"
              fill="#000000"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
