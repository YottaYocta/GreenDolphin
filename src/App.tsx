import { useState } from "react";
import { LoadButton } from "./components/buttons";
import { Loaded, type LoadedProps } from "./Loaded";
import { Landing } from "./Landing";

import {
  PlaybackProvider,
  type PlaybackProviderProps,
} from "./PlaybackProvider";
import * as Tone from "tone";
import { Tutorial } from "./components/Tutorial";

function App() {
  const [loadedProps, setLoadedProps] = useState<LoadedProps | undefined>();
  const [playbackProps, setPlaybackProps] = useState<
    PlaybackProviderProps | undefined
  >();

  const [showTutorial, setShowTutorial] = useState(
    localStorage.getItem("tutorial_shown") === "true" ? false : true
  );

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
    <div className="w-screen h-screen flex flex-col items-center justify-center bg-white md:bg-neutral-100 md:p-0 pt-2">
      <div className="w-full h-full flex flex-col items-center justify-between md:justify-center md:pb-0 pb-4">
        <div className="md:absolute z-10 right-3 top-3 h-min w-min">
          <LoadButton handleLoaded={handleLoaded}></LoadButton>
        </div>
        <PlaybackProvider {...playbackProps}>
          <Loaded {...loadedProps}></Loaded>
        </PlaybackProvider>

        {showTutorial ? (
          <Tutorial
            handleTutorialFinished={() => {
              setShowTutorial(false);
              localStorage.setItem("tutorial_shown", "true");
            }}
            steps={[
              {
                htmlSelector: "#playback-controls",
                contents: (
                  <p>
                    Controls playback. Hover to see function and shortcut on
                    desktop browsers.
                  </p>
                ),
              },
              {
                htmlSelector: "#recording-properties",
                contents: <p>Adjust pitch, speed, and volume.</p>,
              },
              {
                htmlSelector: "#reset-pitch",
                contents: <p>Click to reset to default</p>,
              },
              {
                htmlSelector: "#waveform-view",
                contents: (
                  <p>
                    Click to select playback start point. Drag to select loop.
                    Scroll to zoom. Pan to move backwards/forwards
                  </p>
                ),
              },
              {
                htmlSelector: "#waveform-controls",
                contents: (
                  <p>
                    You can also use these controls to navigate around the
                    recording.
                  </p>
                ),
              },
            ]}
          ></Tutorial>
        ) : (
          <></>
        )}
      </div>
    </div>
  ) : (
    <Landing handleLoaded={handleLoaded}></Landing>
  );
}

export default App;
