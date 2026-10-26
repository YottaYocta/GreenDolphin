// Workers have no Web Audio. The algorithms only read samples and allocate
// outputs, so a duck-typed AudioBuffer lets them run here unchanged.
export const shim = (channels: Float32Array[], sampleRate: number) =>
  ({
    sampleRate,
    length: channels[0].length,
    numberOfChannels: channels.length,
    duration: channels[0].length / sampleRate,
    getChannelData: (i: number) => channels[i],
    copyFromChannel: (dest: Float32Array, i: number) => dest.set(channels[i]),
    copyToChannel: (src: Float32Array, i: number) => channels[i].set(src),
  }) as unknown as AudioBuffer;

export const context = {
  createBuffer: (n: number, length: number, sampleRate: number) =>
    shim(Array.from({ length: n }, () => new Float32Array(length)), sampleRate),
} as unknown as BaseAudioContext;
