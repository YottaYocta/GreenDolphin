import { useCallback } from "react";
import type { RefObject } from "react";
import type { PlayState } from "./PlaybackContext";
import type { Transition } from "./machine";

export interface UseApplyTransitionProps {
  playState: PlayState;
  playbackPosition: RefObject<number>;
  startPlaying: () => void;
  stopPlaying: () => void;
  startTimer: () => void;
  cancelTimer: () => void;
}

export function useApplyTransition({
  playState,
  playbackPosition,
  startPlaying,
  stopPlaying,
  startTimer,
  cancelTimer,
}: UseApplyTransitionProps): (t: Transition) => void {
  return useCallback(
    (t: Transition) => {
      if (t.nextPositionMS !== undefined) {
        playbackPosition.current = t.nextPositionMS;
      }

      const prev = playState;
      const next = t.nextState;

      switch (prev) {
        case "playing":
          stopPlaying();
          switch (next) {
            case "playing":
              startPlaying();
              break;
            case "paused":
            case "frozen":
              break;
            case "waiting":
              startTimer();
              break;
          }
          break;

        case "paused":
        case "frozen":
          switch (next) {
            case "playing":
              startPlaying();
              break;
            case "paused":
            case "frozen":
              break;
            case "waiting":
              startTimer();
              break;
          }
          break;

        case "waiting":
          cancelTimer();
          switch (next) {
            case "playing":
              startPlaying();
              break;
            case "paused":
            case "frozen":
              break;
            case "waiting":
              startTimer();
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
    ],
  );
}
