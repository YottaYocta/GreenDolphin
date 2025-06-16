import { useState, useRef, useEffect, useCallback } from "react";
import type { ReactNode } from "react";
import { PlaybackContext } from "./PlaybackContext";
import type { PlayState } from "./PlaybackContext";
import { type Section } from "./lib/waveform";

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

  const [loop, setLoop] = useState<undefined | Section>();

  const sourceNode = useRef<AudioBufferSourceNode | undefined>(undefined);

  const start = useCallback(() => {
    setPlayState("playing");
  }, []);

  const pause = useCallback(() => {
    setPlayState("paused");
  }, []);

  const freeze = useCallback(() => {
    setPlayState("frozen");
  }, []);

  const triggerUpdate = useCallback(
    () => setTrigger((prevTrigger) => !prevTrigger),
    []
  );

  const setPosition = useCallback(
    (position: number) => {
      playbackPosition.current = position;
      triggerUpdate();
    },
    [triggerUpdate]
  );

  const stopCount = useCallback(() => {
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = undefined;
    }
  }, []);

  const tick = useCallback(() => {
    const now = performance.now();
    const next = playbackPosition.current + (now - lastTimeStamp.current);

    if (looping) {
      if (loop) {
        const startMS = (loop.start / localData.sampleRate) * 1000;
        const endMS = (loop.end / localData.sampleRate) * 1000;
        const clampedNext = next > endMS ? startMS : Math.max(startMS, next);

        playbackPosition.current = clampedNext;
        lastTimeStamp.current = performance.now();

        animationFrameId.current = requestAnimationFrame(tick);
      } else {
        if (next > localData.duration * 1000) {
          playbackPosition.current = 0;
        } else {
          playbackPosition.current = next;
        }
        lastTimeStamp.current = performance.now();

        animationFrameId.current = requestAnimationFrame(tick);
      }
    } else {
      // if not looping, ignore loop section and keep playing
      if (next > localData.duration * 1000) {
        playbackPosition.current = 0;

        lastTimeStamp.current = performance.now();
        pause();
      } else {
        playbackPosition.current = next;
        lastTimeStamp.current = performance.now();

        animationFrameId.current = requestAnimationFrame(tick);
      }
    }
  }, [localData.duration, localData.sampleRate, loop, looping, pause]);

  const startCount = useCallback(() => {
    stopCount();
    lastTimeStamp.current = performance.now();
    animationFrameId.current = requestAnimationFrame(tick);
  }, [stopCount, tick]);

  useEffect(() => {
    stopCount();
    setPlayState("paused");
    setLocalData(data);
    playbackPosition.current = 0;
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
      if (looping) {
        sourceNode.current.loop = looping;
        if (loop) {
          const startSeconds = loop.start / localData.sampleRate;
          const endSeconds = loop.end / localData.sampleRate;
          sourceNode.current.loopStart = startSeconds;
          sourceNode.current.loopEnd = endSeconds;

          sourceNode.current.start(
            0,
            Math.max(
              startSeconds,
              Math.min(endSeconds, playbackPosition.current / 1000)
            )
          );
        }
      } else sourceNode.current.start(0, playbackPosition.current / 1000);
      startCount();
    }
  }, [
    context,
    localData,
    playState,
    startCount,
    stopCount,
    trigger,
    looping,
    loop,
  ]);

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
        loop,
        setLoop,
      }}
    >
      {children}
    </PlaybackContext.Provider>
  );
};
