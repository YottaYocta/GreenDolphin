import { useMemo, useEffect, useRef } from "react";
import { SoundTouchNode } from "@soundtouchjs/audio-worklet";
import type { FrequencyData } from "./lib/frequency";
import type { PlayState } from "./PlaybackContext";

const ANALYZER_BUFFER_LENGTH = 8192 * 2;

export interface UseAudioChainProps {
  context: AudioContext;
  workletReady: boolean;
  gain: number;
  pitchShift: number;
  playbackSpeed: number;
  playState: PlayState;
}

export interface AudioChainResult {
  entryNode: SoundTouchNode | null;
  analyserNode: AnalyserNode | null;
  frequencyData: React.RefObject<FrequencyData>;
}

export function useAudioChain({
  context,
  workletReady,
  gain,
  pitchShift,
  playbackSpeed,
  playState,
}: UseAudioChainProps): AudioChainResult {
  const frequencyData = useRef<FrequencyData>(
    new Float32Array(ANALYZER_BUFFER_LENGTH / 2),
  );

  const chain = useMemo(() => {
    if (!workletReady) return null;

    const analyzer = context.createAnalyser();
    analyzer.minDecibels = -140;
    analyzer.maxDecibels = 0;
    analyzer.smoothingTimeConstant = 0.1;
    analyzer.fftSize = ANALYZER_BUFFER_LENGTH;

    const soundTouch = new SoundTouchNode({ context });
    const gainNode = context.createGain();

    soundTouch.connect(gainNode);
    gainNode.connect(analyzer);
    analyzer.connect(context.destination);

    return { analyzer, soundTouch, gainNode };
  }, [context, workletReady]);

  useEffect(() => {
    return () => {
      chain?.soundTouch.disconnect();
      chain?.gainNode.disconnect();
      chain?.analyzer.disconnect();
    };
  }, [chain]);

  useEffect(() => {
    if (chain) chain.gainNode.gain.value = gain;
  }, [chain, gain]);

  useEffect(() => {
    if (!chain) return;
    chain.soundTouch.pitchSemitones.value = pitchShift;
    chain.soundTouch.playbackRate.value =
      playState === "frozen" ? 1 : playbackSpeed;
  }, [chain, pitchShift, playbackSpeed, playState]);

  useEffect(() => {
    const analyzer = chain?.analyzer;
    if (!analyzer) return;
    let frameId: number;
    const tick = () => {
      frameId = requestAnimationFrame(tick);
      analyzer.getFloatFrequencyData(frequencyData.current);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [chain]);

  return {
    entryNode: chain?.soundTouch ?? null,
    analyserNode: chain?.analyzer ?? null,
    frequencyData,
  };
}
