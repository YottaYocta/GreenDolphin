import { useState } from "react";
import { LoadButton } from "./components/buttons";
import type { AppState } from "./lib/types";
import { Loaded } from "./Loaded";

function App() {
  const [audioContext] = useState(new AudioContext());
  const [appState, setAppState] = useState<AppState | undefined>();

  const handleLoaded = (file: File) => {
    const fileReader = new FileReader();
    fileReader.addEventListener("loadend", async () => {
      if (fileReader.result instanceof ArrayBuffer) {
        const newData = await audioContext.decodeAudioData(fileReader.result);
        const newAppState: AppState = {
          data: newData,
          filename: file.name,
        };
        setAppState(newAppState);
      }
    });
    fileReader.readAsArrayBuffer(file);
  };

  return appState ? (
    <div className="w-screen h-screen flex items-center justify-center bg-neutral-50">
      <div className="w-full h-full flex items-center justify-center md:pb-16">
        <Loaded state={appState}></Loaded>
      </div>
      <div className="absolute z-10 right-2 top-2 h-min w-min">
        <LoadButton handleLoaded={handleLoaded}></LoadButton>
      </div>
    </div>
  ) : (
    <div className="w-screen h-screen flex items-center justify-center">
      <div className="w-min p-8 border border-neutral-300 rounded-xs flex flex-col justify-center items-center">
        <LoadButton handleLoaded={handleLoaded}></LoadButton>
      </div>
    </div>
  );
}

export default App;
