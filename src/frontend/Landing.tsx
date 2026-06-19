import { useContext, useRef, useState } from "react";
import { useNavigate } from "react-router";
import {
  PlayIcon,
  TrashIcon,
  SpinnerIcon,
  MusicNotesPlusIcon,
} from "@phosphor-icons/react";
import { useDecodeFile } from "./lib/useDecodeFile";
import { NoteIcon } from "./components/NoteIcon";
import { RecordingsStore } from "./RecordingsStore";
import { relativeDate } from "./lib/util";

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
  const handlePlay = () => onPlay().catch(console.error);

  return (
    <article aria-label={file.name} className="self-stretch">
      {/* mobile */}
      <div className="md:hidden flex items-end gap-4 p-4 h-full">
        <div className="flex items-start gap-4 flex-col flex-1 min-w-0">
          <div className="flex items-center gap-4 self-stretch">
            <div className="flex items-center justify-center btn-surface p-2 rounded-full">
              <NoteIcon filename={file.name} />
            </div>
            <div className="flex flex-col gap-2 w-full max-w-full overflow-clip min-w-0">
              <p className="truncate max-w-full">{file.name}</p>
              <p className="opacity-40">
                {uploadedAt != null ? relativeDate(uploadedAt) : ""}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2 self-stretch">
            <button
              onClick={handlePlay}
              aria-label={`Play ${file.name}`}
              className="btn-surface flex-1 h-10 py-3.25"
            >
              <PlayIcon
                size={24}
                weight="fill"
                color="var(--color-play)"
                style={{ flexShrink: 0 }}
              />
            </button>
            <button
              onClick={onDelete}
              aria-label={`Delete ${file.name}`}
              className="btn-surface flex-1 h-10 py-3.25"
            >
              <TrashIcon
                size={20}
                weight="fill"
                style={{ opacity: 0.5, flexShrink: 0 }}
              />
            </button>
          </div>
        </div>
      </div>

      {/* desktop */}
      <div className="max-md:hidden flex items-center gap-8 p-6 relative">
        <div className="flex items-center gap-4 w-full relative shrink-0">
          <div className="btn-surface w-16 aspect-square rounded-full">
            <NoteIcon filename={file.name} />
          </div>
          <div className="flex items-start gap-1 flex-col justify-end flex-1 overflow-hidden">
            <p className="truncate max-w-full">{file.name}</p>
            <p className="text-black/50 text-sm">
              {uploadedAt != null ? relativeDate(uploadedAt) : ""}
            </p>
          </div>
        </div>
        <div className="flex items-start gap-2 absolute top-1/2 right-6 -translate-y-1/2">
          <button
            onClick={handlePlay}
            aria-label={`Play ${file.name}`}
            className="btn-surface size-10 shrink-0 py-3.25"
          >
            <PlayIcon
              size={20}
              weight="fill"
              color="var(--color-play)"
              style={{ flexShrink: 0 }}
            />
          </button>
          <button
            onClick={onDelete}
            aria-label={`Delete ${file.name}`}
            className="btn-surface size-10 shrink-0 py-3.25"
          >
            <TrashIcon
              size={20}
              weight="fill"
              style={{ opacity: 0.3, flexShrink: 0 }}
            />
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
    <main className="[font-synthesis:none] flex flex-col items-center px-4 py-8 antialiased max-h-screen overflow-hidden font-inria text-black text-base/5">
      <div className="flex flex-col items-center justify-center gap-5 w-full max-w-2xl flex-1 min-h-0 h-full md:py-24 md:pb-48">
        <header className="flex max-md:flex-col max-md:items-start max-md:pl-4 max-md:gap-4 items-center gap-4 self-stretch rounded-[18px] p-4 justify-center max-md:flex-1">
          <img
            src="/favicon/favicon.svg"
            alt="GreenDolphin logo"
            className="w-20 aspect-square rounded-[9px] shrink-0 shadow-drop border border-emerald-600/30 object-contain bg-white"
          />
          <div className="flex items-start flex-col justify-center gap-1 max-md:p-0 pr-4 py-4">
            <h1 className="font-inria font-bold text-play text-[29px]/9">
              GreenDolphin
            </h1>
            <p className="font-inria text-black/50 text-sm/4.5 whitespace-pre">
              Audio Looper & Recording Analyzer
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
              className="flex overflow-clip items-center gap-2 px-5.5  justify-center self-stretch rounded-2xl shadow-btn bg-surface border border-border disabled:opacity-60 disabled:cursor-not-allowed h-12"
            >
              {isUploading ? (
                <SpinnerIcon
                  size={20}
                  className="animate-spin opacity-40 shrink-0"
                />
              ) : (
                <MusicNotesPlusIcon
                  size={20}
                  weight="fill"
                  style={{ opacity: 0.5, flexShrink: 0 }}
                />
              )}
              <span className="opacity-40">
                {isUploading ? "Processing…" : "Upload New File"}
              </span>
            </button>
          </div>

          <div className="w-full flex-1 min-h-0 flex flex-col overflow-y-scroll divide-y divide-border">
            {cachedFiles.length === 0 ? (
              <p className="w-full px-6 py-8 text-center text-black/50 text-sm font-inria">
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
            className="max-md:hidden flex overflow-clip items-center gap-2 px-5.5 h-18 justify-center self-stretch shadow-inset-dim bg-surface border-t border-border disabled:opacity-60 disabled:cursor-not-allowed hover:bg-surface-track transition-colors"
          >
            {isUploading ? (
              <SpinnerIcon
                size={20}
                className="animate-spin opacity-40 shrink-0"
              />
            ) : (
              <MusicNotesPlusIcon
                size={20}
                weight="fill"
                style={{ opacity: 0.5, flexShrink: 0 }}
              />
            )}
            <span className="opacity-40">
              {isUploading ? "Processing…" : "Upload New File"}
            </span>
          </button>
        </section>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        aria-label="Upload audio file"
        className="hidden"
        onChange={handleFileChange}
      />
    </main>
  );
}
