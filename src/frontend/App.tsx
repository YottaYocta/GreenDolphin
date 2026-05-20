import { useContext, useEffect, useState } from "react";
import { Route, Routes } from "react-router";
import { Button, LoadButton } from "./components/buttons";
import { Landing } from "./Landing";
import { Loaded } from "./Loaded";
import { PlaybackProvider } from "./PlaybackProvider";
import { AudioStore } from "./AudioStore";
import { loadFromCache } from "./lib/audioCache";
import { useDecodeFile } from "./lib/useDecodeFile";

function AudioLoader() {
  const decodeFile = useDecodeFile();
  const [cachedFile, setCachedFile] = useState<File | null>(null);

  useEffect(() => {
    let mounted = true;
    loadFromCache()
      .then((cached) => { if (mounted) setCachedFile(cached); })
      .catch(() => {});
    return () => { mounted = false; };
  }, []);

  return (
    <div className="w-screen h-screen flex items-center justify-center bg-neutral-100">
      <div className="bg-white border border-neutral-200 rounded shadow-md p-8 flex flex-col gap-4 items-center">
        <p className="text-neutral-600">Load a recording to begin</p>
        <LoadButton handleLoaded={decodeFile} />
        {cachedFile && (
          <Button
            text={cachedFile.name}
            onClick={() => decodeFile(cachedFile).catch(console.error)}
          />
        )}
      </div>
    </div>
  );
}

function AppView() {
  const { audio } = useContext(AudioStore);
  const decodeFile = useDecodeFile();

  if (!audio) return <AudioLoader />;

  return (
    <div className="w-screen h-screen flex flex-col items-center justify-center bg-white md:bg-neutral-100 md:p-0 pt-2">
      <div className="w-full h-full flex flex-col items-center justify-between md:justify-center md:pb-0 pb-4">
        <div className="md:absolute z-10 right-3 top-3 h-min w-min">
          <LoadButton handleLoaded={decodeFile} />
        </div>
        <PlaybackProvider context={audio.audioCtx} data={audio.buffer}>
          <Loaded />
        </PlaybackProvider>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/app" element={<AppView />} />
    </Routes>
  );
}
