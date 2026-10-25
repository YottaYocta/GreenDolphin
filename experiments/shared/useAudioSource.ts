import { useCallback, useState } from "react";

export const DEMO_URL = "/Wynton Kelly - On Green Dolphin Street.mp3";

export interface AudioSource {
  name: string;
  buffer: AudioBuffer;
  /** Encoded size, to compare against decoded memory. */
  encodedBytes: number;
}

export const useAudioSource = (ctx: AudioContext) => {
  const [source, setSource] = useState<AudioSource | null>(null);
  const [loading, setLoading] = useState(false);

  const decode = useCallback(
    async (name: string, data: ArrayBuffer) => {
      setLoading(true);
      try {
        const encodedBytes = data.byteLength;
        setSource({ name, buffer: await ctx.decodeAudioData(data), encodedBytes });
      } finally {
        setLoading(false);
      }
    },
    [ctx],
  );

  const loadFile = useCallback(async (file: File) => decode(file.name, await file.arrayBuffer()), [decode]);
  const loadDemo = useCallback(
    async () => decode("On Green Dolphin Street (demo)", await (await fetch(encodeURI(DEMO_URL))).arrayBuffer()),
    [decode],
  );

  return { source, loading, loadFile, loadDemo };
};
