import { createContext } from "react";
import type { RefObject } from "react";

export type PlayState = "playing" | "paused" | "frozen";

export interface PlaybackContextType {
  playbackPosition: RefObject<number>;
  playState: PlayState;
  start: () => void;
  pause: () => void;
  freeze: () => void;
  setPosition: (position: number) => void;
}

export const PlaybackContext = createContext<PlaybackContextType | undefined>(
  undefined
);
