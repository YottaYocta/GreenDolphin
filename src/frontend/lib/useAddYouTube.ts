import { useCallback, useContext } from "react";
import { RecordingsStore } from "../RecordingsStore";
import { AudioStore } from "../AudioStore";
import { fetchYouTubeTitle, makeYouTubeFile } from "./youtubeFile";
import { capture } from "./posthog";

// Saves a YouTube video as a .yt recording and opens it in the video editor.
export function useAddYouTubeVideo() {
  const { cacheFile } = useContext(RecordingsStore);
  const { setVideo } = useContext(AudioStore);
  return useCallback(
    async (videoId: string, url: string) => {
      const title = (await fetchYouTubeTitle(videoId)) ?? `YouTube ${videoId}`;
      const file = makeYouTubeFile({ videoId, url, title });
      await cacheFile(file);
      setVideo({ videoId, filename: file.name });
      capture("youtube_video_added", { video_id: videoId, title });
    },
    [cacheFile, setVideo],
  );
}
