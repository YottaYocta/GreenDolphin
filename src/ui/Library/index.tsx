import { useState } from "react";
import { MusicNotesPlusIcon } from "@phosphor-icons/react";
import { relativeDate, stripExt } from "../shared/format";
import { useLibrary } from "../context";
import { NewRecordingDialog, RecordingIcon } from "./NewRecordingDialog";

export function Library() {
  const { recordings, error, open } = useLibrary();
  const [adding, setAdding] = useState(false);

  return (
    <main className="flex flex-col items-center px-4 py-8 h-dvh overflow-hidden font-inria text-base/5">
      <div className="flex flex-col items-center justify-center gap-5 w-full max-w-2xl flex-1 min-h-0 md:py-24 md:pb-48">
        <header className="flex max-md:flex-col max-md:items-start items-center gap-4 self-stretch py-4 max-md:flex-1">
          <img src="/favicon/favicon.svg" alt="" className="w-13 rounded-[9px] bg-white" />
          <div className="flex flex-col gap-1">
            <h1 className="font-bold text-play text-[29px]/9">GreenDolphin</h1>
            <p className="text-black/50 text-sm/4.5">Audio Looper & Recording Analyzer</p>
          </div>
        </header>
        {error && <p role="alert" className="text-sm text-red-600/80">{error}</p>}
        <button onClick={() => setAdding(true)} className="btn-surface bg-white gap-2 rounded-lg h-13 px-4 shrink-0 max-md:self-stretch md:self-start">
          <MusicNotesPlusIcon size={20} weight="fill" className="opacity-50" />
          <span className="opacity-40">Load recording</span>
        </button>
        <section aria-label="My Recordings" className="flex flex-col rounded-lg overflow-hidden self-stretch bg-white min-h-0 max-md:flex-3">
          <ul className="flex-1 min-h-0 overflow-y-auto scrollbar-slim">
            {recordings.length === 0 && <li className="px-6 py-8 text-center text-black/50 text-sm">No recordings yet. Upload a file to get started.</li>}
            {recordings.map((recording) => (
              <li key={recording.id}>
                <button aria-label={`Open ${recording.title}`} onClick={() => open(recording.id)} className="flex items-center gap-4 w-full p-4 md:py-3 text-left cursor-pointer hover:bg-surface active:bg-surface-track">
                  <RecordingIcon recording={recording} />
                  <span className="flex-1 min-w-0 truncate">{stripExt(recording.title)}</span>
                  <span className="shrink-0 opacity-40 text-sm">{relativeDate(recording.addedAt)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <NewRecordingDialog open={adding} onOpenChange={setAdding} />
    </main>
  );
}
