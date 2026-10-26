import type { Section } from "../lib/waveform";
import type { LoopOptions } from "./PlaybackContext";

export interface SourceNodeOptions {
  context: AudioContext;
  data: AudioBuffer;
  positionMS: number;
  loop: Section | undefined;
  loopOptions: LoopOptions;
  playbackSpeed: number;
}

export function buildSourceNode({
  context,
  data,
  positionMS,
  loop,
  loopOptions,
  playbackSpeed,
}: SourceNodeOptions): AudioBufferSourceNode {
  const node = context.createBufferSource();

  node.buffer = data;
  node.loop =
    loopOptions.type === "automatic" && loopOptions.loopDelay === 0;
  node.playbackRate.value = playbackSpeed;

  if (loop) {
    const startSec = loop.start / data.sampleRate;
    const endSec = loop.end / data.sampleRate;
    node.loopStart = startSec;
    node.loopEnd = endSec;
    node.start(0, Math.max(startSec, Math.min(endSec, positionMS / 1000)));
  } else {
    node.start(0, positionMS / 1000);
  }

  return node;
}
