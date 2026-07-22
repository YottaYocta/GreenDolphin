import { useContext } from "react";
import { SpinnerIcon } from "@phosphor-icons/react";
import { Landing } from "./Landing";
import { Editor } from "./Editor";
import { PlaybackProvider } from "./playback/PlaybackProvider";
import { AudioStore } from "./AudioStore";
import { loadSession } from "./lib/useSessionPersistence";
import { SessionRestorer } from "./SessionRestorer";
import { DevDrawer } from "./components/DevDrawer";

function AppView() {
  const { audio } = useContext(AudioStore);

  if (!audio) return null;

  const session = loadSession();
  const initialSettings =
    session?.filename === audio.filename ? session.audioSettings : undefined;

  return (
    <div className="w-screen h-screen max-h-full flex flex-col items-center justify-center">
      <PlaybackProvider
        context={audio.audioCtx}
        data={audio.buffer}
        initialSettings={initialSettings}
      >
        <Editor />
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

  if (audio)
    return (
      <>
        <AppView />
        <DevDrawer />
      </>
    );

  return (
    <>
      <SessionRestorer />
      <Landing />
      <DevDrawer />
    </>
  );
}
