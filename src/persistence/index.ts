import type { Persistence } from "./interfaces";
import { editorSettings, flag, lastOpened, loopPrefs, recordingPrefs, saveEditorSettings, saveLoopPrefs, saveRecordingPrefs, setFlag, setLastOpened, toLoopMode } from "./prefs";
import { addAudio, addDemos, addYouTube, deleteRecording, listRecordings, readAudio } from "./recordings";

export type * from "./interfaces";

export const persistence: Persistence = {
  recordingPrefs,
  saveRecordingPrefs,
  loopPrefs,
  saveLoopPrefs,
  toLoopMode,
  editorSettings,
  saveEditorSettings,
  flag,
  setFlag,
  lastOpened,
  setLastOpened,
  listRecordings,
  addAudio,
  addYouTube,
  addDemos,
  readAudio,
  deleteRecording,
};
