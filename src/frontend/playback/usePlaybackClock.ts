import { useState, useRef, useCallback, useEffect } from "react";
import type { RefObject } from "react";
import type { Section } from "../lib/waveform";
import type { PlayState } from "./PlaybackContext";
import type { ClockEvent, UserEvent, Transition } from "./machine";
import { reduce } from "./machine";
import { computeMS } from "../lib/util";
import { useApplyTransition } from "./useApplyTransition";

export type AudioSettings = {
  sampleRate: number;
  loop: Section | undefined;
  loopDelay: number;
  playbackSpeed: number;
};

const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  sampleRate: 44100,
  loop: undefined,
  loopDelay: 0,
  playbackSpeed: 1,
};

export interface UsePlaybackClockProps {
  duration: number;
  initialSettings?: Partial<AudioSettings>;
}

export type AudioSettingsUpdate = Omit<Partial<AudioSettings>, "loop"> & {
  loop?: Section | null;
};

export interface PlaybackClockResult {
  audioSettings: AudioSettings;
  updateSettings: (settings: AudioSettingsUpdate) => void;
  playState: PlayState;
  lastStartPosition: number;
  playbackPosition: RefObject<number>;
  timerStartedAtMS: number | null;
  dispatch: (event: UserEvent) => void;
  reset: () => void;
}

export function usePlaybackClock({
  duration,
  initialSettings,
}: UsePlaybackClockProps): PlaybackClockResult {
  const [sampleRate, setSampleRate] = useState(
    initialSettings?.sampleRate ?? DEFAULT_AUDIO_SETTINGS.sampleRate,
  );
  const [loop, setLoop] = useState<Section | undefined>(
    initialSettings?.loop ?? DEFAULT_AUDIO_SETTINGS.loop,
  );
  const [loopDelay, setLoopDelay] = useState(
    initialSettings?.loopDelay ?? DEFAULT_AUDIO_SETTINGS.loopDelay,
  );
  const [playbackSpeed, setPlaybackSpeed] = useState(
    initialSettings?.playbackSpeed ?? DEFAULT_AUDIO_SETTINGS.playbackSpeed,
  );

  const audioSettings: AudioSettings = {
    sampleRate,
    loop,
    loopDelay,
    playbackSpeed,
  };

  const [playState, setPlayState] = useState<PlayState>("paused");
  const [lastStartPosition, setLastStartPosition] = useState<number>(
    loop?.start ?? 0,
  );

  const playbackPosition = useRef<number>(0);
  const [playbackStartTimestamp, setPlaybackStartTimestamp] = useState<
    number | null
  >(null);
  const [timerStartedAtMS, setTimerStartedAtMS] = useState<number | null>(null);

  const startPlaying = useCallback(
    () => setPlaybackStartTimestamp(performance.now()),
    [],
  );
  const stopPlaying = useCallback(() => setPlaybackStartTimestamp(null), []);
  const startTimer = useCallback(
    () => setTimerStartedAtMS(performance.now()),
    [],
  );

  const stopTimer = useCallback(() => setTimerStartedAtMS(null), []);

  const applyTransitionEffects = useApplyTransition({
    playState,
    playbackPosition,
    startPlaying,
    stopPlaying,
    startTimer,
    stopTimer,
  });

  const applyTransition = useCallback(
    (result: Transition) => {
      if (result.nextPositionMS !== undefined)
        setLastStartPosition(result.nextPositionMS);
      setPlayState(result.nextState);
      applyTransitionEffects(result);
    },
    [applyTransitionEffects],
  );

  const dispatch = useCallback(
    (event: ClockEvent) => {
      const result = reduce(playState, event, {
        sampleRate,
        duration,
        loop,
        loopDelay,
        currentPositionMS: playbackPosition.current,
      });
      applyTransition(result);
    },
    [playState, sampleRate, duration, loop, loopDelay, applyTransition],
  );

  const updateSettings = useCallback(
    (settings: AudioSettingsUpdate) => {
      let dirty = false;
      let nextSampleRate = sampleRate;
      let nextLoop = loop;

      if (
        settings.sampleRate !== undefined &&
        settings.sampleRate !== sampleRate
      ) {
        setSampleRate(settings.sampleRate);
        nextSampleRate = settings.sampleRate;
        dirty = true;
      }
      if ("loop" in settings) {
        const resolved = settings.loop ?? undefined;
        if (resolved !== loop) {
          setLoop(resolved);
          nextLoop = resolved;
          dirty = true;
        }
      }
      if (
        settings.loopDelay !== undefined &&
        settings.loopDelay !== loopDelay
      ) {
        setLoopDelay(settings.loopDelay);
        dirty = true;
      }
      if (
        settings.playbackSpeed !== undefined &&
        settings.playbackSpeed !== playbackSpeed
      ) {
        setPlaybackSpeed(settings.playbackSpeed);
        dirty = true;
      }

      if (dirty) {
        const loopStartMS = computeMS(nextSampleRate, nextLoop?.start ?? 0);
        const loopEndMS = nextLoop
          ? computeMS(nextSampleRate, nextLoop.end)
          : duration * 1000;
        const pos = playbackPosition.current;
        const inLoop = pos >= loopStartMS && pos < loopEndMS;

        if (playState === "playing")
          applyTransition({
            nextState: "playing",
            nextPositionMS: inLoop ? pos : loopStartMS,
          });
        else if (playState === "waiting")
          applyTransition({
            nextState: "playing",
            nextPositionMS: loopStartMS,
          });
      }
    },
    [sampleRate, loop, loopDelay, playbackSpeed, playState, applyTransition, duration],
  );

  useEffect(() => {
    if (playbackStartTimestamp === null) return;
    const startMS = loop ? computeMS(sampleRate, loop.start) : 0;
    const endMS = loop ? computeMS(sampleRate, loop.end) : duration * 1000;
    let lastTs = performance.now();
    let rafId: number;
    const tick = () => {
      const now = performance.now();
      const next = playbackPosition.current + (now - lastTs) * playbackSpeed;
      lastTs = now;
      if (next >= endMS) {
        dispatch({ type: "reach-end" });
        return;
      }
      playbackPosition.current = Math.max(startMS, next);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [
    playbackStartTimestamp,
    sampleRate,
    duration,
    loop,
    playbackSpeed,
    dispatch,
  ]);

  useEffect(() => {
    if (timerStartedAtMS === null) return;
    const elapsed = performance.now() - timerStartedAtMS;
    const remaining = Math.max(0, loopDelay * 1000 - elapsed);
    const id = setTimeout(() => {
      dispatch({ type: "delay-end" });
    }, remaining);
    return () => clearTimeout(id);
  }, [timerStartedAtMS, loopDelay, dispatch]);

  const reset = useCallback(() => {
    setPlaybackStartTimestamp(null);
    setTimerStartedAtMS(null);
    playbackPosition.current = 0;
    setPlayState("paused");
  }, []);

  return {
    audioSettings,
    updateSettings,
    playState,
    playbackPosition,
    timerStartedAtMS,
    dispatch,
    reset,
    lastStartPosition,
  };
}
