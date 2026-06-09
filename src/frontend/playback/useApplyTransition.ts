import { useCallback } from "react";
import type { RefObject } from "react";
import type { Section } from "../lib/waveform";
import type { PlayState } from "./PlaybackContext";
import type { Transition } from "./machine";

export interface UseApplyTransitionProps {
  playState: PlayState;
  sampleRate: number;
  duration: number;
  loop: Section | undefined;
  loopDelay: number;
  playbackPosition: RefObject<number>;
  startPlaying: (onEnd: () => void) => void;
  stopPlaying: () => void;
  startTimer: (onDelayEnd: () => void) => void;
  cancelTimer: () => void;
  setPlayState: (s: PlayState) => void;
  onEnd: () => void;
  onDelayEnd: () => void;
}

export function useApplyTransition({
  playState,
  playbackPosition,
  startPlaying,
  stopPlaying,
  startTimer,
  cancelTimer,
  setPlayState,
  onEnd,
  onDelayEnd,
}: UseApplyTransitionProps): (t: Transition) => void {
  return useCallback(
    (t: Transition) => {
      if (t.nextPositionMS !== undefined) {
        playbackPosition.current = t.nextPositionMS;
      }

      const prev = playState;
      const next = t.nextState;
      setPlayState(next);

      switch (prev) {
        case "playing":
          stopPlaying();
          switch (next) {
            case "playing":
              startPlaying(onEnd);
              break;
            case "paused":
            case "frozen":
              break;
            case "waiting":
              startTimer(onDelayEnd);
              break;
          }
          break;

        case "paused":
        case "frozen":
          switch (next) {
            case "playing":
              startPlaying(onEnd);
              break;
            case "paused":
            case "frozen":
              break;
            case "waiting":
              startTimer(onDelayEnd);
              break;
          }
          break;

        case "waiting":
          cancelTimer();
          switch (next) {
            case "playing":
              startPlaying(onEnd);
              break;
            case "paused":
            case "frozen":
              break;
            case "waiting":
              startTimer(onDelayEnd);
              break;
          }
          break;
      }
    },
    [
      playState,
      playbackPosition,
      startPlaying,
      stopPlaying,
      startTimer,
      cancelTimer,
      setPlayState,
      onEnd,
      onDelayEnd,
    ],
  );
}
