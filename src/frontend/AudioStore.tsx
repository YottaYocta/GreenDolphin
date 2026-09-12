import { createContext, useCallback, useState, type ReactNode } from "react";

type AudioState = {
  audioCtx: AudioContext;
  buffer: AudioBuffer;
  filename: string;
  fileSize: number;
} | null;

type VideoState = {
  videoId: string;
  filename: string;
} | null;

type AudioStoreValue = {
  audio: AudioState;
  setAudio: (a: AudioState) => void;
  video: VideoState;
  setVideo: (v: VideoState) => void;
  isLoading: boolean;
  setIsLoading: (v: boolean) => void;
};

export const AudioStore = createContext<AudioStoreValue>({
  audio: null,
  setAudio: () => {},
  video: null,
  setVideo: () => {},
  isLoading: false,
  setIsLoading: () => {},
});

export function AudioStoreProvider({ children }: { children: ReactNode }) {
  const [audio, setAudioState] = useState<AudioState>(null);
  const [video, setVideoState] = useState<VideoState>(null);
  const [isLoading, setIsLoading] = useState(false);

  const setAudio = useCallback((a: AudioState) => {
    setAudioState(a);
    setVideoState(null);
  }, []);
  const setVideo = useCallback((v: VideoState) => {
    setVideoState(v);
    if (v) setAudioState(null);
  }, []);

  return (
    <AudioStore.Provider
      value={{ audio, setAudio, video, setVideo, isLoading, setIsLoading }}
    >
      {children}
    </AudioStore.Provider>
  );
}
