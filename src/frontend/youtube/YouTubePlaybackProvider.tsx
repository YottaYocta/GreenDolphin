import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { PlaybackContext } from "../playback/PlaybackContext";
import type {
  PlaybackSettings,
  PlaybackAction,
} from "../playback/PlaybackContext";
import type { AudioSettingsUpdate } from "../playback/usePlaybackClock";
import { usePlaybackClock } from "../playback/usePlaybackClock";
import { clampSection, computeMS } from "../lib/util";
import type { FrequencyData } from "../lib/frequency";
import { YT_STATE_PLAYING, YT_STATE_PAUSED } from "./iframeApi";
import type { YouTubePlayer } from "./iframeApi";
import type { PlayerStateListener } from "./useYouTubePlayer";

// 1 "sample" = 1ms, so Sections map directly onto milliseconds
export const YOUTUBE_SAMPLE_RATE = 1000;

export const YT_MIN_RATE = 0.25;
export const YT_MAX_RATE = 2;

// Beyond this the player is considered to have jumped (user seek) rather than drifted
const DRIFT_TOLERANCE_MS = 400;
// How long a commanded seek may take before we stop waiting for it to land
const SEEK_TIMEOUT_MS = 3000;

const clampRate = (v: number) =>
  Math.min(YT_MAX_RATE, Math.max(YT_MIN_RATE, v));

export interface YouTubePlaybackProviderProps {
  player: YouTubePlayer | null;
  duration: number;
  subscribe: (listener: PlayerStateListener) => () => void;
  initialSettings?: Partial<PlaybackSettings>;
  children?: ReactNode;
}

