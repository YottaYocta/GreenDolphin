import { useEffect, useRef, useState } from "react";
import { Button, LoadButton } from "./components/buttons";
import { renderWaveform } from "./lib/waveform";
import { formatSeconds } from "./lib/util";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ZoomInIcon,
  ZoomOut,
} from "lucide-react"; // Keep these imports for now, as they are used as icons.

function App() {
  const audioContext = new AudioContext();
  const [filename, setFileName] = useState<string>("");
  const [audioData, setAudioData] = useState<AudioBuffer | undefined>(
    undefined
  );

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const navCanvasRef = useRef<HTMLCanvasElement>(null);
  const waveformRef = useRef<HTMLCanvasElement>(null);

  const handleLoaded = (file: File) => {
    const fileReader = new FileReader();
    fileReader.addEventListener("loadend", async () => {
      if (fileReader.result instanceof ArrayBuffer) {
        setAudioData(await audioContext.decodeAudioData(fileReader.result));
        setFileName(file.name);
      }
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
    <div className="w-screen h-screen flex items-center justify-center bg-neutral-50">
      <div className="pb-24">
        <div className="w-full max-w-4xl h-min p-8 bg-white flex flex-col gap-16 border border-neutral-300 rounded-xs">
          <div className="w-full flex justify-between items-baseline border-b border-neutral-300">
            <p className="max-w-1/2 text-nowrap text-ellipsis overflow-hidden">
              {filename}
            </p>
            <p className="max-w-1/2 text-nowrap text-ellipsis overflow-hidden">
              {formatSeconds(audioData.duration)}
            </p>
          </div>
          <canvas
            width={800}
            height={100}
            ref={waveformRef}
            className="border rounded-xs border-neutral-300 pixelated w-full"
          ></canvas>
          <div className="flex flex-col gap-2">
            <canvas
              width={800}
              height={200}
              ref={canvasRef}
              className="border rounded-xs border-neutral-300 pixelated w-full"
            ></canvas>
            <div className="flex gap-2 items-center">
              <canvas
                width={800}
                height={50}
                ref={navCanvasRef}
                className="border rounded-xs border-neutral-300 pixelated w-full"
              ></canvas>
              <div className="flex border border-neutral-300 rounded-full p-1 items-center">
                <Button
                  ariaLabel="zoom in"
                  icon={
                    <ZoomInIcon
                      strokeWidth={1.5}
                      width={18}
                      height={18}
                      className="stroke-neutral-500"
                    ></ZoomInIcon>
                  }
                ></Button>
                <Button
                  ariaLabel="zoom out"
                  icon={
                    <ZoomOut
                      strokeWidth={1.5}
                      width={18}
                      height={18}
                      className="stroke-neutral-500"
                    ></ZoomOut>
                  }
                ></Button>
              </div>
              <div className="flex border border-neutral-300 rounded-full p-1 items-center">
                <Button
                  ariaLabel="zoom in"
                  icon={
                    <ChevronLeftIcon
                      strokeWidth={1.5}
                      width={18}
                      height={18}
                      className="stroke-neutral-500"
                    ></ChevronLeftIcon>
                  }
                ></Button>
                <Button
                  ariaLabel="zoom out"
                  icon={
                    <ChevronRightIcon
                      strokeWidth={1.5}
                      width={18}
                      height={18}
                      className="stroke-neutral-500"
                    ></ChevronRightIcon>
                  }
                ></Button>
              </div>
            </div>
          </div>
        </div>
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
