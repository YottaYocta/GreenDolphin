import { useState, useRef, useEffect, useCallback } from "react";
import type { ReactNode } from "react";
import { PlaybackContext } from "./PlaybackContext";
import type { PlayState } from "./PlaybackContext";

export interface PlaybackProviderProps {
  context: AudioContext;
  data: AudioBuffer;
  children?: ReactNode;
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
  const [localData, setLocalData] = useState<AudioBuffer>(data);
  const [trigger, setTrigger] = useState<boolean>(false);

  const [looping, setLooping] = useState<boolean>(false);

  const sourceNode = useRef<AudioBufferSourceNode | undefined>(undefined);

  const stopCount = useCallback(() => {
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = undefined;
    }
  }, []);

  const tick = useCallback(() => {
    const now = performance.now();
    const next = playbackPosition.current + (now - lastTimeStamp.current);
    if (next / 1000 <= localData.duration) {
      playbackPosition.current = next;

      lastTimeStamp.current = performance.now();
      animationFrameId.current = requestAnimationFrame(tick);
    } else if (looping) {
      playbackPosition.current = 0;

      lastTimeStamp.current = performance.now();
      animationFrameId.current = requestAnimationFrame(tick);
    } else {
      stopCount();
    }
  }, [localData.duration, looping, stopCount]);

  const startCount = useCallback(() => {
    stopCount();
    lastTimeStamp.current = performance.now();
    animationFrameId.current = requestAnimationFrame(tick);
  }, [stopCount, tick]);

  useEffect(() => {
    stopCount();
    setPlayState("paused");
    playbackPosition.current = 0;
    setLocalData(data);
  }, [data, stopCount]);

  useEffect(() => {
    if (playState === "paused") {
      if (sourceNode.current) {
        sourceNode.current.stop();
        stopCount();
        sourceNode.current.disconnect();
        sourceNode.current = undefined;
      }
    } else {
      if (sourceNode.current) {
        sourceNode.current.stop();
        sourceNode.current.disconnect();
        sourceNode.current = undefined;
      }

      sourceNode.current = context.createBufferSource();
      sourceNode.current.buffer = localData;
      sourceNode.current.connect(context.destination);
      sourceNode.current.loop = looping;
      sourceNode.current.start(0, playbackPosition.current / 1000);
      startCount();
    }
  }, [context, localData, playState, startCount, stopCount, trigger, looping]);

  const start = useCallback(() => {
    setPlayState("playing");
  }, []);

  const pause = useCallback(() => {
    setPlayState("paused");
  }, []);

  const freeze = useCallback(() => {
    setPlayState("frozen");
  }, []);

  const setPosition = useCallback((position: number) => {
    playbackPosition.current = position;
    setTrigger((prev) => !prev);
  }, []);

  return (
    <PlaybackContext.Provider
      value={{
        playbackPosition,
        playState,
        start,
        pause,
        freeze,
        setPosition,
        looping,
        setLooping,
      }}
    >
      {children}
    </PlaybackContext.Provider>
  );
};
