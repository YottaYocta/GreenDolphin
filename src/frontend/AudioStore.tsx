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
};

export const AudioStore = createContext<AudioStoreValue>({
  audio: null,
  setAudio: () => {},
});

export function AudioStoreProvider({ children }: { children: ReactNode }) {
  const [audio, setAudio] = useState<AudioState>(null);
  return (
    <AudioStore.Provider value={{ audio, setAudio }}>
      {children}
    </AudioStore.Provider>
  );
}
