import type { DurationSeconds, Output, RecordingSeconds } from "../core";

export type Semitones = number;
export type LinearGain = number;
export type Hertz = number;

export type FFT = (real: Float64Array, imaginary: Float64Array, inverse?: boolean) => void;

export interface FreezeVocoder {
  readonly hop: number;
  frame(channel: Float32Array, atSample: number, firstSample?: number): Float32Array;
}

export type CreateFreezeVocoder = (windowSize: number, spreadSamples: number) => FreezeVocoder;

export type FreezeMessage =
  | { type: "seek"; position: RecordingSeconds; jump: boolean; window?: { channels: Float32Array[]; firstSample: number } }
  | { type: "idle" }
  | { type: "unload" };

export interface Recording {
  readonly duration: DurationSeconds;
  readonly sampleRate: Hertz;
  readonly channelCount: number;
  readonly length: number;
  readChannel(into: Float32Array, channel: number, fromSample?: number): void;
}

export interface Spectrum {
  readonly binHz: Hertz;
  read(): Float32Array;
  close(): void;
}

export interface Tones {
  playTone(frequency: Hertz | null): void;
  openSpectrum?(): Spectrum;
}

export interface AudioEngine extends Output, Tones {
  openSpectrum(): Spectrum;
  setPitch(semitones: Semitones): void;
  setVolume(gain: LinearGain): void;
  dispose(): void;
}

export interface Audio {
  decode(data: ArrayBuffer): Promise<Recording>;
  release(recording: Recording): void;
  createEngine(recording: Recording): Promise<AudioEngine>;
  tones: Tones;
}
