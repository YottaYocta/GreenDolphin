const DB_NAME = "greendolphin-v1";
const FILES_STORE = "files";
const META_STORE = "file-meta";

let _db: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 3);
    req.onupgradeneeded = (e) => {
      const db = req.result;
      if (e.oldVersion < 2 && db.objectStoreNames.contains(FILES_STORE)) {
        db.deleteObjectStore(FILES_STORE);
      }
      if (!db.objectStoreNames.contains(FILES_STORE)) {
        db.createObjectStore(FILES_STORE);
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE);
      }
    };
    req.onsuccess = () => {
      _db = req.result;
      resolve(req.result);
    };
    req.onerror = () => reject(req.error);
  });
}

export interface FileMeta {
  uploadedAt: number;
}

export async function saveToCache(file: File): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([FILES_STORE, META_STORE], "readwrite");
    tx.objectStore(FILES_STORE).put(file, file.name);
    tx.objectStore(META_STORE).put({ uploadedAt: Date.now() } satisfies FileMeta, file.name);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadAllFromCache(): Promise<File[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FILES_STORE, "readonly");
    const req = tx.objectStore(FILES_STORE).getAll();
    req.onsuccess = () => resolve(req.result ?? []);
    req.onerror = () => reject(req.error);
  });
}

export async function loadMetaFromCache(): Promise<Map<string, FileMeta>> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE, "readonly");
    const keysReq = tx.objectStore(META_STORE).getAllKeys();
    const valsReq = tx.objectStore(META_STORE).getAll();
    tx.oncomplete = () => {
      const map = new Map<string, FileMeta>();
      (keysReq.result as string[]).forEach((k, i) => map.set(k, valsReq.result[i]));
      resolve(map);
    };
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteFromCache(filename: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([FILES_STORE, META_STORE], "readwrite");
    tx.objectStore(FILES_STORE).delete(filename);
    tx.objectStore(META_STORE).delete(filename);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
