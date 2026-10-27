import type { DurationSeconds, Output, RecordingSeconds } from "../core";

export type Semitones = number;
export type LinearGain = number;
export type Hertz = number;

export type FFT = (real: Float64Array, imaginary: Float64Array, inverse?: boolean) => void;

export interface FreezeVocoder {
  readonly hop: number;
  frame(channel: Float32Array, atSample: number): Float32Array;
}

export type CreateFreezeVocoder = (windowSize: number, spreadSamples: number) => FreezeVocoder;

export type FreezeMessage =
  | { type: "load"; channels: Float32Array[] }
  | { type: "seek"; position: RecordingSeconds; jump: boolean }
  | { type: "active"; active: boolean };

export interface Recording {
  readonly duration: DurationSeconds;
  readonly sampleRate: Hertz;
  readonly channelCount: number;
  readonly length: number;
  readChannel(into: Float32Array, channel: number, fromSample?: number): void;
}

export interface AudioEngine extends Output {
  readonly spectrumBinHz: Hertz;
  readSpectrum(): Float32Array;
  setPitch(semitones: Semitones): void;
  setVolume(gain: LinearGain): void;
  playTone(frequency: Hertz | null): void;
  dispose(): void;
}

export interface Audio {
  decode(data: ArrayBuffer): Promise<Recording>;
  createEngine(recording: Recording): Promise<AudioEngine>;
}
