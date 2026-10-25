import { useCallback, useEffect, useState } from "react";
import { loadAllFromCache, loadMetaFromCache, saveToCache } from "../../src/frontend/lib/audioCache";

export const DEMO_URL = "/Wynton Kelly - On Green Dolphin Street.mp3";

export interface AudioSource {
  name: string;
  buffer: AudioBuffer;
  /** Encoded size, to compare against decoded memory. */
  encodedBytes: number;
}

/** Most recently opened file, from the app's IndexedDB cache (scoped to this origin). */
const loadLatest = async () => {
  const [files, meta] = await Promise.all([loadAllFromCache(), loadMetaFromCache()]);
  const at = (f: File) => meta.get(f.name)?.uploadedAt ?? 0;
  return files.sort((a, b) => at(b) - at(a))[0];
};

export const useAudioSource = (ctx: AudioContext) => {
  const [source, setSource] = useState<AudioSource | null>(null);
  const [loading, setLoading] = useState(false);

  const decode = useCallback(
    async (file: File) => {
      setLoading(true);
      try {
        const data = await file.arrayBuffer();
        setSource({ name: file.name, buffer: await ctx.decodeAudioData(data), encodedBytes: data.byteLength });
      } finally {
        setLoading(false);
      }
    },
    [ctx],
  );

  const loadFile = useCallback(
    async (file: File) => {
      await saveToCache(file);
      await decode(file);
    },
    [decode],
  );
  const loadDemo = useCallback(async () => {
    const blob = await (await fetch(encodeURI(DEMO_URL))).blob();
    await loadFile(new File([blob], "On Green Dolphin Street (demo).mp3", { type: blob.type }));
  }, [loadFile]);

  useEffect(() => {
    loadLatest().then((file) => file && decode(file));
  }, [decode]);

  return { source, loading, loadFile, loadDemo };
};
