import { useState, useEffect, useCallback, useRef } from "react";
import type { ReactNode } from "react";
import { PlaybackContext } from "./PlaybackContext";
import type { PlaybackSettings, PlaybackAction } from "./PlaybackContext";
import type { AudioSettingsUpdate } from "./usePlaybackClock";
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
  const [chainSettings, setChainSettings] = useState({
    pitchShift: 0,
    gain: 1,
  });
  const [readyContext, setReadyContext] = useState<AudioContext | null>(null);

  const {
    audioSettings,
    updateSettings,
    playState,
    playbackPosition,
    timerStartedAtMS,
    dispatch,
    reset,
    lastStartPosition,
  } = usePlaybackClock({
    duration: localData.duration,
    initialSettings: { sampleRate: localData.sampleRate },
  });

  const { loop, loopDelay, playbackSpeed } = audioSettings;

  useEffect(() => {
    setReadyContext(null);
    SoundTouchNode.register(context, soundTouchProcessorUrl).then(() =>
      setReadyContext(context),
    );
  }, [context]);

  const { entryNode, analyserNode, frequencyData } = useAudioChain({
    context,
    workletReady: readyContext === context,
    gain: chainSettings.gain,
    pitchShift: chainSettings.pitchShift,
    playbackSpeed,
    playState,
  });

  const setAudioSettings = useCallback(
    (settings: Partial<PlaybackSettings>) => {
      const clockUpdates: AudioSettingsUpdate = {};
      if (settings.loop !== undefined)
        clockUpdates.loop = clampSection(settings.loop, {
          start: 0,
          end: data.length,
        });
      if (settings.loopDelay !== undefined)
        clockUpdates.loopDelay = settings.loopDelay;
      if (settings.playbackSpeed !== undefined)
        clockUpdates.playbackSpeed = settings.playbackSpeed;
      if (Object.keys(clockUpdates).length) updateSettings(clockUpdates);

      const chainUpdates: Partial<typeof chainSettings> = {};
      if (settings.pitchShift !== undefined)
        chainUpdates.pitchShift = settings.pitchShift;
      if (settings.gain !== undefined) chainUpdates.gain = settings.gain;
      if (Object.keys(chainUpdates).length)
        setChainSettings((prev) => ({ ...prev, ...chainUpdates }));
    },
    [data.length, updateSettings],
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

  useEffect(() => {
    const loopStartMS = loop ? computeMS(localData.sampleRate, loop.start) : 0;
    let rafId: number;
    const update = () => {
      rafId = requestAnimationFrame(update);
      if (playState === "waiting") {
        const startedAt = timerStartedAtMS!;
        loopPosition.current =
          loopLength + (performance.now() - startedAt) / 1000;
      } else {
        loopPosition.current = (playbackPosition.current - loopStartMS) / 1000;
      }
    };
    rafId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(rafId);
  }, [
    localData.sampleRate,
    loop,
    loopLength,
    playbackPosition,
    playState,
    timerStartedAtMS,
  ]);

  useEffect(() => {
    reset();
    setLocalData(data);
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
      } catch (e) {
        console.error(e);
      }
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

  const playbackSettings: PlaybackSettings = {
    pitchShift: chainSettings.pitchShift,
    gain: chainSettings.gain,
    loop,
    loopDelay,
    playbackSpeed,
  };

  return (
    <PlaybackContext.Provider
      value={{
        playState,
        lastStartPosition,
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
