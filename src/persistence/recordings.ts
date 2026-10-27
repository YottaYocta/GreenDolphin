import type { Persistence, RecordingSource, StoredRecording } from "./interfaces";
import { removeRecordingPrefs, setFlag } from "./prefs";

const RECORDINGS = "recordings";
const AUDIO = "audio";
const LEGACY = "greendolphin-v1";
const LEGACY_YOUTUBE = "application/x-greendolphin-youtube";
let db: Promise<IDBDatabase> | null = null;

const open = () =>
  (db ??= new Promise((resolve, reject) => {
    const req = indexedDB.open("greendolphin", 1);
    req.onupgradeneeded = () => {
      for (const name of [...req.result.objectStoreNames]) req.result.deleteObjectStore(name);
      req.result.createObjectStore(RECORDINGS, { keyPath: "id" });
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

const settle = <T>(req: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const record = (title: string, source: RecordingSource, addedAt = Date.now()): StoredRecording => ({ id: crypto.randomUUID(), title, addedAt, source });

const save = (entries: { recording: StoredRecording; audio?: Blob }[]) =>
  transact<void>([RECORDINGS, AUDIO], "readwrite", (tx) => {
    for (const { recording, audio } of entries) {
      tx.objectStore(RECORDINGS).add(recording);
      if (audio) tx.objectStore(AUDIO).add(audio, recording.id);
    }
  });

async function add(title: string, source: RecordingSource, audio?: Blob) {
  const recording = record(title, source);
  await save([{ recording, audio }]);
  return recording;
}

async function importLegacy() {
  if (!(await indexedDB.databases()).some((d) => d.name === LEGACY)) return;
  const legacy = await settle(indexedDB.open(LEGACY));
  if (legacy.objectStoreNames.contains("files") && legacy.objectStoreNames.contains("file-meta")) {
    const tx = legacy.transaction(["files", "file-meta"], "readonly");
    const [files, metaNames, meta] = await Promise.all([
      settle<File[]>(tx.objectStore("files").getAll()),
      settle(tx.objectStore("file-meta").getAllKeys()),
      settle<{ uploadedAt: number }[]>(tx.objectStore("file-meta").getAll()),
    ]);
    const addedAt = new Map(metaNames.map((name, i) => [name, meta[i].uploadedAt]));
    const entries = await Promise.all(
      files.map(async (file) => {
        if (file.type !== LEGACY_YOUTUBE && !file.name.endsWith(".yt")) return { recording: record(file.name, { kind: "file", size: file.size }, addedAt.get(file.name)), audio: file };
        const { title, videoId } = JSON.parse(await file.text()) as { title: string; videoId: string };
        return { recording: record(title, { kind: "youtube", videoId }, addedAt.get(file.name)) };
      }),
    );
    await save(entries);
  }
  legacy.close();
  setFlag("demo", true);
  await settle(indexedDB.deleteDatabase(LEGACY));
}

let imported: Promise<void> | null = null;

export const listRecordings: Persistence["listRecordings"] = async () => {
  await (imported ??= importLegacy().catch(console.error));
  return (await transact<StoredRecording[]>([RECORDINGS], "readonly", (tx) => tx.objectStore(RECORDINGS).getAll())).sort((a, b) => b.addedAt - a.addedAt);
};

export const addAudio: Persistence["addAudio"] = (title, data) => add(title, { kind: "file", size: data.byteLength }, new Blob([data]));

export const addYouTube: Persistence["addYouTube"] = (title, videoId) => add(title, { kind: "youtube", videoId });

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
