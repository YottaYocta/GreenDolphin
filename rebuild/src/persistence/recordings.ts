import type { Persistence, StoredRecording } from "./interfaces";

const STORE = "recordings";
let db: Promise<IDBDatabase> | null = null;

const open = () =>
  (db ??= new Promise((resolve, reject) => {
    const req = indexedDB.open("greendolphin-rebuild", 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));

async function run<T>(mode: IDBTransactionMode, op: (store: IDBObjectStore) => IDBRequest<T>) {
  const store = (await open()).transaction(STORE, mode).objectStore(STORE);
  return new Promise<T>((resolve, reject) => {
    const req = op(store);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const listRecordings: Persistence["listRecordings"] = async () =>
  (await run<StoredRecording[]>("readonly", (s) => s.getAll())).sort((a, b) => b.addedAt - a.addedAt);

export const putRecording: Persistence["putRecording"] = async (file) => {
  await run("readwrite", (s) => s.put({ file, addedAt: Date.now() } satisfies StoredRecording, file.name));
};

export const deleteRecording: Persistence["deleteRecording"] = (name) => run("readwrite", (s) => s.delete(name));
