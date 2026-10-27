import type { Persistence, StoredRecording } from "./interfaces";

const RECORDINGS = "recordings";
const AUDIO = "audio";
let db: Promise<IDBDatabase> | null = null;

const open = () =>
  (db ??= new Promise((resolve, reject) => {
    const req = indexedDB.open("greendolphin-rebuild", 2);
    req.onupgradeneeded = () => {
      for (const name of [...req.result.objectStoreNames]) req.result.deleteObjectStore(name);
      req.result.createObjectStore(RECORDINGS, { keyPath: "name" });
      req.result.createObjectStore(AUDIO);
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

const add = (recording: StoredRecording, audio?: Blob) =>
  transact<void>([RECORDINGS, AUDIO], "readwrite", (tx) => {
    tx.objectStore(RECORDINGS).put(recording);
    if (audio) tx.objectStore(AUDIO).put(audio, recording.name);
    else tx.objectStore(AUDIO).delete(recording.name);
  });

export const listRecordings: Persistence["listRecordings"] = async () =>
  (await transact<StoredRecording[]>([RECORDINGS], "readonly", (tx) => tx.objectStore(RECORDINGS).getAll())).sort(
    (a, b) => b.addedAt - a.addedAt,
  );

export const addAudio: Persistence["addAudio"] = (name, data) =>
  add({ name, addedAt: Date.now(), source: { kind: "file", size: data.byteLength } }, new Blob([data]));

export const addYouTube: Persistence["addYouTube"] = (name, videoId) =>
  add({ name, addedAt: Date.now(), source: { kind: "youtube", videoId } });

export const readAudio: Persistence["readAudio"] = async (name) => {
  const blob = await transact<Blob | undefined>([AUDIO], "readonly", (tx) => tx.objectStore(AUDIO).get(name));
  if (!blob) throw new Error(`No audio stored for "${name}"`);
  return blob.arrayBuffer();
};

export const deleteRecording: Persistence["deleteRecording"] = (name) =>
  transact<void>([RECORDINGS, AUDIO], "readwrite", (tx) => {
    tx.objectStore(RECORDINGS).delete(name);
    tx.objectStore(AUDIO).delete(name);
  });
