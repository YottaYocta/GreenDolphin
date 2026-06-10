import { useState, useRef, useCallback, useEffect } from "react";
import type { RefObject } from "react";
import type { Section } from "../lib/waveform";
import type { PlayState } from "./PlaybackContext";
import type { ClockEvent, UserEvent } from "./machine";
import { reduce } from "./machine";
import { computeMS } from "../lib/util";
import { useApplyTransition } from "./useApplyTransition";

export interface UsePlaybackClockProps {
  sampleRate: number;
  duration: number;
  loop: Section | undefined;
  loopDelay: number;
  playbackSpeed: number;
}
export interface PlaybackClockResult {
  playState: PlayState;
  lastStartPosition: number;
  playbackPosition: RefObject<number>;
  timerStartedAtMS: number | null;
  dispatch: (event: UserEvent) => void;
  reset: () => void;
}

export function usePlaybackClock({
  sampleRate,
  duration,
  loop,
  loopDelay,
  playbackSpeed,
}: UsePlaybackClockProps): PlaybackClockResult {
  const [playState, setPlayState] = useState<PlayState>("paused");
  const [lastStartPosition, setLastStartPosition] = useState<number>(
    loop?.start ?? 0,
  );

  const playbackPosition = useRef<number>(0);
  const [playbackStartTimestamp, setPlaybackStartTimestamp] = useState<
    number | null
  >(null);
  const [timerStartedAtMS, setTimerStartedAtMS] = useState<number | null>(null);

  const startPlaying = useCallback(() => setPlaybackStartTimestamp(performance.now()), []);
  const stopPlaying = useCallback(() => setPlaybackStartTimestamp(null), []);
  const startTimer = useCallback(() => setTimerStartedAtMS(performance.now()), []);
  const cancelTimer = useCallback(() => setTimerStartedAtMS(null), []);

  const applyTransition = useApplyTransition({
    playState,
    playbackPosition,
    startPlaying,
    stopPlaying,
    startTimer,
    cancelTimer,
  });

  const dispatch = useCallback(
    (event: ClockEvent) => {
      setTimerStartedAtMS(null);
      const result = reduce(playState, event, {
        sampleRate,
        duration,
        loop,
        loopDelay,
        currentPositionMS: playbackPosition.current,
      });
      console.log(result);
      if (result.nextPositionMS !== undefined)
        setLastStartPosition(result.nextPositionMS);
      setPlayState(result.nextState);
      applyTransition(result);
    },
    [playState, sampleRate, duration, loop, loopDelay, applyTransition],
  );

  useEffect(() => {
    if (playbackStartTimestamp === null) return;
    let lastTs = performance.now();
    let rafId: number;
    const tick = () => {
      const now = performance.now();
      const startMS = loop ? computeMS(sampleRate, loop.start) : 0;
      const endMS = loop ? computeMS(sampleRate, loop.end) : duration * 1000;
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
  }, [playbackStartTimestamp, sampleRate, duration, loop, playbackSpeed, dispatch]);

  useEffect(() => {
    if (timerStartedAtMS === null) return;
    const id = setTimeout(() => {
      dispatch({ type: "delay-end" });
    }, loopDelay * 1000);
    return () => clearTimeout(id);
  }, [timerStartedAtMS, loopDelay, dispatch]);

  const reset = useCallback(() => {
    setPlaybackStartTimestamp(null);
    setTimerStartedAtMS(null);
    playbackPosition.current = 0;
    setPlayState("paused");
  }, []);

  return {
    playState,
    playbackPosition,
    timerStartedAtMS,
    dispatch,
    reset,
    lastStartPosition,
  };
}
