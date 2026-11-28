import type { Persistence } from "./interfaces";
import { editorSettings, flag, loopPrefs, recordingPrefs, reopenOnLaunch, saveEditorSettings, saveLoopPrefs, saveRecordingPrefs, setFlag, setReopenOnLaunch } from "./prefs";
import { addAudio, addYouTube, deleteRecording, listRecordings, readAudio } from "./recordings";

export type * from "./interfaces";

export const persistence: Persistence = {
  recordingPrefs,
  saveRecordingPrefs,
  loopPrefs,
  saveLoopPrefs,
  editorSettings,
  saveEditorSettings,
  flag,
  setFlag,
  reopenOnLaunch,
  setReopenOnLaunch,
  listRecordings,
  addAudio,
  addYouTube,
  readAudio,
  deleteRecording,
};
