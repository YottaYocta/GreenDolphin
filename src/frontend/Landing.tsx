import { useContext, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useDecodeFile } from "./lib/useDecodeFile";
import { RecordingsStore } from "./RecordingsStore";
import { noteColor, relativeDate } from "./lib/util";

function MusicNoteIcon({ color = "var(--color-icon)" }: { color?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="32"
      height="32"
      viewBox="0 0 256 256"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <path
        d="M210.3,56.34l-80-24A8,8,0,0,0,120,40V148.26A48,48,0,1,0,136,184V98.75l69.7,20.91A8,8,0,0,0,216,112V64A8,8,0,0,0,210.3,56.34Z"
        fill={color}
      />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="23"
      height="24"
      viewBox="21.333 0 245.333 256"
      aria-hidden="true"
      style={{ overflow: "visible", flexShrink: 0 }}
    >
      <path
        d="M240,128a15.74,15.74,0,0,1-7.6,13.51L88.32,229.65a16,16,0,0,1-16.2.3A15.86,15.86,0,0,1,64,216.13V39.87a15.86,15.86,0,0,1,8.12-13.82,16,16,0,0,1,16.2.3L232.4,114.49A15.74,15.74,0,0,1,240,128Z"
        fill="var(--color-play)"
      />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 192 192"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <path
        d="M162 36H132V30a18 18 0 0 0-18-18H78A18 18 0 0 0 60 30v6H30a6 6 0 0 0 0 12h6V156a12 12 0 0 0 12 12H144a12 12 0 0 0 12-12V48h6a6 6 0 0 0 0-12ZM84 126a6 6 0 0 1-12 0V78a6 6 0 0 1 12 0Zm36 0a6 6 0 0 1-12 0V78a6 6 0 0 1 12 0Zm0-90H72V30a6 6 0 0 1 6-6h36a6 6 0 0 1 6 6Z"
        fill="var(--color-neutral-2)"
      />
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
      aria-hidden="true"
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
    <article aria-label={file.name} className="self-stretch">
      {/* mobile */}
      <div className="md:hidden flex items-end gap-4 p-4 h-full">
        <div className="btn-surface min-h-full shrink-0 rounded-sm aspect-square h-full ">
          <MusicNoteIcon color={noteColor(file.name)} />
        </div>
        <div className="flex items-start gap-4 flex-col flex-1 min-w-0">
          <div className="flex flex-col items-start gap-1 self-stretch">
            <p className="truncate max-w-full">{file.name}</p>
            <p className="opacity-40">
              {uploadedAt != null ? relativeDate(uploadedAt) : ""}
            </p>
          </div>
          <div className="flex items-start gap-2 self-stretch">
            <button
              disabled={isLoading}
              onClick={handlePlay}
              aria-label={`Play ${file.name}`}
              className="btn-surface flex-1 h-10 py-3.25 disabled:cursor-default"
            >
              {isLoading ? <Spinner /> : <PlayIcon />}
            </button>
            <button
              onClick={onDelete}
              aria-label={`Delete ${file.name}`}
              className="btn-surface flex-1 h-10 py-3.25"
            >
              <DeleteIcon />
            </button>
          </div>
        </div>
      </div>

      {/* desktop */}
      <div className="max-md:hidden flex items-center gap-8 p-6 relative">
        <div className="flex items-center gap-4 w-full relative shrink-0">
          <div className="btn-surface rounded-sm w-16 aspect-square">
            <MusicNoteIcon color={noteColor(file.name)} />
          </div>
          <div className="flex items-start gap-1 flex-col justify-end flex-1 overflow-hidden">
            <p className="truncate max-w-full">{file.name}</p>
            <p className="opacity-40 text-sm">
              {uploadedAt != null ? relativeDate(uploadedAt) : ""}
            </p>
          </div>
        </div>
        <div className="flex items-start gap-2 absolute top-1/2 right-4 -translate-y-1/2">
          <button
            disabled={isLoading}
            onClick={handlePlay}
            aria-label={`Play ${file.name}`}
            className="btn-surface size-10 shrink-0 py-3.25 disabled:cursor-default"
          >
            {isLoading ? <Spinner /> : <PlayIcon />}
          </button>
          <button
            onClick={onDelete}
            aria-label={`Delete ${file.name}`}
            className="btn-surface size-10 shrink-0 py-3.25"
          >
            <DeleteIcon />
          </button>
        </div>
      </div>
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

  const triggerUpload = () => fileInputRef.current?.click();

  return (
    <main className="[font-synthesis:none] min-h-screen flex flex-col items-center px-4 py-8 bg-surface-track antialiased max-h-screen h-screen overflow-hidden font-inria text-black text-base/5">
      <div className="flex flex-col items-center justify-center gap-5 w-full max-w-2xl flex-1 min-h-0 h-full md:py-24 md:pb-48">
        <header className="flex max-md:flex-col max-md:items-start max-md:pl-4 max-md:gap-4 items-center gap-4 self-stretch rounded-[18px] p-4 justify-center max-md:flex-1">
          <img
            src="/favicon/favicon.svg"
            alt="GreenDolphin logo"
            className="w-20 aspect-square rounded-[9px] shrink-0 shadow-drop border border-border object-contain bg-white"
          />
          <div className="flex items-start flex-col justify-center gap-1 max-md:p-0 pr-4 py-4">
            <h1 className="font-inria font-bold text-play text-[29px]/9">
              GreenDolphin
            </h1>
            <p className="font-inria text-black opacity-60 text-sm/4.5 whitespace-pre">
              Audio Looper{"  "}&{"  "}Recording Analyzer
            </p>
          </div>
        </header>

        <section
          aria-label="My Recordings"
          className="flex flex-col items-start rounded-2xl overflow-hidden self-stretch shadow-panel bg-white border border-border min-h-0 h-min max-md:flex-3"
        >
          <div className="md:hidden flex flex-col items-start self-stretch p-4 border-b border-b-border">
            <button
              disabled={isUploading}
              onClick={triggerUpload}
              className="flex overflow-clip items-center gap-2 px-5.5 py-3.25 justify-center self-stretch rounded-2xl shadow-btn bg-surface border border-border disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isUploading ? (
                <Spinner />
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="32"
                  height="32"
                  viewBox="0 0 256 256"
                  aria-hidden="true"
                  style={{ width: 20, opacity: 0.5, flexShrink: 0 }}
                >
                  <path d="M232,48a8,8,0,0,1-8,8H208V72a8,8,0,0,1-16,0V56H176a8,8,0,0,1,0-16h16V24a8,8,0,0,1,16,0V40h16A8,8,0,0,1,232,48ZM160.6,77.86l-6.76-6.76A32.85,32.85,0,0,1,144,49.33a31.87,31.87,0,0,1,1.67-11.66,4,4,0,0,0-4.76-5.14L78.06,48.25A8,8,0,0,0,72,56V166.1A36,36,0,1,0,52.42,232C72.25,231.77,88,215.13,88,195.3V102.25l70.74-17.69A4,4,0,0,0,160.6,77.86Zm50.11,24.31a31.91,31.91,0,0,1-7.14,1.63,4,4,0,0,0-3.57,4V134.1A36,36,0,1,0,180.42,200c19.83-.23,35.58-16.86,35.58-36.7V106A4,4,0,0,0,210.71,102.17Z" />
                </svg>
              )}
              <span className="opacity-40">
                {isUploading ? "Processing…" : "Upload New File +"}
              </span>
            </button>
          </div>

          <div className="w-full flex-1 min-h-0 flex flex-col overflow-y-scroll divide-y divide-border">
            {cachedFiles.length === 0 ? (
              <p className="w-full px-6 py-8 text-center opacity-40">
                No recordings yet. Upload a file to get started.
              </p>
            ) : (
              cachedFiles.map((file) => (
                <RecordingRow
                  key={file.name}
                  file={file}
                  uploadedAt={fileMeta.get(file.name)?.uploadedAt}
                  onPlay={() => handlePlay(file)}
                  onDelete={() => deleteFile(file.name)}
                />
              ))
            )}
          </div>

          <button
            disabled={isUploading}
            onClick={triggerUpload}
            className="max-md:hidden flex overflow-clip items-center gap-2 px-5.5 py-3.25 justify-center self-stretch shadow-inset-dim bg-surface border-t border-border disabled:opacity-60 disabled:cursor-not-allowed hover:bg-surface-track transition-colors"
          >
            {isUploading ? (
              <Spinner />
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="32"
                height="32"
                viewBox="0 0 256 256"
                aria-hidden="true"
                style={{ width: 20, opacity: 0.5, flexShrink: 0 }}
              >
                <path d="M232,48a8,8,0,0,1-8,8H208V72a8,8,0,0,1-16,0V56H176a8,8,0,0,1,0-16h16V24a8,8,0,0,1,16,0V40h16A8,8,0,0,1,232,48ZM160.6,77.86l-6.76-6.76A32.85,32.85,0,0,1,144,49.33a31.87,31.87,0,0,1,1.67-11.66,4,4,0,0,0-4.76-5.14L78.06,48.25A8,8,0,0,0,72,56V166.1A36,36,0,1,0,52.42,232C72.25,231.77,88,215.13,88,195.3V102.25l70.74-17.69A4,4,0,0,0,160.6,77.86Zm50.11,24.31a31.91,31.91,0,0,1-7.14,1.63,4,4,0,0,0-3.57,4V134.1A36,36,0,1,0,180.42,200c19.83-.23,35.58-16.86,35.58-36.7V106A4,4,0,0,0,210.71,102.17Z" />
              </svg>
            )}
            <span className="opacity-40">
              {isUploading ? "Processing…" : "Upload New File +"}
            </span>
          </button>
        </section>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        aria-label="Upload audio file"
        className="hidden"
        onChange={handleFileChange}
      />
    </main>
  );
}
