import { createContext, useContext } from "react";
import type { Recording } from "../audio";
import type { StoredRecording } from "../persistence";

export type Opened = { name: string } & ({ kind: "audio"; size: number; recording: Recording } | { kind: "youtube"; videoId: string });

export interface LibraryApi {
  recordings: StoredRecording[];
  opened: Opened | null;
  error: string | null;
  open: (name: string) => void;
  add: (file: File) => Promise<void>;
  addYouTube: (link: string) => Promise<void>;
  remove: (name: string) => Promise<void>;
  home: () => void;
}

export const LibraryContext = createContext<LibraryApi | null>(null);
export const useLibrary = () => useContext(LibraryContext)!;
