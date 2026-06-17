import { useContext } from "react";
import { Navigate, Route, Routes } from "react-router";
import { Landing } from "./Landing";
import { Loaded } from "./Loaded";
import { PlaybackProvider } from "./playback/PlaybackProvider";
import { AudioStore } from "./AudioStore";
import { useAlwaysAwake } from "./lib/useAlwaysAwake";
import { AlwaysAwakeIndicator } from "./components/AlwaysAwakeIndicator";

function AppView({ activate }: { activate: () => void }) {
  const { audio } = useContext(AudioStore);

  if (!audio) return <Navigate to="/" replace />;

  return (
    <div className="w-screen h-screen flex flex-col items-center justify-center bg-neutral-100">
      <PlaybackProvider context={audio.audioCtx} data={audio.buffer}>
        <Loaded onMounted={activate} />
      </PlaybackProvider>
    </div>
  );
}

export default function App() {
  const { activate, method, wakeLockError, videoError } = useAlwaysAwake();

  return (
    <>
      <AlwaysAwakeIndicator method={method} wakeLockError={wakeLockError} videoError={videoError} />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/app" element={<AppView activate={activate} />} />
      </Routes>
    </>
  );
}
