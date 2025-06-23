import { createContext } from "react";
import type { RefObject } from "react";
import type { Section } from "./lib/waveform";
import type { FrequencyData } from "./lib/frequency";

export type PlayState = "playing" | "paused" | "frozen";

export interface PlaybackContextType {
  playbackPosition: RefObject<number>;
  playState: PlayState;
  setPlayState: (state: PlayState) => void;
  setPosition: (position: number) => void;
  looping: boolean;
  setLooping: (looping: boolean) => void;
  loop: Section | undefined;
  setLoop: (section: Section | undefined) => void;
  frequencyData: RefObject<FrequencyData | undefined>;
  pitchShift: number;
  setPitchShift: (newPitchShift: number) => void;
  playbackSpeed: number;
  setPlaybackSpeed: (newPlaybackSpeed: number) => void;
}

export const PlaybackContext = createContext<PlaybackContextType | undefined>(
  undefined
);
