import { useCallback, useContext } from "react";
import { AudioStore } from "../AudioStore";
import { captureException } from "./posthog";

export function useDecodeFile() {
  const { setAudio, audio, setIsLoading } = useContext(AudioStore);
  return useCallback(
    async (file: File) => {
      setIsLoading(true);
      try {
        const ctx = audio?.audioCtx ?? new AudioContext();
        const buffer = await ctx.decodeAudioData(await file.arrayBuffer());
        setAudio({
          audioCtx: ctx,
          buffer,
          filename: file.name,
          fileSize: file.size,
        });
      } catch (error) {
        captureException(error, { filename: file.name, file_type: file.type });
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [setAudio, audio, setIsLoading],
  );
}
