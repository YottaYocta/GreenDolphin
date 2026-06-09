import { useState, useRef, useCallback } from "react";
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
  const lastTimeStamp = useRef<number>(0);
  const rafRef = useRef<number | undefined>(undefined);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopPlaying = useCallback(() => {
    if (rafRef.current !== undefined) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = undefined;
    }
  }, []);

  const cancelTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const tick = useCallback(
    (onEnd: () => void) => {
      const now = performance.now();
      const startMS = loop ? computeMS(sampleRate, loop.start) : 0;
      const endMS = loop ? computeMS(sampleRate, loop.end) : duration * 1000;

      const next =
        playbackPosition.current +
        (now - lastTimeStamp.current) * playbackSpeed;
      lastTimeStamp.current = now;

      if (next >= endMS) {
        onEnd();
        return;
      }

      playbackPosition.current = Math.max(startMS, next);
      rafRef.current = requestAnimationFrame(() => tick(onEnd));
    },
    [sampleRate, duration, loop, playbackSpeed],
  );

  const startPlaying = useCallback(
    (onEnd: () => void) => {
      lastTimeStamp.current = performance.now();
      rafRef.current = requestAnimationFrame(() => tick(onEnd));
    },
    [tick],
  );

  const startTimer = useCallback(
    (onDelayEnd: () => void) => {
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        onDelayEnd();
      }, loopDelay * 1000);
    },
    [loopDelay],
  );

  const applyTransition = useApplyTransition({
    playState,
    sampleRate,
    duration,
    loop,
    loopDelay,
    playbackPosition,
    startPlaying,
    stopPlaying,
    startTimer,
    cancelTimer,
    setPlayState,
    onEnd: () => dispatch({ type: "reach-end" }),
    onDelayEnd: () => dispatch({ type: "delay-end" }),
  });

  const dispatch = useCallback(
    (event: ClockEvent) => {
      cancelTimer();
      const result = reduce(playState, event, {
        sampleRate,
        duration,
        loop,
        loopDelay,
      });
      if (result.nextPositionMS !== undefined)
        setLastStartPosition(result.nextPositionMS);
      applyTransition(result);
    },
    [
      playState,
      sampleRate,
      duration,
      loop,
      loopDelay,
      cancelTimer,
      applyTransition,
    ],
  );

  const reset = useCallback(() => {
    stopPlaying();
    cancelTimer();
    playbackPosition.current = 0;
    setPlayState("paused");
  }, [stopPlaying, cancelTimer, setPlayState]);

  return { playState, playbackPosition, dispatch, reset, lastStartPosition };
}
