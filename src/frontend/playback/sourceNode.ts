import type { Section } from "../lib/waveform";
import type { LoopOptions } from "./PlaybackContext";
import { buildFreezeBuffer } from "../lib/freeze";
import { cloneBufferFromCache } from "../lib/channelCache";

export interface SourceNodeOptions {
  context: AudioContext;
  data: AudioBuffer;
  positionMS: number;
  frozen: boolean;
  loop: Section | undefined;
  loopOptions: LoopOptions;
  playbackSpeed: number;
}

export function buildSourceNode({
  context,
  data,
  positionMS,
  frozen,
  loop,
  loopOptions,
  playbackSpeed,
}: SourceNodeOptions): AudioBufferSourceNode {
  const node = context.createBufferSource();

  if (frozen) {
    const centerSample = Math.floor((positionMS / 1000) * data.sampleRate);
    node.buffer = buildFreezeBuffer(data, centerSample, context);
    node.loop = true;
    node.start();
    return node;
  }

  node.buffer = cloneBufferFromCache(data, context);
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
