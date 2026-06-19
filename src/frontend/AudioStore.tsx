import { createContext, useState, type ReactNode } from "react";

type AudioState = {
  audioCtx: AudioContext;
  buffer: AudioBuffer;
  filename: string;
  fileSize: number;
} | null;

type AudioStoreValue = {
  audio: AudioState;
  setAudio: (a: AudioState) => void;
  isLoading: boolean;
  setIsLoading: (v: boolean) => void;
};

export const AudioStore = createContext<AudioStoreValue>({
  audio: null,
  setAudio: () => {},
  isLoading: false,
  setIsLoading: () => {},
});

export function AudioStoreProvider({ children }: { children: ReactNode }) {
  const [audio, setAudio] = useState<AudioState>(null);
  const [isLoading, setIsLoading] = useState(false);
  return (
    <AudioStore.Provider value={{ audio, setAudio, isLoading, setIsLoading }}>
      {children}
    </AudioStore.Provider>
  );
}
