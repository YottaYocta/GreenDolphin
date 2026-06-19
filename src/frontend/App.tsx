import { useContext } from "react";
import { SpinnerIcon } from "@phosphor-icons/react";
import { Landing } from "./Landing";
import { Loaded } from "./Loaded";
import { PlaybackProvider } from "./playback/PlaybackProvider";
import { AudioStore } from "./AudioStore";
import { useAlwaysAwake } from "./lib/useAlwaysAwake";
import { AlwaysAwakeIndicator } from "./components/AlwaysAwakeIndicator";
import { loadSession } from "./lib/useSessionPersistence";
import { SessionRestorer } from "./SessionRestorer";

function AppView() {
  const { audio } = useContext(AudioStore);
  const { activate, method, wakeLockError, videoError } = useAlwaysAwake();

  if (!audio) return null;

  const session = loadSession();
  const initialSettings =
    session?.filename === audio.filename ? session.audioSettings : undefined;

  return (
    <div className="w-screen h-screen max-h-full flex flex-col items-center justify-center">
      <AlwaysAwakeIndicator
        method={method}
        wakeLockError={wakeLockError}
        videoError={videoError}
      />
      <PlaybackProvider
        context={audio.audioCtx}
        data={audio.buffer}
        initialSettings={initialSettings}
      >
        <Loaded onMounted={activate} />
      </PlaybackProvider>
    </div>
  );
}

export default function App() {
  const { isLoading, audio } = useContext(AudioStore);

  if (isLoading) {
    return (
      <div className="w-screen h-screen flex items-center justify-center">
        <SpinnerIcon size={32} className="animate-spin opacity-40" />
      </div>
    );
  }

  if (audio) return <AppView />;

  return (
    <>
      <SessionRestorer />
      <Landing />
    </>
  );
}
