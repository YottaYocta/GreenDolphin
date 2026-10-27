import { createContext, useContext } from "react";
import type { StoredRecording } from "../persistence";
import type { YouTubeSource } from "../youtube";

export type Opened = { name: string; size: number } & ({ kind: "audio"; buffer: AudioBuffer } | { kind: "youtube"; source: YouTubeSource });

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
