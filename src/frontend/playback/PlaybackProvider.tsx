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

  const { playState, playbackPosition, dispatch, reset } = usePlaybackClock({
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
      if (action === "play" || action === "pause") {
        dispatch({ type: "play-pause" });
      } else if (action === "freeze") {
        dispatch({ type: "freeze" });
      } else if (action.type === "move") {
        dispatch({ type: "move", positionMS: Math.max(0, action.position) });
        setSeekVersion((v) => v + 1);
      }
    },
    [dispatch],
  );

  const loopLength = loop
    ? (loop.end - loop.start) / localData.sampleRate
    : localData.duration;

  const loopPosition = useRef<number>(0);
  const delayStartTimeRef = useRef<number | null>(null);

  useEffect(() => {
    const loopStartMS = loop ? (loop.start / localData.sampleRate) * 1000 : 0;
    let rafId: number;
    const update = () => {
      rafId = requestAnimationFrame(update);
      if (playState === "waiting") {
        if (delayStartTimeRef.current === null) {
          delayStartTimeRef.current = performance.now();
        }
        loopPosition.current =
          loopLength + (performance.now() - delayStartTimeRef.current) / 1000;
      } else {
        delayStartTimeRef.current = null;
        loopPosition.current = (playbackPosition.current - loopStartMS) / 1000;
      }
    };
    delayStartTimeRef.current = null;
    rafId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(rafId);
  }, [localData.sampleRate, loop, loopLength, playbackPosition, playState]);

  useEffect(() => {
    reset();
    setLocalData(data);
    setPlaybackSettings((prev) => ({ ...prev, loop: undefined }));
  }, [data, reset]);

  useEffect(() => {
    if (!entryNode || playState === "paused" || playState === "waiting") return;

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
