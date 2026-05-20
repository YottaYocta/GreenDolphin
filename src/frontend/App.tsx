import { useContext } from "react";
import { Route, Routes } from "react-router";
import * as Tone from "tone";
import { LoadButton } from "./components/buttons";
import { Landing } from "./Landing";
import { Loaded } from "./Loaded";
import { PlaybackProvider } from "./PlaybackProvider";
import { AudioStore, type AudioState } from "./AudioStore";

function makeHandleLoaded(setAudio: (a: AudioState) => void) {
  return (file: File) => {
    const fileReader = new FileReader();
    fileReader.addEventListener("loadend", async () => {
      if (fileReader.result instanceof ArrayBuffer) {
        const newAudioContext = new Tone.Context();
        const newData = await newAudioContext.decodeAudioData(
          fileReader.result
        );
        Tone.setContext(newAudioContext);
        setAudio({
          audioCtx: newAudioContext.rawContext as AudioContext,
          buffer: newData,
          filename: file.name,
        });
      }
    });
    fileReader.readAsArrayBuffer(file);
  };
}

function AudioLoader() {
  const { setAudio } = useContext(AudioStore);
  return (
    <div className="w-screen h-screen flex items-center justify-center bg-neutral-100">
      <div className="bg-white border border-neutral-200 rounded shadow-md p-8 flex flex-col gap-4 items-center">
        <p className="text-neutral-600">Load a recording to begin</p>
        <LoadButton handleLoaded={makeHandleLoaded(setAudio)} />
      </div>
    </div>
  );
}

function AppView() {
  const { audio, setAudio } = useContext(AudioStore);

  if (!audio) return <AudioLoader />;

  return (
    <div className="w-screen h-screen flex flex-col items-center justify-center bg-white md:bg-neutral-100 md:p-0 pt-2">
      <div className="w-full h-full flex flex-col items-center justify-between md:justify-center md:pb-0 pb-4">
        <div className="md:absolute z-10 right-3 top-3 h-min w-min">
          <LoadButton handleLoaded={makeHandleLoaded(setAudio)} />
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
