import { useCallback, useContext } from "react";
import { AudioStore } from "../AudioStore";
import { saveToCache } from "./audioCache";

export function useDecodeFile() {
  const { setAudio } = useContext(AudioStore);
  return useCallback(
    async (file: File) => {
      const ctx = new AudioContext();
      const buffer = await ctx.decodeAudioData(await file.arrayBuffer());
      setAudio({
        audioCtx: ctx,
        buffer,
        filename: file.name,
        fileSize: file.size,
      });
      saveToCache(file).catch(() => {});
    },
    [setAudio]
  );
}
