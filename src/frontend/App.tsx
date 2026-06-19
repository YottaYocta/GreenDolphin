import { useContext, useEffect } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router";
import { Landing } from "./Landing";
import { Loaded } from "./Loaded";
import { PlaybackProvider } from "./playback/PlaybackProvider";
import { AudioStore } from "./AudioStore";
import { useAlwaysAwake } from "./lib/useAlwaysAwake";
import { AlwaysAwakeIndicator } from "./components/AlwaysAwakeIndicator";
import { RecordingsStore } from "./RecordingsStore";
import { useDecodeFile } from "./lib/useDecodeFile";
import { clearSession, loadSession } from "./lib/useSessionPersistence";

function SessionRestorer() {
  const { cachedFiles } = useContext(RecordingsStore);
  const { audio } = useContext(AudioStore);
  const decodeFile = useDecodeFile();
  const navigate = useNavigate();

  useEffect(() => {
    if (audio || cachedFiles.length === 0) return;
    const session = loadSession();
    if (!session?.filename) return;
    const file = cachedFiles.find((f) => f.name === session.filename);
    if (!file) {
      clearSession();
      return;
    }
    decodeFile(file)
      .then(() => navigate("/app"))
      .catch((e) => {
        clearSession();
        console.error(e);
      });
  }, [audio, cachedFiles, decodeFile, navigate]);

  return null;
}

function AppView() {
  const { audio } = useContext(AudioStore);
  const { activate, method, wakeLockError, videoError } = useAlwaysAwake();

  if (!audio) return <Navigate to="/" replace />;

  return (
    <div className="w-screen h-screen max-h-full flex flex-col items-center justify-center">
      <AlwaysAwakeIndicator
        method={method}
        wakeLockError={wakeLockError}
        videoError={videoError}
      />
      <PlaybackProvider context={audio.audioCtx} data={audio.buffer}>
        <Loaded onMounted={activate} />
      </PlaybackProvider>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <>
            <SessionRestorer />
            <Landing />
          </>
        }
      />
      <Route path="/app" element={<AppView />} />
    </Routes>
  );
}
