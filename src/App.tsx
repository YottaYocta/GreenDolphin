import { useState } from "react";
import { LoadButton } from "./components/buttons";
import { Loaded, type LoadedProps } from "./Loaded";
import { Landing } from "./Landing";
import {
  PlaybackProvider,
  type PlaybackProviderProps,
} from "./PlaybackProvider";
import * as Tone from "tone";

function App() {
  const [loadedProps, setLoadedProps] = useState<LoadedProps | undefined>();
  const [playbackProps, setPlaybackProps] = useState<
    PlaybackProviderProps | undefined
  >();

  const handleLoaded = (file: File) => {
    const fileReader = new FileReader();
    fileReader.addEventListener("loadend", async () => {
      if (fileReader.result instanceof ArrayBuffer) {
        const newAudioContext = new Tone.Context();
        console.log(`[${new Date().toTimeString()}] AudioContext Created`);
        console.log(`[${new Date().toTimeString()}] Start Loading File`);
        const newData = await newAudioContext.decodeAudioData(
          fileReader.result
        );
        console.log(
          `[${new Date().toTimeString()}] Finished Loading Audio File!`
        );
        console.log(`[${new Date().toTimeString()}] Starting Tone.js`);
        Tone.setContext(newAudioContext);
        console.log(`[${new Date().toTimeString()}] Tone.js Started`);
        setLoadedProps({
          data: newData,
          filename: file.name,
        });
        setPlaybackProps({
          context: newAudioContext.rawContext as AudioContext,
          data: newData,
        });
      }
    });
    fileReader.readAsArrayBuffer(file);
  };

  return loadedProps && playbackProps ? (
    <div className="w-screen h-screen flex items-center justify-center bg-neutral-100">
      <div className="w-full h-full flex items-center justify-center md:pb-8">
        <PlaybackProvider {...playbackProps}>
          <Loaded {...loadedProps}></Loaded>
        </PlaybackProvider>
      </div>
      <div className="absolute z-10 right-3 top-3 h-min w-min">
        <LoadButton handleLoaded={handleLoaded}></LoadButton>
      </div>
    </div>
  ) : (
    <Landing handleLoaded={handleLoaded}></Landing>
  );
}

export default App;
