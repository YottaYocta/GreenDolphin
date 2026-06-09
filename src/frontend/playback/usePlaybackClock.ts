import { useState, useRef, useEffect, useCallback } from "react";
import type { RefObject } from "react";
import type { Section } from "../lib/waveform";
import type { PlayState } from "./PlaybackContext";
import type { MachineContext, UserEvent, Transition } from "./machine";
import { reduce } from "./machine";
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
  const [playState, setPlayStateReact] = useState<PlayState>("paused");

  const playbackPosition = useRef<number>(0);
  const playStateRef = useRef<PlayState>("paused");
  const lastTimeStamp = useRef<number>(0);
  const rafRef = useRef<number | undefined>(undefined);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ctxRef = useRef<MachineContext & { playbackSpeed: number }>({
    sampleRate,
    duration,
    loop,
    loopDelay,
    playbackSpeed,
  });
  useEffect(() => {
    ctxRef.current = { sampleRate, duration, loop, loopDelay, playbackSpeed };
  });

  const setPlayState = useCallback((s: PlayState) => {
    playStateRef.current = s;
    setPlayStateReact(s);
  }, []);

  const stopClock = useCallback(() => {
    if (rafRef.current !== undefined) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = undefined;
    }
  }, []);

  const cancelDelay = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const tickRef = useRef<() => void>(null!);

  const applyTransition = useCallback(
    (t: Transition) => {
      if (t.nextPositionMS !== undefined) {
        playbackPosition.current = t.nextPositionMS;
      }

      const prev = playStateRef.current;
      const next = t.nextState;
      setPlayState(next);

      if (next === "playing" && prev !== "playing") {
        lastTimeStamp.current = performance.now();
        rafRef.current = requestAnimationFrame(() => tickRef.current());
      } else if (next !== "playing" && prev === "playing") {
        stopClock();
      }

      if (next === "waiting") {
        const delay = ctxRef.current.loopDelay;
        timerRef.current = setTimeout(() => {
          timerRef.current = null;
          const { sampleRate, duration, loop, loopDelay } = ctxRef.current;
          applyTransition(
            reduce(
              playStateRef.current,
              { type: "delay-end" },
              {
                sampleRate,
                duration,
                loop,
                loopDelay,
              },
            ),
          );
        }, delay * 1000);
      }
    },
    [setPlayState, stopClock],
  );

  tickRef.current = () => {
    const now = performance.now();
    const { sampleRate, duration, loop, loopDelay, playbackSpeed } =
      ctxRef.current;
    const startMS = loop ? computeMS(sampleRate, loop.start) : 0;
    const endMS = loop ? computeMS(sampleRate, loop.end) : duration * 1000;

    const next =
      playbackPosition.current + (now - lastTimeStamp.current) * playbackSpeed;
    lastTimeStamp.current = now;

    if (next >= endMS) {
      applyTransition(
        reduce(
          playStateRef.current,
          { type: "reach-end" },
          {
            sampleRate,
            duration,
            loop,
            loopDelay,
          },
        ),
      );
      return;
    }

    playbackPosition.current = Math.max(startMS, next);
    rafRef.current = requestAnimationFrame(() => tickRef.current());
  };

  const dispatch = useCallback(
    (event: UserEvent) => {
      cancelDelay();
      const { sampleRate, duration, loop, loopDelay } = ctxRef.current;
      applyTransition(
        reduce(playStateRef.current, event, {
          sampleRate,
          duration,
          loop,
          loopDelay,
        }),
      );
    },
    [cancelDelay, applyTransition],
  );

  const reset = useCallback(() => {
    stopClock();
    cancelDelay();
    playbackPosition.current = 0;
    setPlayState("paused");
  }, [stopClock, cancelDelay, setPlayState]);

  useEffect(() => {
    return () => {
      stopClock();
      cancelDelay();
    };
  }, [stopClock, cancelDelay]);

  return { playState, playbackPosition, dispatch, reset };
}
