import { createContext, useContext } from "react";
import type { Recording } from "../audio";
import type { RecordingId, StoredRecording } from "../persistence";

export type Opened = { recording: StoredRecording } & ({ kind: "audio"; size: number; decoded: Recording } | { kind: "youtube"; videoId: string });

export interface LibraryApi {
  recordings: StoredRecording[];
  opened: Opened | null;
  error: string | null;
  open: (id: RecordingId) => void;
  add: (file: File) => Promise<void>;
  addYouTube: (link: string) => Promise<void>;
  remove: (id: RecordingId) => Promise<void>;
  home: () => void;
}

export const LibraryContext = createContext<LibraryApi | null>(null);
export const useLibrary = () => useContext(LibraryContext)!;
