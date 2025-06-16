import { createContext } from "react";
import type { RefObject } from "react";
import type { Section } from "./lib/waveform";

export type PlayState = "playing" | "paused" | "frozen";

export interface PlaybackContextType {
  playbackPosition: RefObject<number>;
  playState: PlayState;
  start: () => void;
  pause: () => void;
  freeze: () => void;
  setPosition: (position: number) => void;
  looping: boolean;
  setLooping: (looping: boolean) => void;
  loop: Section | undefined;
  setLoop: (section: Section) => void;
}

export const PlaybackContext = createContext<PlaybackContextType | undefined>(
  undefined
);
