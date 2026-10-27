import type { LinearGain, Semitones } from "../audio";
import type { DurationSeconds, LoopMode, RecordingSeconds, Section, SpeedRatio } from "../core";

export type EpochMilliseconds = number;

export interface RecordingPrefs {
  speed: SpeedRatio;
  pitch: Semitones;
  gain: LinearGain;
  loop: Section | null;
  view: Section | null;
  position: RecordingSeconds;
}

export interface LoopPrefs {
  mode: "manual" | "automatic";
  delayMode: "fixed" | "relative";
  delayValue: number;
}

export type Flag = "demo" | "tutorial";

export interface StoredRecording {
  file: File;
  addedAt: EpochMilliseconds;
}

export interface Persistence {
  recordingPrefs(name: string): RecordingPrefs;
  saveRecordingPrefs(name: string, patch: Partial<RecordingPrefs>): void;
  removeRecordingPrefs(name: string): void;
  loopPrefs(): LoopPrefs;
  saveLoopPrefs(patch: Partial<LoopPrefs>): void;
  toLoopMode(prefs: LoopPrefs, loopLength: DurationSeconds): LoopMode;
  flag(key: Flag): boolean;
  setFlag(key: Flag, on: boolean): void;
  lastOpened(): string | null;
  setLastOpened(name: string | null): void;
  listRecordings(): Promise<StoredRecording[]>;
  putRecording(file: File): Promise<void>;
  deleteRecording(name: string): Promise<void>;
}
