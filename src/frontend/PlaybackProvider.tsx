import { useState, useRef, useEffect, useCallback } from "react";
import type { ReactNode } from "react";
import { PlaybackContext } from "./PlaybackContext";
import type { PlayState } from "./PlaybackContext";
import { type Section } from "./lib/waveform";
import { clampSection, computeMS } from "./lib/util";
import type { FrequencyData } from "./lib/frequency";
import { SoundTouchNode } from "@soundtouchjs/audio-worklet";
import soundTouchProcessorUrl from "@soundtouchjs/audio-worklet/processor?url";
import { buildFreezeBuffer } from "./lib/freeze";

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
  const [loopDelay, setLoopDelay] = useState<number>(0);
  const loopDelayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loopPauseStart = useRef<number | null>(null);
  const loopPauseEnd = useRef<number | null>(null);

  const triggerUpdate = useCallback(
    () => setTrigger((prevTrigger) => !prevTrigger),
    [],
  );

  const setPosition = useCallback(
    (position: number) => {
      playbackPosition.current = Math.min(Math.max(0, position), data.length);
      triggerUpdate();
    },
    [data.length, triggerUpdate],
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

  const ANALYZER_BUFFER_LENGTH = 8192 * 2;

  const analyzerNode = useRef<AnalyserNode | undefined>(undefined);
  const frequencyData = useRef<FrequencyData>(
    new Float32Array(ANALYZER_BUFFER_LENGTH / 2),
  );
  const analyzerFrameId = useRef<number | undefined>(undefined);

  const soundTouchNode = useRef<SoundTouchNode | undefined>(undefined);

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
    [ANALYZER_BUFFER_LENGTH],
  );

  const [pitchShift, setPitchShift] = useState<number>(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [gain, setGain] = useState<number>(1);
  const [workletReady, setWorkletReady] = useState<boolean>(false);

  useEffect(() => {
    setWorkletReady(false);
    SoundTouchNode.register(context, soundTouchProcessorUrl).then(() =>
      setWorkletReady(true),
    );
  }, [context]);

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
    if (loopDelayTimerRef.current !== null) {
      clearTimeout(loopDelayTimerRef.current);
      loopDelayTimerRef.current = null;
    }
    loopPauseStart.current = null;
    loopPauseEnd.current = null;
    if (sourceNode.current) {
      sourceNode.current.stop();
      sourceNode.current.disconnect();
      sourceNode.current = undefined;
    }
    if (analyzerNode.current) {
      analyzerNode.current.disconnect();
      analyzerNode.current = undefined;
    }
    if (soundTouchNode.current) {
      soundTouchNode.current.disconnect();
      soundTouchNode.current = undefined;
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
   * creates the post-processing chain (soundtouch, gain, analyzer) and connects them
   */
  const buildChain = useCallback((): [AnalyserNode, SoundTouchNode] => {
    destroyChain();

    const newAnalyzer = createAnalyzerNode(context);
    const newSoundTouch = new SoundTouchNode({ context });
    const newGain = context.createGain();
    newGain.gain.value = gain;

    newSoundTouch.connect(newGain);
    newGain.connect(newAnalyzer);
    newAnalyzer.connect(context.destination);

    analyzerNode.current = newAnalyzer;
    analyzerFrameId.current = requestAnimationFrame(getFrequencyLoop);
    soundTouchNode.current = newSoundTouch;
    gainNode.current = newGain;
    return [newAnalyzer, newSoundTouch];
  }, [context, createAnalyzerNode, destroyChain, gain, getFrequencyLoop]);

  const connectSource = useCallback(
    (newSourceNode: AudioBufferSourceNode) => {
      if (sourceNode.current) {
        sourceNode.current.disconnect();
        sourceNode.current = undefined;
      }

      if (!soundTouchNode.current) {
        buildChain();
      }
      newSourceNode.connect(soundTouchNode.current!);
      sourceNode.current = newSourceNode;
    },
    [buildChain],
  );

  const buildChainRef = useRef(buildChain);
  buildChainRef.current = buildChain;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!workletReady) return;
    buildChainRef.current();
    return () => destroyChain();
  }, [workletReady, destroyChain]);

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

        if (next > endMS) {
          if (loopDelay > 0) {
            playbackPosition.current = endMS;
            lastTimeStamp.current = performance.now();
            const now = performance.now();
            loopPauseStart.current = now;
            loopPauseEnd.current = now + loopDelay * 1000;
            setPlayState("paused");
            loopDelayTimerRef.current = setTimeout(() => {
              loopDelayTimerRef.current = null;
              loopPauseStart.current = null;
              loopPauseEnd.current = null;
              playbackPosition.current = startMS;
              setPlayState("playing");
            }, loopDelay * 1000);
          } else {
            playbackPosition.current = startMS;
            lastTimeStamp.current = performance.now();
            animationFrameId.current = requestAnimationFrame(tick);
          }
          return;
        }

        const clampedNext = Math.max(startMS, next);
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
  }, [
    localData.duration,
    localData.sampleRate,
    loop,
    loopDelay,
    looping,
    playbackSpeed,
  ]);

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
    if (!workletReady) return;

    if (soundTouchNode.current) {
      soundTouchNode.current.pitchSemitones.value = pitchShift;
      soundTouchNode.current.playbackRate.value = playbackSpeed;
    }

    if (playState === "paused") {
      stopCount();
      if (sourceNode.current) {
        sourceNode.current.disconnect();
        sourceNode.current = undefined;
      }
    } else if (playState === "frozen") {
      stopCount();
      if (soundTouchNode.current) {
        soundTouchNode.current.playbackRate.value = 1;
      }
      const centerSample = Math.floor(
        (playbackPosition.current / 1000) * localData.sampleRate,
      );
      const newBuffer = buildFreezeBuffer(localData, centerSample, context);
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
        newSourceNode.loop = loopDelay === 0;
        if (loop) {
          const startSeconds = loop.start / localData.sampleRate;
          const endSeconds = loop.end / localData.sampleRate;
          newSourceNode.loopStart = startSeconds;
          newSourceNode.loopEnd = endSeconds;

          newSourceNode.start(
            0,
            Math.max(
              startSeconds,
              Math.min(endSeconds, playbackPosition.current / 1000),
            ),
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
    loopDelay,
    looping,
    playState,
    trigger,
    startCount,
    stopCount,
    pitchShift,
    playbackSpeed,
    workletReady,
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
        analyserNode: analyzerNode.current ?? null,
      }}
    >
      {children}
    </PlaybackContext.Provider>
  );
};
