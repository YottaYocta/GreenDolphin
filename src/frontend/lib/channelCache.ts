const cache = new WeakMap<AudioBuffer, Float32Array[]>();

export function getCachedChannels(buffer: AudioBuffer): Float32Array[] {
  const existing = cache.get(buffer);
  if (existing) return existing;
  const channels: Float32Array[] = [];
  for (let i = 0; i < buffer.numberOfChannels; i++) {
    const c = new Float32Array(buffer.length);
    buffer.copyFromChannel(c, i);
    channels.push(c);
  }
  cache.set(buffer, channels);
  return channels;
}

