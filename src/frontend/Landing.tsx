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
      style={{ flexShrink: 0 }}
    >
      <path d="M210.3,56.34l-80-24A8,8,0,0,0,120,40V148.26A48,48,0,1,0,136,184V98.75l69.7,20.91A8,8,0,0,0,216,112V64A8,8,0,0,0,210.3,56.34Z" fill={color} />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="23" height="24" viewBox="21.333 0 245.333 256" style={{ overflow: "visible", flexShrink: 0 }}>
      <path d="M240,128a15.74,15.74,0,0,1-7.6,13.51L88.32,229.65a16,16,0,0,1-16.2.3A15.86,15.86,0,0,1,64,216.13V39.87a15.86,15.86,0,0,1,8.12-13.82,16,16,0,0,1,16.2.3L232.4,114.49A15.74,15.74,0,0,1,240,128Z" fill="var(--color-play)" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 192 192" style={{ flexShrink: 0 }}>
      <path d="M162 36H132V30a18 18 0 0 0-18-18H78A18 18 0 0 0 60 30v6H30a6 6 0 0 0 0 12h6V156a12 12 0 0 0 12 12H144a12 12 0 0 0 12-12V48h6a6 6 0 0 0 0-12ZM84 126a6 6 0 0 1-12 0V78a6 6 0 0 1 12 0Zm36 0a6 6 0 0 1-12 0V78a6 6 0 0 1 12 0Zm0-90H72V30a6 6 0 0 1 6-6h36a6 6 0 0 1 6 6Z" fill="#B3B3B3" />
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

  const eyeIcon = (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 128 128" style={{ flexShrink: 0 }}>
      <path d="M123.656 62.381c-0.174-0.395-4.41-9.79-13.826-19.205C97.285 30.631 81.441 24.001 64.001 24.001S30.715 30.631 18.17 43.176C8.756 52.591 4.501 62.001 4.345 62.381a4 4 0 0 0 0 3.25c0.174 0.395 4.41 9.786 13.825 19.2C30.715 97.371 46.561 104.001 64.001 104.001s33.285-6.63 45.829-19.17c9.414-9.414 13.65-18.805 13.825-19.2A4 4 0 0 0 123.656 62.381ZM64.001 84.001a20 20 0 1 1 20-20A20 20 0 0 1 64.001 84.001Z" fill="#313131" />
    </svg>
  );

  const btnClass = "flex overflow-clip items-center py-3.25 h-10 rounded-lg justify-center [box-shadow:#FFFFFF_0px_0px_3px_1px_inset,#0000001A_0px_2px_3px] bg-[#FAFAFA] border border-solid border-[#0000001A] disabled:cursor-default";

  return (
    <>
      {/* mobile */}
      <div className="md:hidden flex items-center justify-between self-stretch gap-4 flex-col p-6">
        <div className="flex items-center gap-7.75 self-stretch">
          <div className="flex overflow-clip rounded-sm items-center justify-center w-20.25 h-20.25 shrink-0 [box-shadow:#FFFFFF_0px_2px_3px_1px_inset,#0000000D_0px_2px_3px] bg-[#FDFDFD] border border-solid border-[#0000001A] origin-center" style={{ rotate: "358.78deg" }}>
            <MusicNoteIcon color={noteColor(file.name)} />
          </div>
          <div className="flex items-start gap-4 flex-1 flex-col">
            <div className="flex flex-col items-start gap-1 self-stretch">
              <div className="font-inria text-black text-base/5 truncate max-w-full">{file.name}</div>
              <div className="flex items-center gap-2 opacity-40">
                {eyeIcon}
                <div className="h-5 font-inria text-[#313131] text-base/5">
                  {uploadedAt != null ? relativeDate(uploadedAt) : ""}
                </div>
              </div>
            </div>
            <div className="flex items-start gap-2 self-stretch">
              <button disabled={isLoading} onClick={handlePlay} className={`${btnClass} flex-1`}>
                {isLoading ? <Spinner /> : <PlayIcon />}
              </button>
              <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className={`${btnClass} flex-1`}>
                <DeleteIcon />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* desktop */}
      <div className="max-md:hidden flex items-center justify-between self-stretch gap-4 p-6 relative">
        <div className="flex items-center gap-5 w-81 relative shrink-0">
          <div className="w-15 h-13.25 rounded-sm opacity-0 shrink-0 [box-shadow:#FFFFFF_0px_2px_3px_2px_inset,#0000000D_0px_2px_3px] bg-[#FDFDFD] border border-solid border-[#0000001A]" />
          <div className="flex items-start gap-2 flex-col justify-end">
            <div className="font-inria text-black text-base/5 truncate max-w-40">{file.name}</div>
            <div className="font-inria text-black text-sm opacity-40">{formatSize(file.size)}</div>
          </div>
          <div className="flex overflow-clip rounded-sm absolute left-0 top-0 items-center justify-center w-[61.7px] h-[61.7px] [box-shadow:#FFFFFF_0px_2px_3px_1px_inset,#0000000D_0px_2px_3px] bg-[#FDFDFD] border border-solid border-[#0000001A] origin-top-left" style={{ rotate: "358.78deg", translate: "-7px -3px" }}>
            <MusicNoteIcon color={noteColor(file.name)} />
          </div>
        </div>
        <div className="flex items-start gap-2 flex-col flex-1">
          <div className="flex items-center gap-2 opacity-40">
            {eyeIcon}
            <div className="h-5 font-inria text-[#313131] text-base/5">
              {uploadedAt != null ? relativeDate(uploadedAt) : ""}
            </div>
          </div>
        </div>
        <div className="flex items-start gap-2 absolute top-1/2 right-4 -translate-y-1/2">
          <button disabled={isLoading} onClick={handlePlay} className={`${btnClass} shrink-0 size-10`}>
            {isLoading ? <Spinner /> : <PlayIcon />}
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className={`${btnClass} shrink-0 size-10`}>
            <DeleteIcon />
          </button>
        </div>
      </div>
    </>
  );
}

