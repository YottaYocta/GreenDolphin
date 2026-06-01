import { useState, useRef, useEffect, useCallback } from "react";
import type { RefObject } from "react";
import type { Section } from "../lib/waveform";
import type { PlayState } from "./PlaybackContext";
import { computeMS } from "../lib/util";

export interface UsePlaybackClockProps {
  sampleRate: number;
  duration: number;
  loop: Section | undefined;
  loopDelay: number;
  playbackSpeed: number;
}

export interface PlaybackClockResult {
  playState: PlayState;
  setPlayState: (state: PlayState) => void;
  playbackPosition: RefObject<number>;
  loopPauseStart: RefObject<number | null>;
  loopPauseEnd: RefObject<number | null>;
  stopClock: () => void;
  cancelLoopDelay: () => void;
  isLoopDelayActive: () => boolean;
}

export function usePlaybackClock({
  sampleRate,
  duration,
  loop,
  loopDelay,
  playbackSpeed,
}: UsePlaybackClockProps): PlaybackClockResult {
  const [playState, setPlayState] = useState<PlayState>("paused");

  const playbackPosition = useRef<number>(0);
  const lastTimeStamp = useRef<number>(0);
  const animationFrameId = useRef<number | undefined>(undefined);
  const loopDelayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loopPauseStart = useRef<number | null>(null);
  const loopPauseEnd = useRef<number | null>(null);

  const stopClock = useCallback(() => {
    if (animationFrameId.current !== undefined) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = undefined;
    }
  }, []);

  const cancelLoopDelay = useCallback(() => {
    if (loopDelayTimerRef.current !== null) {
      clearTimeout(loopDelayTimerRef.current);
      loopDelayTimerRef.current = null;
    }
    loopPauseStart.current = null;
    loopPauseEnd.current = null;
  }, []);

  const tick = useCallback(() => {
    const now = performance.now();
    const next =
      playbackPosition.current + (now - lastTimeStamp.current) * playbackSpeed;

    const startMS = loop ? computeMS(sampleRate, loop.start) : 0;
    const endMS = loop ? computeMS(sampleRate, loop.end) : duration * 1000;

    if (next > endMS) {
      if (loopDelay > 0) {
        playbackPosition.current = endMS;
        lastTimeStamp.current = now;
        loopPauseStart.current = now;
        loopPauseEnd.current = now + loopDelay * 1000;
        setPlayState("paused");
        loopDelayTimerRef.current = setTimeout(() => {
          loopDelayTimerRef.current = null;
          loopPauseStart.current = null;
          loopPauseEnd.current = null;
          playbackPosition.current = startMS;
          setPlayState("playing");
        }, loopDelay * 1000);
      } else {
        playbackPosition.current = startMS;
        lastTimeStamp.current = now;
        animationFrameId.current = requestAnimationFrame(tick);
      }
      return;
    }
    playbackPosition.current = Math.max(startMS, next);
    lastTimeStamp.current = now;
    animationFrameId.current = requestAnimationFrame(tick);
  }, [duration, loop, loopDelay, playbackSpeed, sampleRate]);

  const startClock = useCallback(() => {
    stopClock();
    lastTimeStamp.current = performance.now();
    animationFrameId.current = requestAnimationFrame(tick);
  }, [stopClock, tick]);

  useEffect(() => {
    if (playState === "playing") {
      startClock();
    } else {
      stopClock();
    }
    return stopClock;
  }, [playState, startClock, stopClock]);

  const isLoopDelayActive = useCallback(
    () => loopDelayTimerRef.current !== null,
    [],
  );

  return {
    playState,
    setPlayState,
    playbackPosition,
    loopPauseStart,
    loopPauseEnd,
    stopClock,
    cancelLoopDelay,
    isLoopDelayActive,
  };
}
