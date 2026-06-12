import {
  createContext,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  deleteFromCache,
  loadAllFromCache,
  loadMetaFromCache,
  saveToCache,
  type FileMeta,
} from "./lib/audioCache";

type RecordingsStoreValue = {
  cachedFiles: File[];
  fileMeta: Map<string, FileMeta>;
  reload: () => Promise<void>;
  cacheFile: (file: File) => Promise<void>;
  deleteFile: (filename: string) => Promise<void>;
};

export const RecordingsStore = createContext<RecordingsStoreValue>({
  cachedFiles: [],
  fileMeta: new Map(),
  reload: async () => {},
  cacheFile: async () => {},
  deleteFile: async () => {},
});

export function RecordingsStoreProvider({ children }: { children: ReactNode }) {
  const [cachedFiles, setCachedFiles] = useState<File[]>([]);
  const [fileMeta, setFileMeta] = useState<Map<string, FileMeta>>(new Map());

  const reload = useCallback(async () => {
    const [files, meta] = await Promise.all([
      loadAllFromCache(),
      loadMetaFromCache(),
    ]);
    setCachedFiles(files);
    setFileMeta(meta);
  }, []);

  useEffect(() => {
    reload().catch(() => {});
  }, [reload]);

  const cacheFile = useCallback(async (file: File) => {
    await saveToCache(file);
    const uploadedAt = Date.now();
    setCachedFiles((prev) => {
      const without = prev.filter((f) => f.name !== file.name);
      return [...without, file];
    });
    setFileMeta((prev) => {
      const next = new Map(prev);
      next.set(file.name, { uploadedAt });
      return next;
    });
  }, []);

  const deleteFile = useCallback(async (filename: string) => {
    await deleteFromCache(filename).catch(() => {});
    setCachedFiles((prev) => prev.filter((f) => f.name !== filename));
    setFileMeta((prev) => {
      const next = new Map(prev);
      next.delete(filename);
      return next;
    });
  }, []);

  return (
    <RecordingsStore.Provider value={{ cachedFiles, fileMeta, reload, cacheFile, deleteFile }}>
      {children}
    </RecordingsStore.Provider>
  );
}
