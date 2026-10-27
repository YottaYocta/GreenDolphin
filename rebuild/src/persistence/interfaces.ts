import type { LinearGain, Semitones } from "../audio";
import type { DurationSeconds, LoopMode, RecordingSeconds, Section, SpeedRatio } from "../core";

export type EpochMilliseconds = number;
export type RecordingId = string;

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

export type RecordingSource = { kind: "file"; size: number } | { kind: "youtube"; videoId: string };

export interface StoredRecording {
  id: RecordingId;
  title: string;
  addedAt: EpochMilliseconds;
  source: RecordingSource;
}

export interface Persistence {
  recordingPrefs(id: RecordingId): RecordingPrefs;
  saveRecordingPrefs(id: RecordingId, patch: Partial<RecordingPrefs>): void;
  loopPrefs(): LoopPrefs;
  saveLoopPrefs(patch: Partial<LoopPrefs>): void;
  toLoopMode(prefs: LoopPrefs, loopLength: DurationSeconds): LoopMode;
  flag(key: Flag): boolean;
  setFlag(key: Flag, on: boolean): void;
  lastOpened(): RecordingId | null;
  setLastOpened(id: RecordingId | null): void;
  listRecordings(): Promise<StoredRecording[]>;
  addAudio(title: string, data: ArrayBuffer): Promise<StoredRecording>;
  addYouTube(title: string, videoId: string): Promise<StoredRecording>;
  readAudio(id: RecordingId): Promise<ArrayBuffer>;
  deleteRecording(id: RecordingId): Promise<void>;
}
