import { useState, useEffect, useCallback, useRef } from "react";
import type { ReactNode } from "react";
import { PlaybackContext } from "./PlaybackContext";
import type { PlaybackSettings, PlaybackAction } from "./PlaybackContext";
import { clampSection } from "../lib/util";
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

const DEFAULT_SETTINGS: PlaybackSettings = {
  pitchShift: 0,
  playbackSpeed: 1,
  gain: 1,
  loopDelay: 0,
  loop: undefined,
};

export const PlaybackProvider = ({
  children,
  context,
  data,
}: PlaybackProviderProps) => {
  const [localData, setLocalData] = useState<AudioBuffer>(data);
  const [seekVersion, setSeekVersion] = useState(0);
  const [playbackSettings, setPlaybackSettings] =
    useState<PlaybackSettings>(DEFAULT_SETTINGS);
  const [readyContext, setReadyContext] = useState<AudioContext | null>(null);

  const { loop, loopDelay, playbackSpeed } = playbackSettings;

  const {
    playState,
    setPlayState,
    playbackPosition,
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
    setReadyContext(null);
    SoundTouchNode.register(context, soundTouchProcessorUrl).then(() =>
      setReadyContext(context),
    );
  }, [context]);

  const { entryNode, analyserNode, frequencyData } = useAudioChain({
    context,
    workletReady: readyContext === context,
    gain: playbackSettings.gain,
    pitchShift: playbackSettings.pitchShift,
    playbackSpeed,
    playState,
  });

  const setAudioSettings = useCallback(
    (settings: Partial<PlaybackSettings>) => {
      setPlaybackSettings((prev) => {
        const next = { ...prev, ...settings };
        if (settings.loop !== undefined) {
          const newLoop = settings.loop;
          if (newLoop !== undefined) {
            next.loop = clampSection(newLoop, { start: 0, end: data.length });
          }
        }
        return next;
      });
    },
    [data.length],
  );

  const triggerAction = useCallback(
    (action: PlaybackAction) => {
      if (action === "play") {
        setPlayState("playing");
      } else if (action === "pause") {
        setPlayState("paused");
      } else if (action === "freeze") {
        setPlayState("frozen");
      } else if (action.type === "move") {
        cancelLoopDelay();
        playbackPosition.current = Math.min(
          Math.max(0, action.position),
          data.length,
        );
        setSeekVersion((v) => v + 1);
      }
    },
    [cancelLoopDelay, data.length, playbackPosition, setPlayState],
  );

  const loopLength = loop
    ? (loop.end - loop.start) / localData.sampleRate
    : localData.duration;

  // loopPosition: elapsed seconds from loop start.
  // During the delay period, continues ticking past loopLength so consumers
  // can compute delay progress as (loopPosition - loopLength) / loopDelay.
  const loopPosition = useRef<number>(0);
  const lastPlaybackPosRef = useRef<number>(-1);
  const delayStartTimeRef = useRef<number | null>(null);
  useEffect(() => {
    let rafId: number;
    const update = () => {
      rafId = requestAnimationFrame(update);
      const loopStartMS = loop
        ? (loop.start / localData.sampleRate) * 1000
        : 0;
      const loopEndMS = loop
        ? (loop.end / localData.sampleRate) * 1000
        : localData.duration * 1000;
      const currentPos = playbackPosition.current;

      if (currentPos !== lastPlaybackPosRef.current) {
        // Position is advancing — normal playback or seek
        delayStartTimeRef.current = null;
        lastPlaybackPosRef.current = currentPos;
        loopPosition.current = (currentPos - loopStartMS) / 1000;
      } else if (loopDelay > 0 && Math.abs(currentPos - loopEndMS) < 1) {
        // Position stuck at loop end with a delay configured — we're in the delay period
        if (delayStartTimeRef.current === null) {
          delayStartTimeRef.current = performance.now();
        }
        loopPosition.current =
          loopLength + (performance.now() - delayStartTimeRef.current) / 1000;
      }
    };
    lastPlaybackPosRef.current = -1;
    delayStartTimeRef.current = null;
    rafId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(rafId);
  }, [localData.sampleRate, localData.duration, loop, loopDelay, loopLength, playbackPosition]);

  useEffect(() => {
    stopClock();
    cancelLoopDelay();
    setPlayState("paused");
    setLocalData(data);
    setPlaybackSettings((prev) => ({ ...prev, loop: undefined }));
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
        playbackPosition,
        loopPosition,
        loopLength,
        playbackSettings,
        setAudioSettings,
        triggerAction,
        frequencyData,
        audioContext: context,
        analyserNode,
      }}
    >
      {children}
    </PlaybackContext.Provider>
  );
};
