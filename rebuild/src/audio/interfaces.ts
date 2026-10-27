import type { Output, PlaybackMode, RecordingSeconds } from "../core";

export type Semitones = number;
export type LinearGain = number;
export type Hertz = number;

export type FFT = (real: Float64Array, imaginary: Float64Array, inverse?: boolean) => void;

export interface FreezeVocoder {
  readonly hop: number;
  frame(channel: Float32Array, atSample: number): Float32Array;
}

export type FreezeMessage =
  | { type: "load"; channels: Float32Array[] }
  | { type: "seek"; position: RecordingSeconds; jump: boolean }
  | { type: "active"; active: boolean };

export interface AudioEngine extends Output {
  readonly ctx: AudioContext;
  readonly analyser: AnalyserNode;
  readonly mode: PlaybackMode;
  setPitch(semitones: Semitones): void;
  setVolume(gain: LinearGain): void;
  playTone(frequency: Hertz | null): void;
  dispose(): void;
}

export interface Audio {
  createEngine(ctx: AudioContext, buffer: AudioBuffer): Promise<AudioEngine>;
  createFreezeVocoder(windowSize: number, spreadHops: number): FreezeVocoder;
}
