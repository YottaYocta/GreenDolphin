import { useContext, useEffect } from "react";
import { AudioStore } from "./AudioStore";
import { RecordingsStore } from "./RecordingsStore";
import { useDecodeFile } from "./lib/useDecodeFile";
import { clearSession, loadSession } from "./lib/useSessionPersistence";

export function SessionRestorer() {
  const { cachedFiles } = useContext(RecordingsStore);
  const { audio } = useContext(AudioStore);
  const decodeFile = useDecodeFile();

  useEffect(() => {
    if (audio || cachedFiles.length === 0) return;
    const session = loadSession();
    if (!session?.filename) return;
    const file = cachedFiles.find((f) => f.name === session.filename);
    if (!file) {
      clearSession();
      return;
    }
    decodeFile(file).catch((e) => {
      clearSession();
      console.error(e);
    });
  }, [audio, cachedFiles, decodeFile]);

  return null;
}
