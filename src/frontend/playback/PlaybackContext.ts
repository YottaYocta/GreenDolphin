import { createContext } from "react";
import type { RefObject } from "react";
import type { Section } from "../lib/waveform";
import type { FrequencyData } from "../lib/frequency";

export type PlayState = "playing" | "paused" | "frozen" | "waiting";

export interface PlaybackSettings {
  pitchShift: number;
  playbackSpeed: number;
  gain: number;
  loopDelay: number;
  loop: Section | undefined;
}

export type PlaybackAction =
  | "play"
  | "pause"
  | "freeze"
  | { type: "move"; position: number };

export interface PlaybackContextType {
  playbackPosition: RefObject<number>;
  loopPosition: RefObject<number>;
  loopLength: number;
  playState: PlayState;
  playbackSettings: PlaybackSettings;
  setAudioSettings: (settings: Partial<PlaybackSettings>) => void;
  triggerAction: (action: PlaybackAction) => void;
  frequencyData: RefObject<FrequencyData | undefined>;
  audioContext: AudioContext | null;
  analyserNode: AnalyserNode | null;
}

export const PlaybackContext = createContext<PlaybackContextType | undefined>(
  undefined,
);
