import { useContext, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useDecodeFile } from "./lib/useDecodeFile";
import { RecordingsStore } from "./RecordingsStore";
import { noteColor, relativeDate, formatSize } from "./lib/util";
function MusicNoteIcon({ color = "#000000" }: { color?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="32"
      height="32"
      viewBox="0 0 256 256"
      fill={color}
      style={{ opacity: 0.7, flexShrink: 0 }}
    >
      <path d="M210.3,56.34l-80-24A8,8,0,0,0,120,40V148.26A48,48,0,1,0,136,184V98.75l69.7,20.91A8,8,0,0,0,216,112V64A8,8,0,0,0,210.3,56.34Z" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="32"
      height="32"
      fill="#1CCA93"
      viewBox="0 0 256 256"
      style={{ width: 24, height: "auto", overflow: "visible", flexShrink: 0 }}
    >
      <path d="M240,128a15.74,15.74,0,0,1-7.6,13.51L88.32,229.65a16,16,0,0,1-16.2.3A15.86,15.86,0,0,1,64,216.13V39.87a15.86,15.86,0,0,1,8.12-13.82,16,16,0,0,1,16.2.3L232.4,114.49A15.74,15.74,0,0,1,240,128Z" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="animate-spin opacity-40 shrink-0"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

function RecordingRow({
  file,
  uploadedAt,
  onPlay,
  onDelete,
}: {
  file: File;
  uploadedAt: number | undefined;
  onPlay: () => Promise<void>;
  onDelete: () => void;
}) {
  const [isLoading, setIsLoading] = useState(false);

  const handlePlay = async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      await onPlay();
    } catch (e) {
      console.error(e);
      setIsLoading(false);
    }
  };

  return (
    <article
      data-loading={isLoading}
      className="group flex items-center gap-6 w-full rounded-lg p-4 bg-white cursor-pointer max-md:flex-col max-md:items-start"
      onClick={handlePlay}
    >
      <div className="w-15 h-15 flex overflow-clip rounded-sm items-center justify-center [box-shadow:#FFFFFF_0px_2px_3px_1px_inset,#0000000D_0px_2px_3px] bg-[#fafafa] border border-[#0000001A] transition-transform duration-150 hover:rotate-4 origin-center">
        <MusicNoteIcon color={noteColor(file.name)} />
      </div>

      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        <span className="font-inria font-bold text-black text-base/5 max-md:wrap-break-word max-md:max-w-full md:truncate">
          {file.name}
        </span>
        <span className="opacity-50 font-inria text-black text-base/5 max-w-full">
          {formatSize(file.size)}
        </span>
      </div>

      <div className="flex-1 min-w-0 flex flex-col gap-1.5 pl-6 max-md:pl-0">
        <span className="font-inria font-bold text-black text-base/5">
          {uploadedAt != null ? relativeDate(uploadedAt) : ""}
        </span>
        <button
          className="opacity-50 font-inria text-black text-base/5 text-left w-fit hover:opacity-100 hover:text-red-500"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          Remove
        </button>
      </div>

      <button
        disabled={isLoading}
        onClick={(e) => {
          e.stopPropagation();
          handlePlay();
        }}
        className="btn-surface w-41.5 h-12 shrink-0 opacity-0 group-hover:opacity-100 group-data-[loading=true]:opacity-100 disabled:cursor-default transition-opacity duration-100 max-md:opacity-100"
      >
        {isLoading ? <Spinner /> : <PlayIcon />}
      </button>
    </article>
  );
}

