import { useMemo, useState } from "react";
import { persistence } from "../../persistence";
import { ArrowsDownUpIcon, MusicNotesPlusIcon } from "@phosphor-icons/react";
import { relativeDate, stripExt } from "../shared/format";
import { useLibrary } from "../context";
import { IconButton } from "../shared/primitives";
import { NewRecordingDialog, RecordingIcon } from "./NewRecordingDialog";

export function Library() {
  const { recordings, error, open } = useLibrary();
  const [adding, setAdding] = useState(false);
  const [byAdded, setByAdded] = useState(() => persistence.flag("sortByAdded"));
  const sorted = useMemo(() => {
    if (byAdded) return recordings;
    const opened = new Map(recordings.map((r) => [r.id, persistence.recordingPrefs(r.id).openedAt || r.addedAt]));
    return [...recordings].sort((a, b) => opened.get(b.id)! - opened.get(a.id)!);
  }, [recordings, byAdded]);

  return (
    <main className="flex flex-col items-center px-4 py-8 h-dvh overflow-hidden text-base/5">
      <div className="flex flex-col items-center justify-center gap-5 w-full max-w-2xl flex-1 min-h-0 md:py-24 md:pb-48">
        <header className="flex max-md:flex-col max-md:items-start items-center gap-4 self-stretch py-4">
          <img src="/favicon/favicon.svg" alt="" className="w-13 rounded-[9px] bg-white" />
          <div className="flex flex-col gap-1">
            <h1 className="font-bold text-play text-[29px]/9">GreenDolphin</h1>
            <p className="text-black/50 text-sm/4.5">Audio Looper & Recording Analyzer</p>
          </div>
        </header>
        {error && <p role="alert" className="text-sm text-red-600/80">{error}</p>}
        <div className="flex justify-between gap-4 self-stretch shrink-0">
          <IconButton icon={MusicNotesPlusIcon} fill="white" onClick={() => setAdding(true)} className="h-13 px-4 max-md:flex-1">
            Load recording
          </IconButton>
          <IconButton
            icon={ArrowsDownUpIcon}
            onClick={() => {
              setByAdded(!byAdded);
              persistence.setFlag("sortByAdded", !byAdded);
            }}
            className="h-13 px-4"
          >
            {byAdded ? "Date added" : "Last opened"}
          </IconButton>
        </div>
        <ul aria-label="My Recordings" className="rounded-lg self-stretch bg-white min-h-0 max-md:flex-1 overflow-y-auto scrollbar-slim">
          {recordings.length === 0 && <li className="px-6 py-8 text-center text-black/50 text-sm">No recordings yet. Upload a file to get started.</li>}
          {sorted.map((recording) => (
            <li key={recording.id}>
              <button aria-label={`Open ${recording.title}`} onClick={() => open(recording.id)} className="flex items-center gap-4 w-full p-4 md:py-3 text-left cursor-pointer hover:bg-surface active:bg-surface-track">
                <RecordingIcon recording={recording} />
                <span className="flex max-md:flex-col md:items-center gap-1 md:gap-4 flex-1 min-w-0">
                  <span className="md:flex-1 min-w-0 truncate text-black/70">{stripExt(recording.title)}</span>
                  <span className="shrink-0 opacity-40 text-sm">{relativeDate(recording.addedAt)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <NewRecordingDialog open={adding} onOpenChange={setAdding} />
    </main>
  );
}
