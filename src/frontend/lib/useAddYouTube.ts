import { useCallback, useContext } from "react";
import { RecordingsStore } from "../RecordingsStore";
import { AudioStore } from "../AudioStore";
import { lookupYouTubeVideo, makeYouTubeFile } from "./youtubeFile";
import { capture } from "./posthog";

export class YouTubeAddError extends Error {}

export function useAddYouTubeVideo() {
  const { cacheFile } = useContext(RecordingsStore);
  const { setVideo } = useContext(AudioStore);
  return useCallback(
    async (videoId: string, url: string) => {
      const lookup = await lookupYouTubeVideo(videoId);
      if (lookup.status === "not-embeddable")
        throw new YouTubeAddError(
          "The owner of this video doesn't allow it to be played outside YouTube.",
        );
      if (lookup.status === "private")
        throw new YouTubeAddError("This video is private.");
      if (lookup.status === "not-found")
        throw new YouTubeAddError("Couldn't find a video at that link.");
      const title =
        (lookup.status === "ok" ? lookup.title : null) ?? `YouTube ${videoId}`;
      const file = makeYouTubeFile({ videoId, url, title });
      await cacheFile(file);
      setVideo({ videoId, filename: file.name });
      capture("youtube_video_added", { video_id: videoId, title });
    },
    [cacheFile, setVideo],
  );
}
