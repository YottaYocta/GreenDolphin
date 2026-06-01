import { useState, useEffect, useCallback } from "react";
import type { ReactNode } from "react";
import { PlaybackContext } from "./PlaybackContext";
import { type Section } from "../lib/waveform";
import { clampSection, computeMS } from "../lib/util";
import { SoundTouchNode } from "@soundtouchjs/audio-worklet";
import soundTouchProcessorUrl from "@soundtouchjs/audio-worklet/processor?url";
import { buildSourceNode } from "./sourceNode";
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
  const [seekVersion, setSeekVersion] = useState(0);

  const [loop, setLocalLoop] = useState<undefined | Section>();
  const [loopDelay, setLoopDelay] = useState<number>(0);

  const [pitchShift, setPitchShift] = useState<number>(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [gain, setGain] = useState<number>(1);
  const [workletReady, setWorkletReady] = useState(false);

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
    loopDelay,
    playbackSpeed,
  });

  useEffect(() => {
    setWorkletReady(false);
    SoundTouchNode.register(context, soundTouchProcessorUrl).then(() =>
      setWorkletReady(true),
    );
  }, [context]);

  const { entryNode, analyserNode, frequencyData } = useAudioChain({
    context,
    workletReady,
    gain,
    pitchShift,
    playbackSpeed,
    playState,
  });

  const setPosition = useCallback(
    (position: number) => {
      cancelLoopDelay();
      playbackPosition.current = Math.min(Math.max(0, position), data.length);
      setSeekVersion((v) => v + 1);
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

  useEffect(() => {
    if (!entryNode || playState === "paused") return;

    const node = buildSourceNode({
      context,
      data: localData,
      positionMS: playbackPosition.current,
      frozen: playState === "frozen",
      loop,
      loopDelay,
      playbackSpeed,
    });
    node.connect(entryNode);

    return () => {
      node.onended = null;
      try {
        node.stop();
      } catch {}
      node.disconnect();
    };
  }, [
    context,
    entryNode,
    localData,
    loop,
    loopDelay,
    playbackSpeed,
    playState,
    playbackPosition,
    seekVersion,
  ]);

  return (
    <PlaybackContext.Provider
      value={{
        playState,
        setPlayState,
        playbackPosition,
        setPosition,
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
