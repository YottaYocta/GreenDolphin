import { createContext } from "react";
import type { RefObject } from "react";
import type { Section } from "../lib/waveform";
import type { FrequencyData } from "../lib/frequency";

export type PlayState = "playing" | "paused" | "frozen" | "waiting";

export type LoopOptions =
  | { type: "automatic"; loopDelay: number }
  | { type: "manual" };

export function effectiveLoopDelay(loopOptions: LoopOptions): number {
  return loopOptions.type === "automatic" ? loopOptions.loopDelay : 0;
}

export interface PlaybackSettings {
  pitchShift: number;
  playbackSpeed: number;
  gain: number;
  loopOptions: LoopOptions;
  loop: Section | undefined;
}

export type PlaybackAction =
  | "play"
  | "pause"
  | "freeze"
  | { type: "move"; position: number };

interface PlaybackContextType {
  playbackPosition: RefObject<number>;
  loopPosition: RefObject<number>;
  loopLength: number;
  playState: PlayState;
  lastStartPosition: number;
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
