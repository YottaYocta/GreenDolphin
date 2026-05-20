import { useCallback, useContext } from "react";
import * as Tone from "tone";
import { AudioStore } from "../AudioStore";
import { saveToCache } from "./audioCache";

export function useDecodeFile() {
  const { setAudio, setIsCached } = useContext(AudioStore);
  return useCallback(
    async (file: File) => {
      const ctx = new Tone.Context();
      const buffer = await ctx.decodeAudioData(await file.arrayBuffer());
      Tone.setContext(ctx);
      setAudio({
        audioCtx: ctx.rawContext as AudioContext,
        buffer,
        filename: file.name,
        fileSize: file.size,
      });
      saveToCache(file)
        .then(() => setIsCached(true))
        .catch(() => setIsCached(false));
    },
    [setAudio, setIsCached]
  );
}
