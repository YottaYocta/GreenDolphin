import { useContext, useEffect, useState } from "react";
import { Route, Routes } from "react-router";
import * as Tone from "tone";
import { Button, LoadButton } from "./components/buttons";
import { Landing } from "./Landing";
import { Loaded } from "./Loaded";
import { PlaybackProvider } from "./PlaybackProvider";
import { AudioStore, type AudioState } from "./AudioStore";
import { loadFromCache, saveToCache } from "./lib/audioCache";

async function decodeFile(
  file: File,
  setAudio: (a: AudioState) => void,
  setIsCached: (v: boolean) => void
) {
  const newAudioContext = new Tone.Context();
  const newData = await newAudioContext.decodeAudioData(
    await file.arrayBuffer()
  );
  Tone.setContext(newAudioContext);
  try {
    await saveToCache(file);
    setIsCached(true);
  } catch {
    setIsCached(false);
  }
  setAudio({
    audioCtx: newAudioContext.rawContext as AudioContext,
    buffer: newData,
    filename: file.name,
    fileSize: file.size,
  });
}

function AudioLoader() {
  const { setAudio, setIsCached } = useContext(AudioStore);
  const [cachedFile, setCachedFile] = useState<File | null>(null);

  useEffect(() => {
    loadFromCache()
      .then((cached) => setCachedFile(cached))
      .catch(() => {});
  }, []);

  return (
    <div className="w-screen h-screen flex items-center justify-center bg-neutral-100">
      <div className="bg-white border border-neutral-200 rounded shadow-md p-8 flex flex-col gap-4 items-center">
        <p className="text-neutral-600">Load a recording to begin</p>
        <LoadButton
          handleLoaded={(file) => decodeFile(file, setAudio, setIsCached)}
        />
        {cachedFile && (
          <Button
            text={cachedFile.name}
            onClick={() => decodeFile(cachedFile, setAudio, setIsCached)}
          />
        )}
      </div>
    </div>
  );
}

function AppView() {
  const { audio, setAudio, setIsCached } = useContext(AudioStore);

  if (!audio) return <AudioLoader />;

  return (
    <div className="w-screen h-screen flex flex-col items-center justify-center bg-white md:bg-neutral-100 md:p-0 pt-2">
      <div className="w-full h-full flex flex-col items-center justify-between md:justify-center md:pb-0 pb-4">
        <div className="md:absolute z-10 right-3 top-3 h-min w-min">
          <LoadButton
            handleLoaded={(file) => decodeFile(file, setAudio, setIsCached)}
          />
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