export function Landing() {
  const decodeFile = useDecodeFile();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { cachedFiles, fileMeta, deleteFile, cacheFile } =
    useContext(RecordingsStore);
  const [isUploading, setIsUploading] = useState(false);

  const handlePlay = async (file: File) => {
    await decodeFile(file);
    navigate("/app");
  };

  const handleUpload = async (file: File) => {
    setIsUploading(true);
    try {
      await decodeFile(file);
      await cacheFile(file);
      navigate("/app");
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file).catch(console.error);
    e.target.value = "";
  };

  return (
    <main className="[font-synthesis:none] min-h-screen flex flex-col items-center px-4 max-md:py-4 py-20 bg-[#F8F8F8] antialiased">
      <div className="flex flex-col items-center gap-10 w-full max-w-3xl">
        <div className="flex items-start self-stretch">
          <div className="flex flex-col items-start flex-1 rounded-lg overflow-clip bg-white">
            <div className="w-full h-32 bg-emerald-500 shrink-0" />
            <div className="flex flex-col items-start gap-6 px-6 pb-8">
              <img
                src="/favicon/favicon.svg"
                alt="GreenDolphin"
                className="-mt-18 w-24 h-24 rounded-[9px] shrink-0 border border-[#ffffff1A] [box-shadow:#FFFFFF_0px_0px_3px_1px_inset,#0000000D_0px_3px_4px] bg-white object-contain"
              />
              <h1 className="font-inria font-bold text-black text-2xl">
                Welcome to GreenDolphin!
              </h1>
              <div className="flex items-start gap-4 flex-col sm:flex-row w-full max-md:gap-8">
                <p className="flex-1 opacity-50 font-inria text-black text-base/5 text-pretty leading-6">
                  GreenDolphin is an open-source recording looper built for
                  musicians who want to transcribe music or learn songs by ear.
                </p>
                <p className="flex-1 opacity-50 font-inria text-black text-base/5 text-pretty leading-6">
                  It lets you loop short sections of audio, visualize
                  frequencies in real time, and load local audio files. It works
                  offline.
                </p>
              </div>
            </div>
          </div>
        </div>

        <section className="flex flex-col items-start gap-5 self-stretch">
          <header className="flex items-center gap-4 justify-between self-stretch">
            <h2 className="font-inria font-bold text-black text-2xl/8">
              My Recordings
            </h2>
            <button
              disabled={isUploading}
              className="btn-surface gap-3 px-5 h-12 shrink-0 disabled:opacity-60 disabled:cursor-not-allowed"
              onClick={() => !isUploading && fileInputRef.current?.click()}
            >
              {isUploading ? (
                <Spinner />
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="32"
                  height="32"
                  viewBox="0 0 256 256"
                  style={{ width: 20, opacity: 0.5, flexShrink: 0 }}
                >
                  <path d="M232,48a8,8,0,0,1-8,8H208V72a8,8,0,0,1-16,0V56H176a8,8,0,0,1,0-16h16V24a8,8,0,0,1,16,0V40h16A8,8,0,0,1,232,48ZM160.6,77.86l-6.76-6.76A32.85,32.85,0,0,1,144,49.33a31.87,31.87,0,0,1,1.67-11.66,4,4,0,0,0-4.76-5.14L78.06,48.25A8,8,0,0,0,72,56V166.1A36,36,0,1,0,52.42,232C72.25,231.77,88,215.13,88,195.3V102.25l70.74-17.69A4,4,0,0,0,160.6,77.86Zm50.11,24.31a31.91,31.91,0,0,1-7.14,1.63,4,4,0,0,0-3.57,4V134.1A36,36,0,1,0,180.42,200c19.83-.23,35.58-16.86,35.58-36.7V106A4,4,0,0,0,210.71,102.17Z" />
                </svg>
              )}
              <span className="opacity-40 font-inria text-black text-base/5 whitespace-nowrap">
                {isUploading ? "Processing…" : "Upload File"}
              </span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="*"
              className="hidden"
              onChange={handleFileChange}
            />
          </header>

          <div className="flex flex-col items-start gap-2 self-stretch">
            {cachedFiles.length === 0 ? (
              <p className="w-full rounded-lg px-6 py-8 bg-white text-center opacity-50 font-inria text-black text-base/5">
                No recordings yet. Upload a file to get started.
              </p>
            ) : (
              cachedFiles.map((file) => (
                <RecordingRow
                  key={file.name}
                  file={file}
                  uploadedAt={fileMeta.get(file.name)?.uploadedAt}
                  onPlay={() => handlePlay(file)}
                  onDelete={() => {
                    deleteFile(file.name);
                  }}
                />
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
