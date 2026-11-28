import type { LinearGain, Semitones } from "../audio";
import type { RecordingSeconds, Section, SpeedRatio } from "../core";

export type EpochMilliseconds = number;
export type RecordingId = string;

export interface RecordingPrefs {
  speed: SpeedRatio;
  pitch: Semitones;
  gain: LinearGain;
  loop: Section | null;
  view: Section | null;
  position: RecordingSeconds;
  openedAt: EpochMilliseconds | null;
}

export interface LoopPrefs {
  mode: "manual" | "automatic";
  delayMode: "fixed" | "relative";
  delayValue: number;
}

export interface EditorSettings {
  piano: boolean;
  inlineSound: boolean;
  playheadTime: boolean;
  awake: boolean;
  replay: boolean;
}

export type Flag = "demo" | "tutorial" | "sortByAdded";

export type RecordingSource = { kind: "file"; size: number } | { kind: "youtube"; videoId: string };

export interface StoredRecording {
  id: RecordingId;
  title: string;
  addedAt: EpochMilliseconds;
  source: RecordingSource;
}

export interface Preferences {
  recordingPrefs(id: RecordingId): RecordingPrefs;
  saveRecordingPrefs(id: RecordingId, patch: Partial<RecordingPrefs>): void;
  loopPrefs(): LoopPrefs;
  saveLoopPrefs(patch: Partial<LoopPrefs>): void;
  editorSettings(): EditorSettings;
  saveEditorSettings(patch: Partial<EditorSettings>): void;
  flag(key: Flag): boolean;
  setFlag(key: Flag, on: boolean): void;
  reopenOnLaunch(): RecordingId | null;
  setReopenOnLaunch(id: RecordingId | null): void;
}

export interface RecordingStore {
  listRecordings(): Promise<StoredRecording[]>;
  addAudio(title: string, data: ArrayBuffer): Promise<StoredRecording>;
  addYouTube(title: string, videoId: string): Promise<StoredRecording>;
  readAudio(id: RecordingId): Promise<ArrayBuffer>;
  deleteRecording(id: RecordingId): Promise<void>;
}

export type Persistence = Preferences & RecordingStore;
