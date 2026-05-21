import { useContext, useEffect, useState } from "react";
import { Route, Routes } from "react-router";
import { FileAudio2, X } from "lucide-react";
import { Button, LoadButton } from "./components/buttons";
import { Landing } from "./Landing";
import { Loaded } from "./Loaded";
import { PlaybackProvider } from "./PlaybackProvider";
import { AudioStore } from "./AudioStore";
import { deleteFromCache, loadAllFromCache } from "./lib/audioCache";
import { useDecodeFile } from "./lib/useDecodeFile";

function AudioLoader() {
  const decodeFile = useDecodeFile();
  const [cachedFiles, setCachedFiles] = useState<File[]>([]);

  useEffect(() => {
    let mounted = true;
    loadAllFromCache()
      .then((files) => { if (mounted) setCachedFiles(files); })
      .catch(() => {});
    return () => { mounted = false; };
  }, []);

  const handleDelete = async (filename: string) => {
    await deleteFromCache(filename).catch(() => {});
    setCachedFiles((prev) => prev.filter((f) => f.name !== filename));
  };

  const totalSize = cachedFiles.reduce((sum, f) => sum + f.size, 0);

  return (
    <div className="w-screen h-screen flex items-center justify-center bg-neutral-100">
      <div className="bg-white border border-neutral-200 rounded shadow-md p-8 flex flex-col gap-4 items-center">
        <p className="text-neutral-600">Load a recording to begin</p>
        <LoadButton handleLoaded={decodeFile} />
        {cachedFiles.length > 0 && (
          <div className="w-full flex flex-col gap-2">
            {cachedFiles.map((file) => (
              <div key={file.name} className="flex items-center gap-2">
                <Button
                  className="border-neutral-2 border pl-2 pr-3 bg-white hover:bg-neutral-50"
                  icon={<FileAudio2 width={18} height={18} strokeWidth={1.5} />}
                  text={`${file.name} · ${(file.size / 1024 / 1024).toFixed(1)} MB`}
                  onClick={() => decodeFile(file).catch(console.error)}
                />
                <Button
                  className="border-neutral-2 border bg-white hover:bg-red-50 text-neutral-500 hover:text-red-500"
                  icon={<X width={14} height={14} />}
                  ariaLabel={`Remove ${file.name} from saved recordings`}
                  onClick={() => handleDelete(file.name)}
                />
              </div>
            ))}
            <p className="text-xs text-neutral-400">
              {(totalSize / 1024 / 1024).toFixed(1)} MB total saved to browser
            </p>
          </div>
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
