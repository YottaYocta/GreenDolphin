import type { Section } from "../lib/waveform";
import { buildFreezeBuffer } from "../lib/freeze";

export interface SourceNodeOptions {
  context: AudioContext;
  data: AudioBuffer;
  positionMS: number;
  frozen: boolean;
  loop: Section | undefined;
  loopDelay: number;
  playbackSpeed: number;
}

export function buildSourceNode({
  context,
  data,
  positionMS,
  frozen,
  loop,
  loopDelay,
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

  node.buffer = data;
  // when loopDelay > 0 the tick owns the boundary; onended would race and
  // pause without triggering the delay
  node.loop = loopDelay === 0;
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
