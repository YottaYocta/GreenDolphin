import type { Persistence, RecordingId, RecordingSource, StoredRecording } from "./interfaces";
import { removeRecordingPrefs } from "./prefs";

const RECORDINGS = "recordings";
const AUDIO = "audio";
let db: Promise<IDBDatabase> | null = null;

const open = () =>
  (db ??= new Promise((resolve, reject) => {
    const req = indexedDB.open("greendolphin", 3);
    req.onupgradeneeded = () => {
      const { result } = req;
      if (!result.objectStoreNames.contains(RECORDINGS)) result.createObjectStore(RECORDINGS, { keyPath: "id" });
      if (!result.objectStoreNames.contains(AUDIO)) result.createObjectStore(AUDIO);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));

async function transact<T>(stores: string[], mode: IDBTransactionMode, work: (tx: IDBTransaction) => IDBRequest<T> | void) {
  const tx = (await open()).transaction(stores, mode);
  const request = work(tx);
  return new Promise<T>((resolve, reject) => {
    tx.oncomplete = () => resolve(request ? request.result : (undefined as T));
    tx.onerror = () => reject(tx.error);
  });
}

async function add(title: string, source: RecordingSource, audio?: Blob, id: RecordingId = crypto.randomUUID()) {
  const recording: StoredRecording = { id, title, addedAt: Date.now(), source };
  await transact<void>([RECORDINGS, AUDIO], "readwrite", (tx) => {
    tx.objectStore(RECORDINGS).put(recording);
    if (audio) tx.objectStore(AUDIO).put(audio, id);
  });
  return recording;
}

export const listRecordings: Persistence["listRecordings"] = async () =>
  (await transact<StoredRecording[]>([RECORDINGS], "readonly", (tx) => tx.objectStore(RECORDINGS).getAll())).sort((a, b) => b.addedAt - a.addedAt);

export const addAudio: Persistence["addAudio"] = (title, data, id) => add(title, { kind: "file", size: data.byteLength }, new Blob([data]), id);

export const addYouTube: Persistence["addYouTube"] = (title, videoId, id) => add(title, { kind: "youtube", videoId }, undefined, id);

export const readAudio: Persistence["readAudio"] = async (id) => {
  const blob = await transact<Blob | undefined>([AUDIO], "readonly", (tx) => tx.objectStore(AUDIO).get(id));
  if (!blob) throw new Error(`No audio stored for "${id}"`);
  return blob.arrayBuffer();
};

export const deleteRecording: Persistence["deleteRecording"] = async (id) => {
  await transact<void>([RECORDINGS, AUDIO], "readwrite", (tx) => {
    tx.objectStore(RECORDINGS).delete(id);
    tx.objectStore(AUDIO).delete(id);
  });
  removeRecordingPrefs(id);
};
