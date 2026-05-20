import { useContext, useState } from "react";
import { Navigate, Route, Routes } from "react-router";
import * as Tone from "tone";
import { LoadButton } from "./components/buttons";
import { Tutorial } from "./components/Tutorial";
import { Landing } from "./Landing";
import { Loaded } from "./Loaded";
import { PlaybackProvider } from "./PlaybackProvider";
import { AudioStore } from "./AudioStore";

function AppView() {
  const { audio, setAudio } = useContext(AudioStore);
  const [showTutorial, setShowTutorial] = useState(
    localStorage.getItem("tutorial_shown") !== "true"
  );

  if (!audio) return <Navigate to="/" replace />;

  const handleLoaded = (file: File) => {
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

  return (
    <div className="w-screen h-screen flex flex-col items-center justify-center bg-white md:bg-neutral-100 md:p-0 pt-2">
      <div className="w-full h-full flex flex-col items-center justify-between md:justify-center md:pb-0 pb-4">
        <div className="md:absolute z-10 right-3 top-3 h-min w-min">
          <LoadButton handleLoaded={handleLoaded} />
        </div>
        <PlaybackProvider context={audio.audioCtx} data={audio.buffer}>
          <Loaded />
        </PlaybackProvider>
        {showTutorial && (
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
          />
        )}
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
