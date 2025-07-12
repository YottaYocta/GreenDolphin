import { useState, useRef, useEffect, useCallback } from "react";
import type { ReactNode } from "react";
import { PlaybackContext } from "./PlaybackContext";
import type { PlayState } from "./PlaybackContext";
import { type Section } from "./lib/waveform";
import { clampSection, computeMS, getInverseShift } from "./lib/util";
import type { FrequencyData } from "./lib/frequency";
import { PitchShift } from "tone";
import * as Tone from "tone";

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
  /**
   * the playback position in milliseconds
   */
  const playbackPosition = useRef<number>(0);
  const lastTimeStamp = useRef<number>(0);
  const animationFrameId = useRef<number | undefined>(undefined);

  const [playState, setPlayState] = useState<PlayState>("paused");
  const [localData, setLocalData] = useState<AudioBuffer>(data);
  const [trigger, setTrigger] = useState<boolean>(false);

  const [looping, setLooping] = useState<boolean>(true);
  const [loop, setLocalLoop] = useState<undefined | Section>();

  const triggerUpdate = useCallback(
    () => setTrigger((prevTrigger) => !prevTrigger),
    []
  );

  const setPosition = useCallback(
    (position: number) => {
      playbackPosition.current = Math.min(Math.max(0, position), data.length);
      triggerUpdate();
    },
    [data.length, triggerUpdate]
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
    [data.length, data.sampleRate, setPosition]
  );

  const ANALYZER_BUFFER_LENGTH = 8192 * 2;

  const analyzerNode = useRef<AnalyserNode | undefined>(undefined);
  const frequencyData = useRef<FrequencyData>(
    new Float32Array(ANALYZER_BUFFER_LENGTH)
  );
  const analyzerFrameId = useRef<number | undefined>(undefined);

  const pitchShiftNode = useRef<PitchShift | undefined>(undefined);

  const gainNode = useRef<GainNode | undefined>(undefined);

  const sourceNode = useRef<AudioBufferSourceNode | undefined>(undefined);

  const createAnalyzerNode = useCallback(
    (context: AudioContext) => {
      const newAnalyzer = context.createAnalyser();
      newAnalyzer.minDecibels = -140;
      newAnalyzer.maxDecibels = 0;
      newAnalyzer.smoothingTimeConstant = 0.1;
      newAnalyzer.fftSize = ANALYZER_BUFFER_LENGTH;
      return newAnalyzer;
    },
    [ANALYZER_BUFFER_LENGTH]
  );

  const [pitchShift, setPitchShift] = useState<number>(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [gain, setGain] = useState<number>(1);

  const getFrequencyLoop = useCallback(() => {
    if (analyzerNode.current) {
      requestAnimationFrame(getFrequencyLoop);
      analyzerNode.current.getFloatFrequencyData(frequencyData.current);
    }
  }, []);

  /**
   * disposes of post-processing chain and source node
   */
  const destroyChain = useCallback(() => {
    if (sourceNode.current) {
      sourceNode.current.stop();
      sourceNode.current.disconnect();
      sourceNode.current = undefined;
    }
    if (analyzerNode.current) {
      analyzerNode.current.disconnect();
      analyzerNode.current = undefined;
    }
    if (pitchShiftNode.current) {
      pitchShiftNode.current.dispose();
      pitchShiftNode.current = undefined;
    }
    if (gainNode.current) {
      gainNode.current.disconnect();
      gainNode.current = undefined;
    }

    if (analyzerFrameId.current) {
      cancelAnimationFrame(analyzerFrameId.current);
      analyzerFrameId.current = undefined;
    }
  }, []);

  /**
   * creates the post-processing chain (analyzer, pitchshift) and connects them
   */
  const buildChain = useCallback((): [AnalyserNode, PitchShift] => {
    destroyChain();

    const newAnalzyer = createAnalyzerNode(context);
    const newPitchShift = new PitchShift(
      pitchShift - getInverseShift(playbackSpeed)
    );
    const newGain = context.createGain();
    newGain.gain.value = gain;
    newPitchShift.windowSize = 0.1;

    Tone.connectSeries(
      newPitchShift,
      newGain,
      newAnalzyer,
      context.destination
    );

    analyzerNode.current = newAnalzyer;
    analyzerFrameId.current = requestAnimationFrame(getFrequencyLoop);
    pitchShiftNode.current = newPitchShift;
    return [newAnalzyer, newPitchShift];
  }, [
    context,
    createAnalyzerNode,
    destroyChain,
    gain,
    getFrequencyLoop,
    pitchShift,
    playbackSpeed,
  ]);

  const connectSource = useCallback(
    (newSourceNode: AudioBufferSourceNode) => {
      if (sourceNode.current) {
        sourceNode.current.disconnect();
        sourceNode.current = undefined;
      }

      if (pitchShiftNode.current) {
        Tone.connect(newSourceNode, pitchShiftNode.current);
      } else {
        destroyChain();
        const [, newPitchShift] = buildChain();
        Tone.connect(newSourceNode, newPitchShift);
      }
      sourceNode.current = newSourceNode;
    },
    [buildChain, destroyChain]
  );

  useEffect(() => {
    buildChain();
    return () => destroyChain();
  }, [buildChain, destroyChain]);

  const stopCount = useCallback(() => {
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = undefined;
    }
  }, []);

  const tick = useCallback(() => {
    const now = performance.now();
    const next =
      playbackPosition.current + (now - lastTimeStamp.current) * playbackSpeed;

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
      // playing
      if (loop) {
        const startMS = computeMS(localData.sampleRate, loop.start);
        const endMS = computeMS(localData.sampleRate, loop.end);

        if (next > endMS) {
          playbackPosition.current = startMS;
          setPlayState("paused");
        } else if (next < startMS) {
          playbackPosition.current = startMS;
          animationFrameId.current = requestAnimationFrame(tick);
        } else {
          playbackPosition.current = next;
          animationFrameId.current = requestAnimationFrame(tick);
        }

        lastTimeStamp.current = performance.now();
      } else if (next > localData.duration * 1000) {
        playbackPosition.current = 0;

        lastTimeStamp.current = performance.now();
        setPlayState("paused");
      } else {
        playbackPosition.current = next;
        lastTimeStamp.current = performance.now();

        animationFrameId.current = requestAnimationFrame(tick);
      }
    }
  }, [localData.duration, localData.sampleRate, loop, looping, playbackSpeed]);

  const startCount = useCallback(() => {
    stopCount();
    lastTimeStamp.current = performance.now();
    animationFrameId.current = requestAnimationFrame(tick);
  }, [stopCount, tick]);

  useEffect(() => {
    stopCount();
    setPlayState("paused");
    setLocalData(data);
    setLocalLoop(undefined);
    playbackPosition.current = 0;
  }, [data, stopCount]);

  useEffect(() => {
    if (pitchShiftNode.current) {
      if (playState === "frozen") {
        pitchShiftNode.current.pitch = pitchShift;
      } else {
        pitchShiftNode.current.pitch =
          pitchShift + getInverseShift(playbackSpeed);
      }
    } else {
      destroyChain();
      const [, newPitchShift] = buildChain();
      if (playState === "frozen") {
        newPitchShift.pitch = pitchShift;
      } else {
        newPitchShift.pitch = pitchShift + getInverseShift(playbackSpeed);
      }
    }

    if (playState === "paused") {
      stopCount();
      if (sourceNode.current) {
        sourceNode.current.disconnect();
        sourceNode.current = undefined;
      }
    } else if (playState === "frozen") {
      stopCount();
      const playbackPositionSamples = Math.floor(
        (playbackPosition.current / 1000) * localData.sampleRate
      );
      const FREEZE_RANGE = 4000;
      const clampedBufferRange = clampSection(
        {
          start: playbackPositionSamples - FREEZE_RANGE,
          end: playbackPositionSamples + FREEZE_RANGE,
        },
        { start: 0, end: localData.length }
      );
      const newBufferLength = clampedBufferRange.end - clampedBufferRange.start;
      const newBuffer = context.createBuffer(
        localData.numberOfChannels,
        newBufferLength,
        localData.sampleRate
      );

      for (let i = 0; i < localData.numberOfChannels; i++) {
        const channelData = localData.getChannelData(i);
        const newChannelData = newBuffer.getChannelData(i);
        for (let j = 0; j < newBufferLength; j++) {
          const blendShifted = Math.abs(j / newBufferLength - 0.5) * 2;
          const blendSource = 1 - blendShifted;
          const shiftedIntensity =
            channelData[
              clampedBufferRange.start +
                ((j + Math.floor(newBufferLength / 2)) % newBufferLength)
            ] * blendShifted;
          const sourceIntensity =
            channelData[clampedBufferRange.start + j] * blendSource;
          newChannelData[j] = shiftedIntensity + sourceIntensity;
        }
      }

      const newSourceNode = context.createBufferSource();
      newSourceNode.buffer = newBuffer;
      newSourceNode.loop = true;

      connectSource(newSourceNode);
      newSourceNode.start();
    } else {
      const newSourceNode = context.createBufferSource();
      newSourceNode.buffer = localData;

      newSourceNode.onended = () => {
        setPlayState("paused");
      };

      if (looping) {
        newSourceNode.loop = looping;
        if (loop) {
          const startSeconds = loop.start / localData.sampleRate;
          const endSeconds = loop.end / localData.sampleRate;
          newSourceNode.loopStart = startSeconds;
          newSourceNode.loopEnd = endSeconds;

          newSourceNode.start(
            0,
            Math.max(
              startSeconds,
              Math.min(endSeconds, playbackPosition.current / 1000)
            )
          );
        } else {
          newSourceNode.start(0, playbackPosition.current / 1000);
        }
      } else newSourceNode.start(0, playbackPosition.current / 1000);

      newSourceNode.playbackRate.value = playbackSpeed;

      startCount();
      connectSource(newSourceNode);
    }
  }, [
    connectSource,
    context,
    localData,
    loop,
    looping,
    playState,
    trigger,
    startCount,
    stopCount,
    pitchShift,
    destroyChain,
    buildChain,
    playbackSpeed,
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
      }}
    >
      {children}
    </PlaybackContext.Provider>
  );
};