export function Landing() {
  const decodeFile = useDecodeFile();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { cachedFiles, fileMeta, deleteFile, cacheFile } = useContext(RecordingsStore);
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
    <main className="[font-synthesis:none] min-h-screen flex flex-col items-center px-4 py-18 bg-[#F5F5F5] antialiased">
      <div className="flex flex-col items-start gap-5 w-full max-w-2xl">

        <div className="flex max-md:flex-col items-center gap-5 self-stretch rounded-[18px] p-4 justify-center">
          <img
            src="/favicon/favicon.svg"
            alt="GreenDolphin"
            className="w-22.5 h-22.5 rounded-[9px] shrink-0 [box-shadow:#0000000D_0px_2px_5px] border border-solid border-[#0000001A] object-contain bg-white"
          />
          <div className="flex items-start max-md:items-center flex-col justify-center gap-1 pr-4 py-4">
            <div className="font-inria font-bold text-[#11B96F] text-2xl/7.5 max-md:text-xl">GreenDolphin</div>
            <div className="opacity-70 font-inria text-black text-base/5 max-md:text-sm whitespace-pre">
              Audio Looper{'  '}&{'  '}Recording Analyzer
            </div>
          </div>
        </div>

        <div className="flex flex-col items-start rounded-2xl self-stretch overflow-clip [box-shadow:#0000001A_0px_2px_3px] bg-white border border-solid border-[#0000001A]">
          <button
            disabled={isUploading}
            onClick={() => !isUploading && fileInputRef.current?.click()}
            className="max-md:hidden flex overflow-clip items-center gap-2 px-5.5 py-3.25 justify-center self-stretch [box-shadow:#FFFFFF_0px_0px_3px_1px_inset] bg-[#FAFAFA] border-b border-b-solid border-b-[#0000001A] disabled:opacity-60 disabled:cursor-not-allowed hover:bg-surface-track transition-colors"
          >
            {isUploading ? (
              <Spinner />
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 256 256" style={{ width: 20, opacity: 0.5, flexShrink: 0 }}>
                <path d="M232,48a8,8,0,0,1-8,8H208V72a8,8,0,0,1-16,0V56H176a8,8,0,0,1,0-16h16V24a8,8,0,0,1,16,0V40h16A8,8,0,0,1,232,48ZM160.6,77.86l-6.76-6.76A32.85,32.85,0,0,1,144,49.33a31.87,31.87,0,0,1,1.67-11.66,4,4,0,0,0-4.76-5.14L78.06,48.25A8,8,0,0,0,72,56V166.1A36,36,0,1,0,52.42,232C72.25,231.77,88,215.13,88,195.3V102.25l70.74-17.69A4,4,0,0,0,160.6,77.86Zm50.11,24.31a31.91,31.91,0,0,1-7.14,1.63,4,4,0,0,0-3.57,4V134.1A36,36,0,1,0,180.42,200c19.83-.23,35.58-16.86,35.58-36.7V106A4,4,0,0,0,210.71,102.17Z" />
              </svg>
            )}
            <div className="opacity-40 font-inria text-black text-base/5">
              {isUploading ? "Processing…" : "Upload New File +"}
            </div>
          </button>

          {cachedFiles.length === 0 ? (
            <p className="w-full px-6 py-8 text-center opacity-40 font-inria text-black text-base/5">
              No recordings yet. Upload a file to get started.
            </p>
          ) : (
            cachedFiles.map((file, i) => (
              <div key={file.name} className={i > 0 ? "self-stretch border-t border-t-solid border-t-[#0000001A]" : "self-stretch"}>
                <RecordingRow
                  file={file}
                  uploadedAt={fileMeta.get(file.name)?.uploadedAt}
                  onPlay={() => handlePlay(file)}
                  onDelete={() => deleteFile(file.name)}
                />
              </div>
            ))
          )}

          <div className="md:hidden flex flex-col items-start self-stretch p-4">
            <button
              disabled={isUploading}
              onClick={() => !isUploading && fileInputRef.current?.click()}
              className="flex overflow-clip items-center gap-2 px-5.5 py-3.25 justify-center self-stretch rounded-2xl [box-shadow:#FFFFFF_0px_0px_3px_1px_inset,#0000000D_0px_3px_4px] bg-[#FAFAFA] border border-solid border-[#0000001A] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isUploading ? (
                <Spinner />
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 256 256" style={{ width: 20, opacity: 0.5, flexShrink: 0 }}>
                  <path d="M232,48a8,8,0,0,1-8,8H208V72a8,8,0,0,1-16,0V56H176a8,8,0,0,1,0-16h16V24a8,8,0,0,1,16,0V40h16A8,8,0,0,1,232,48ZM160.6,77.86l-6.76-6.76A32.85,32.85,0,0,1,144,49.33a31.87,31.87,0,0,1,1.67-11.66,4,4,0,0,0-4.76-5.14L78.06,48.25A8,8,0,0,0,72,56V166.1A36,36,0,1,0,52.42,232C72.25,231.77,88,215.13,88,195.3V102.25l70.74-17.69A4,4,0,0,0,160.6,77.86Zm50.11,24.31a31.91,31.91,0,0,1-7.14,1.63,4,4,0,0,0-3.57,4V134.1A36,36,0,1,0,180.42,200c19.83-.23,35.58-16.86,35.58-36.7V106A4,4,0,0,0,210.71,102.17Z" />
                </svg>
              )}
              <div className="opacity-40 font-inria text-black text-base/5">
                {isUploading ? "Processing…" : "Upload New File +"}
              </div>
            </button>
          </div>
        </div>

      </div>
      <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
    </main>
  );
}
