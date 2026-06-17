import { useContext } from "react";
import { Navigate, Route, Routes } from "react-router";
import { Landing } from "./Landing";
import { Loaded } from "./Loaded";
import { PlaybackProvider } from "./playback/PlaybackProvider";
import { AudioStore } from "./AudioStore";
import { useAlwaysAwake } from "./lib/useAlwaysAwake";
import { AlwaysAwakeIndicator } from "./components/AlwaysAwakeIndicator";

function AppView() {
  const { audio } = useContext(AudioStore);

  if (!audio) return <Navigate to="/" replace />;

  return (
    <div className="w-screen h-screen flex flex-col items-center justify-center bg-neutral-100">
      <PlaybackProvider context={audio.audioCtx} data={audio.buffer}>
        <Loaded />
      </PlaybackProvider>
    </div>
  );
}

export default function App() {
  const { activate, status, error } = useAlwaysAwake();

  return (
    <div onClick={activate} onTouchStart={activate}>
      <AlwaysAwakeIndicator status={status} error={error} />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/app" element={<AppView />} />
      </Routes>
    </div>
  );
}
