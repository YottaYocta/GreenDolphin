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
  type FileMeta,
} from "./lib/audioCache";

type RecordingsStoreValue = {
  cachedFiles: File[];
  fileMeta: Map<string, FileMeta>;
  reload: () => Promise<void>;
  deleteFile: (filename: string) => Promise<void>;
};

export const RecordingsStore = createContext<RecordingsStoreValue>({
  cachedFiles: [],
  fileMeta: new Map(),
  reload: async () => {},
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
    <RecordingsStore.Provider value={{ cachedFiles, fileMeta, reload, deleteFile }}>
      {children}
    </RecordingsStore.Provider>
  );
}