export const YouTubePlaybackProvider = ({
  player,
  duration,
  subscribe,
  initialSettings,
  children,
}: YouTubePlaybackProviderProps) => {
  const [gain, setGain] = useState(initialSettings?.gain ?? 1);

  const {
    audioSettings,
    updateSettings,
    playState,
    playbackPosition,
    positionEpoch,
    timerStartedAtMS,
    dispatch,
    lastStartPosition,
  } = usePlaybackClock({
    duration,
    initialSettings: {
      sampleRate: YOUTUBE_SAMPLE_RATE,
      loop: initialSettings?.loop,
      loopOptions: initialSettings?.loopOptions,
      playbackSpeed: clampRate(initialSettings?.playbackSpeed ?? 1),
    },
  });

  const { loop, loopOptions, playbackSpeed } = audioSettings;
  const totalMS = duration * 1000;

  const setAudioSettings = useCallback(
    (settings: Partial<PlaybackSettings>) => {
      const clockUpdates: AudioSettingsUpdate = {};
      if ("loop" in settings)
        clockUpdates.loop = settings.loop
          ? clampSection(settings.loop, { start: 0, end: totalMS })
          : null;
      if (settings.loopOptions !== undefined)
        clockUpdates.loopOptions = settings.loopOptions;
      if (settings.playbackSpeed !== undefined)
        clockUpdates.playbackSpeed = clampRate(settings.playbackSpeed);
      if (Object.keys(clockUpdates).length) updateSettings(clockUpdates);

      if (settings.gain !== undefined)
        setGain(Math.max(0, Math.min(1, settings.gain)));
    },
    [totalMS, updateSettings],
  );

  const triggerAction = useCallback(
    (action: PlaybackAction) => {
      if (action === "play" || action === "pause") {
        dispatch({ type: "play-pause" });
      } else if (action === "freeze") {
        // freeze is not supported in YouTube mode
      } else if (action.type === "move") {
        dispatch({ type: "move", positionMS: Math.max(0, action.position) });
      }
    },
    [dispatch],
  );

  // --- player sync ------------------------------------------------------

  const pendingSeekRef = useRef<{ ms: number; at: number } | null>(null);
  const lastPauseCommandRef = useRef(-Infinity);

  const commandSeek = useCallback(
    (ms: number) => {
      if (!player) return;
      pendingSeekRef.current = { ms, at: performance.now() };
      player.seekTo(ms / 1000, true);
    },
    [player],
  );

  // Returns true while a commanded seek is still in flight, so drift checks
  // don't mistake the not-yet-landed player position for a user seek.
  const seekInFlight = useCallback(
    (playerMS: number) => {
      const pending = pendingSeekRef.current;
      if (!pending) return false;
      if (
        Math.abs(playerMS - pending.ms) < DRIFT_TOLERANCE_MS ||
        performance.now() - pending.at > SEEK_TIMEOUT_MS
      ) {
        pendingSeekRef.current = null;
        return false;
      }
      return true;
    },
    [],
  );

  useEffect(() => {
    player?.setPlaybackRate(clampRate(playbackSpeed));
  }, [player, playbackSpeed]);

  useEffect(() => {
    player?.setVolume(Math.round(Math.max(0, Math.min(1, gain)) * 100));
  }, [player, gain]);

  // Clock → player: apply play/pause and any discontinuous position jump
  // (seek, loop wrap — signalled by positionEpoch).
  useEffect(() => {
    if (!player) return;
    if (playState === "playing") {
      commandSeek(playbackPosition.current);
      player.playVideo();
    } else {
      // Pause before seeking: seeking a playing (or ended) video makes the
      // player emit a transient PLAYING event that would read as a user play.
      lastPauseCommandRef.current = performance.now();
      player.pauseVideo();
      commandSeek(playbackPosition.current);
    }
  }, [player, playState, positionEpoch, commandSeek, playbackPosition]);

  // Player → clock, while playing: glue the clock to the video's time so the
  // scrubber always mirrors the video; a large jump means the user seeked via
  // the YouTube UI, which routes through the machine (loop rules apply).
  useEffect(() => {
    if (!player || playState !== "playing") return;
    let rafId: number;
    const tick = () => {
      rafId = requestAnimationFrame(tick);
      const playerMS = player.getCurrentTime() * 1000;
      if (seekInFlight(playerMS)) return;
      if (Math.abs(playerMS - playbackPosition.current) > DRIFT_TOLERANCE_MS) {
        triggerAction({ type: "move", position: playerMS });
      } else {
        playbackPosition.current = playerMS;
      }
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [player, playState, playbackPosition, seekInFlight, triggerAction]);

  // Player → clock, while not playing: the user can still scrub the paused
  // video via the YouTube UI, which emits no state-change event.
  useEffect(() => {
    if (!player || playState === "playing") return;
    const id = setInterval(() => {
      const playerMS = player.getCurrentTime() * 1000;
      if (seekInFlight(playerMS)) return;
      if (Math.abs(playerMS - playbackPosition.current) > DRIFT_TOLERANCE_MS)
        triggerAction({ type: "move", position: playerMS });
    }, 250);
    return () => clearInterval(id);
  }, [player, playState, playbackPosition, seekInFlight, triggerAction]);

  // Player → clock: play/pause initiated from the YouTube UI.
  useEffect(() => {
    if (!player) return;
    return subscribe((state) => {
      if (state === YT_STATE_PLAYING && playState !== "playing") {
        // Echo of our own pause+seek (seeking from the ended state resumes
        // playback) — re-assert the pause instead of treating it as the user.
        if (performance.now() - lastPauseCommandRef.current < SEEK_TIMEOUT_MS) {
          player.pauseVideo();
          return;
        }
        triggerAction({
          type: "move",
          position: player.getCurrentTime() * 1000,
        });
        // "move" already resumes playback from the waiting state
        if (playState !== "waiting") triggerAction("play");
      } else if (state === YT_STATE_PAUSED && playState === "playing") {
        triggerAction("pause");
      }
    });
  }, [player, subscribe, playState, triggerAction]);

  // --- context value ----------------------------------------------------

  const loopLength = loop ? (loop.end - loop.start) / YOUTUBE_SAMPLE_RATE : duration;

  const loopPosition = useRef<number>(0);

  useEffect(() => {
    const loopStartMS = loop ? computeMS(YOUTUBE_SAMPLE_RATE, loop.start) : 0;
    let rafId: number;
    const update = () => {
      rafId = requestAnimationFrame(update);
      if (playState === "waiting") {
        const startedAt = timerStartedAtMS!;
        loopPosition.current =
          loopLength + (performance.now() - startedAt) / 1000;
      } else {
        loopPosition.current = (playbackPosition.current - loopStartMS) / 1000;
      }
    };
    rafId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(rafId);
  }, [loop, loopLength, playbackPosition, playState, timerStartedAtMS]);

  const frequencyData = useRef<FrequencyData | undefined>(undefined);

  const playbackSettings: PlaybackSettings = {
    pitchShift: 0,
    gain,
    loop,
    loopOptions,
    playbackSpeed,
  };

  return (
    <PlaybackContext.Provider
      value={{
        playState,
        lastStartPosition,
        playbackPosition,
        loopPosition,
        loopLength,
        playbackSettings,
        setAudioSettings,
        triggerAction,
        frequencyData,
        audioContext: null,
        analyserNode: null,
      }}
    >
      {children}
    </PlaybackContext.Provider>
  );
};
