import { createContext, useState, useRef, useEffect, useCallback } from "react";
import type { ReactNode, RefObject } from "react";

export type PlayState = "playing" | "paused" | "frozen";

interface PlaybackContextType {
  playbackPosition: RefObject<number>;
  playState: PlayState;
  start: () => void;
  pause: () => void;
  freeze: () => void;
}

const PlaybackContext = createContext<PlaybackContextType | undefined>(
  undefined
);

interface PlaybackProviderProps {
  context: AudioContext;
  data: AudioBuffer;
  children: ReactNode[];
}

export const PlaybackProvider = ({
  children,
  context,
  data,
}: PlaybackProviderProps) => {
  const playbackPosition = useRef<number>(0);
  const lastTimeStamp = useRef<number>(0);
  const animationFrameId = useRef<number | undefined>(undefined);
  const [playState, setPlayState] = useState<PlayState>("paused");

  const sourceNode = useRef<AudioBufferSourceNode | undefined>(undefined);

  const tick = useCallback(() => {
    const now = performance.now();
    playbackPosition.current =
      (now - lastTimeStamp.current) % (data.duration * 1000);
    lastTimeStamp.current = now;
    animationFrameId.current = requestAnimationFrame(tick);
  }, [data.duration]);

  const startCount = useCallback(() => {
    lastTimeStamp.current = performance.now();

    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
    }
    animationFrameId.current = requestAnimationFrame(tick);
  }, [tick]);

  const stopCount = useCallback(() => {
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = undefined;
    }
  }, []);

  useEffect(() => {
    if (playState === "paused") {
      if (sourceNode.current) {
        sourceNode.current.stop();
        sourceNode.current.disconnect();
        sourceNode.current = undefined;

        stopCount();
      }
    } else {
      sourceNode.current = context.createBufferSource();
      sourceNode.current.buffer = data;
      sourceNode.current.connect(context.destination);
      sourceNode.current.start(0, playbackPosition.current);
      startCount();
    }
  }, [context, data, playState, startCount, stopCount]);

  const start = useCallback(() => {
    if (playState !== "playing") {
      setPlayState("playing");
    }
  }, [playState]);

  const pause = useCallback(() => {
    if (playState !== "paused") {
      setPlayState("paused");
    }
  }, [playState]);

  const freeze = useCallback(() => {
    if (playState !== "frozen") {
      setPlayState("frozen");
    }
  }, [playState]);

  return (
    <PlaybackContext.Provider
      value={{ playbackPosition, playState, start, pause, freeze }}
    >
      {children}
    </PlaybackContext.Provider>
  );
};
