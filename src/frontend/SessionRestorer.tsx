import { useContext, useEffect } from "react";
import { AudioStore } from "./AudioStore";
import { RecordingsStore } from "./RecordingsStore";
import { useDecodeFile } from "./lib/useDecodeFile";
import { clearSession, loadSession } from "./lib/useSessionPersistence";
import { isYouTubeFile, readYouTubeFile } from "./lib/youtubeFile";

export function SessionRestorer() {
  const { cachedFiles } = useContext(RecordingsStore);
  const { audio, video, setVideo } = useContext(AudioStore);
  const decodeFile = useDecodeFile();

  useEffect(() => {
    if (audio || video || cachedFiles.length === 0) return;
    const session = loadSession();
    if (!session?.filename) return;
    const file = cachedFiles.find((f) => f.name === session.filename);
    if (!file) {
      clearSession();
      return;
    }
    if (isYouTubeFile(file)) {
      readYouTubeFile(file)
        .then(({ videoId }) => setVideo({ videoId, filename: file.name }))
        .catch((e) => {
          clearSession();
          console.error(e);
        });
      return;
    }
    decodeFile(file).catch((e) => {
      clearSession();
      console.error(e);
    });
  }, [audio, video, cachedFiles, decodeFile, setVideo]);

  return null;
}
