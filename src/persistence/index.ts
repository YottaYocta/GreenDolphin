import type { Persistence } from "./interfaces";
import { flag, lastOpened, loopPrefs, recordingPrefs, saveLoopPrefs, saveRecordingPrefs, setFlag, setLastOpened, toLoopMode } from "./prefs";
import { addAudio, addYouTube, deleteRecording, listRecordings, readAudio } from "./recordings";

export type * from "./interfaces";

export const persistence: Persistence = {
  recordingPrefs,
  saveRecordingPrefs,
  loopPrefs,
  saveLoopPrefs,
  toLoopMode,
  flag,
  setFlag,
  lastOpened,
  setLastOpened,
  listRecordings,
  addAudio,
  addYouTube,
  readAudio,
  deleteRecording,
};
