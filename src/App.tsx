import { useState } from "react";
import { LoadButton } from "./components/buttons";
import { Loaded, type LoadedProps } from "./Loaded";

function App() {
  const [loadedProps, setLoadedProps] = useState<LoadedProps | undefined>();

  const handleLoaded = (file: File) => {
    const fileReader = new FileReader();
    fileReader.addEventListener("loadend", async () => {
      if (fileReader.result instanceof ArrayBuffer) {
        if (loadedProps?.audioContext) {
          loadedProps.audioContext.close();
        }
        const newAudioContext = new AudioContext();
        const newData = await newAudioContext.decodeAudioData(
          fileReader.result
        );
        setLoadedProps({
          data: newData,
          filename: file.name,
          audioContext: newAudioContext,
        });
      }
    });
    fileReader.readAsArrayBuffer(file);
  };

  return loadedProps ? (
    <div className="w-screen h-screen flex items-center justify-center bg-neutral-50">
      <div className="w-full h-full flex items-center justify-center md:pb-16">
        <Loaded {...loadedProps}></Loaded>
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
