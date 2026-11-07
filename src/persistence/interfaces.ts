import type { LinearGain, Semitones } from "../audio";
import type { DurationSeconds, LoopMode, RecordingSeconds, Section, SpeedRatio } from "../core";

export type EpochMilliseconds = number;
export type RecordingId = string;
export type MidiPitch = number;

export interface Note {
  pitch: MidiPitch;
  start: RecordingSeconds;
  length: DurationSeconds;
}

export interface RecordingPrefs {
  speed: SpeedRatio;
  pitch: Semitones;
  gain: LinearGain;
  loop: Section | null;
  view: Section | null;
  position: RecordingSeconds;
  playNotes: boolean;
  pitchTop: number | null;
}

export interface LoopPrefs {
  mode: "manual" | "automatic";
  delayMode: "fixed" | "relative";
  delayValue: number;
}

export type Flag = "demo" | "tutorial" | "allowSleep" | "piano";

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
  readNotes(id: RecordingId): Promise<Note[]>;
  saveNotes(id: RecordingId, notes: Note[]): Promise<void>;
}
