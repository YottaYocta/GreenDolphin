import { createContext, useState, type ReactNode } from "react";

export type AudioState = {
  audioCtx: AudioContext;
  buffer: AudioBuffer;
  filename: string;
  fileSize: number;
} | null;

type AudioStoreValue = {
  audio: AudioState;
  setAudio: (a: AudioState) => void;
  isCached: boolean;
  setIsCached: (v: boolean) => void;
};

export const AudioStore = createContext<AudioStoreValue>({
  audio: null,
  setAudio: () => {},
  isCached: false,
  setIsCached: () => {},
});

export function AudioStoreProvider({ children }: { children: ReactNode }) {
  const [audio, setAudio] = useState<AudioState>(null);
  const [isCached, setIsCached] = useState(false);
  return (
    <AudioStore.Provider value={{ audio, setAudio, isCached, setIsCached }}>
      {children}
    </AudioStore.Provider>
  );
}
