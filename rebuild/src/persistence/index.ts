import type { Persistence } from "./interfaces";
import { flag, lastOpened, loopPrefs, recordingPrefs, removeRecordingPrefs, saveLoopPrefs, saveRecordingPrefs, setFlag, setLastOpened, toLoopMode } from "./prefs";
import { deleteRecording, listRecordings, putRecording } from "./recordings";

export type * from "./interfaces";

export const persistence: Persistence = {
  recordingPrefs,
  saveRecordingPrefs,
  removeRecordingPrefs,
  loopPrefs,
  saveLoopPrefs,
  toLoopMode,
  flag,
  setFlag,
  lastOpened,
  setLastOpened,
  listRecordings,
  putRecording,
  deleteRecording,
};
