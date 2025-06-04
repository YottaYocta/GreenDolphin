import { useEffect, useRef, useState } from "react";
import { LoadButton } from "./components/buttons";
import { renderWaveform } from "./lib/waveform";

function App() {
  const audioContext = new AudioContext();
  const [audioData, setAudioData] = useState<AudioBuffer | undefined>(
    undefined
  );

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleLoaded = (file: File) => {
    const fileReader = new FileReader();
    fileReader.addEventListener("loadend", async () => {
      if (fileReader.result instanceof ArrayBuffer)
        setAudioData(await audioContext.decodeAudioData(fileReader.result));
    });
    fileReader.readAsArrayBuffer(file);
  };

  useEffect(() => {
    if (audioData && canvasRef.current) {
      const range = { start: 0, end: audioData.length };
      renderWaveform(
        { data: audioData, range: range },
        { resolution: 10000 },
        canvasRef.current
      );
    }
  }, [audioData]);

  return audioData ? (
    <div className="w-screen h-screen flex items-center justify-center">
      <canvas
        width={800}
        height={200}
        ref={canvasRef}
        className="border rounded-xs border-neutral-300 pixelated"
      ></canvas>
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
