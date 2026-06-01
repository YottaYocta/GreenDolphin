import { useState, useEffect, useCallback } from "react";
import type { ReactNode } from "react";
import { PlaybackContext } from "./PlaybackContext";
import { type Section } from "../lib/waveform";
import { clampSection, computeMS } from "../lib/util";
import { SoundTouchNode } from "@soundtouchjs/audio-worklet";
import soundTouchProcessorUrl from "@soundtouchjs/audio-worklet/processor?url";
import { buildFreezeBuffer } from "../lib/freeze";
import { useAudioChain } from "./useAudioChain";
import { usePlaybackClock } from "./usePlaybackClock";

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
  const [localData, setLocalData] = useState<AudioBuffer>(data);
  const [startPosition, setStartPosition] = useState<number>(0);

  const [looping, setLooping] = useState<boolean>(true);
  const [loop, setLocalLoop] = useState<undefined | Section>();
  const [loopDelay, setLoopDelay] = useState<number>(0);

  const [pitchShift, setPitchShift] = useState<number>(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [gain, setGain] = useState<number>(1);
  const [readyContext, setReadyContext] = useState<AudioContext | null>(null);

  const {
    playState,
    setPlayState,
    playbackPosition,
    loopPauseStart,
    loopPauseEnd,
    stopClock,
    cancelLoopDelay,
  } = usePlaybackClock({
    sampleRate: localData.sampleRate,
    duration: localData.duration,
    loop,
    looping,
    loopDelay,
    playbackSpeed,
  });

  useEffect(() => {
    setReadyContext(null);
    SoundTouchNode.register(context, soundTouchProcessorUrl).then(() =>
      setReadyContext(context),
    );
  }, [context]);

  const { entryNode, analyserNode, frequencyData } = useAudioChain({
    context,
    workletReady: readyContext === context,
    gain,
    pitchShift,
    playbackSpeed,
    playState,
  });

  const setPosition = useCallback(
    (position: number) => {
      cancelLoopDelay();
      playbackPosition.current = Math.min(Math.max(0, position), data.length);
      setStartPosition(playbackPosition.current);
    },
    [cancelLoopDelay, data.length, playbackPosition],
  );

  const setLoop = useCallback(
    (newLoop: Section | undefined) => {
      if (newLoop !== undefined) {
        const clampedSection = clampSection(newLoop, {
          start: 0,
          end: data.length,
        });
        setLocalLoop(clampedSection);
        setPosition(computeMS(data.sampleRate, clampedSection.start));
      } else {
        setLocalLoop(undefined);
      }
    },
    [data.length, data.sampleRate, setPosition],
  );

  useEffect(() => {
    stopClock();
    cancelLoopDelay();
    setPlayState("paused");
    setLocalData(data);
    setLocalLoop(undefined);
    playbackPosition.current = 0;
  }, [cancelLoopDelay, data, playbackPosition, setPlayState, stopClock]);

  const stopNode = useCallback((node: AudioBufferSourceNode) => {
    node.onended = null;
    try {
      node.stop();
    } catch {}
    node.disconnect();
  }, []);

  useEffect(() => {
    if (!entryNode || playState === "paused") return;

    let node: AudioBufferSourceNode;

    if (playState === "frozen") {
      const centerSample = Math.floor(
        (playbackPosition.current / 1000) * localData.sampleRate,
      );
      const buf = buildFreezeBuffer(localData, centerSample, context);
      node = context.createBufferSource();
      node.buffer = buf;
      node.loop = true;
      node.connect(entryNode);
      node.start();
    } else {
      node = context.createBufferSource();
      node.buffer = localData;
      // when looping with a delay, the tick owns the boundary and schedules the
      // delay; onended would race and pause without triggering it
      if (!looping) node.onended = () => setPlayState("paused");
      node.playbackRate.value = playbackSpeed;

      if (looping) {
        node.loop = loopDelay === 0;
        if (loop) {
          const startSec = loop.start / localData.sampleRate;
          const endSec = loop.end / localData.sampleRate;
          node.loopStart = startSec;
          node.loopEnd = endSec;
          node.start(
            0,
            Math.max(
              startSec,
              Math.min(endSec, playbackPosition.current / 1000),
            ),
          );
        } else {
          node.start(0, playbackPosition.current / 1000);
        }
      } else {
        node.start(0, playbackPosition.current / 1000);
      }

      node.connect(entryNode);
    }

    return () => {
      stopNode(node);
    };
  }, [
    context,
    entryNode,
    localData,
    loop,
    loopDelay,
    looping,
    playbackSpeed,
    playState,
    playbackPosition,
    setPlayState,
    startPosition,
    stopNode,
  ]);

  return (
    <PlaybackContext.Provider
      value={{
        playState,
        setPlayState,
        playbackPosition,
        setPosition,
        looping,
        setLooping,
        loop,
        setLoop,
        frequencyData,
        pitchShift,
        setPitchShift,
        playbackSpeed,
        setPlaybackSpeed,
        gain,
        setGain,
        loopDelay,
        setLoopDelay,
        loopPauseStart,
        loopPauseEnd,
        audioContext: context,
        analyserNode,
      }}
    >
      {children}
    </PlaybackContext.Provider>
  );
};
