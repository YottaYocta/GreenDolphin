import { useState } from "react";
import type { StoredRecording } from "../../persistence";
import { MusicNotesPlusIcon, PlayIcon, TrashIcon } from "@phosphor-icons/react";
import { relativeDate, stripExt } from "../shared/format";
import { useLibrary } from "../context";
import { Dialog } from "../shared/primitives";
import { NewRecordingDialog, RecordingIcon } from "./NewRecordingDialog";

export function Library() {
  const { recordings, error, open, remove } = useLibrary();
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<StoredRecording | null>(null);
  const newButton = (className: string) => (
    <button onClick={() => setAdding(true)} className={`flex items-center justify-center gap-2 self-stretch bg-surface border-border ${className}`}>
      <MusicNotesPlusIcon size={20} weight="fill" className="opacity-50" />
      <span className="opacity-40">New Recording</span>
    </button>
  );

  return (
    <main className="flex flex-col items-center px-4 py-8 h-dvh overflow-hidden font-inria text-base/5">
      <div className="flex flex-col items-center justify-center gap-5 w-full max-w-2xl flex-1 min-h-0 md:py-24 md:pb-48">
        <header className="flex max-md:flex-col max-md:items-start max-md:pl-4 items-center gap-4 self-stretch p-4 md:justify-center max-md:flex-1">
          <img src="/favicon/favicon.svg" alt="" className="w-20 rounded-[9px] shadow-drop border border-emerald-600/30 bg-white" />
          <div className="flex flex-col gap-1">
            <h1 className="font-bold text-play text-[29px]/9">GreenDolphin</h1>
            <p className="text-black/50 text-sm/4.5">Audio Looper & Recording Analyzer</p>
          </div>
        </header>
        {error && <p role="alert" className="text-sm text-red-600/80">{error}</p>}
        <section aria-label="My Recordings" className="flex flex-col rounded-2xl overflow-hidden self-stretch shadow-panel bg-white border border-border min-h-0 max-md:flex-3">
          {newButton("md:hidden m-4 rounded-2xl shadow-btn border h-12")}
          <ul className="flex-1 min-h-0 overflow-y-auto divide-y divide-border max-md:border-t border-border">
            {recordings.length === 0 && <li className="px-6 py-8 text-center text-black/50 text-sm">No recordings yet. Upload a file to get started.</li>}
            {recordings.map((recording) => (
              <li key={recording.id} className="flex max-md:flex-col md:items-center gap-4 p-4 md:p-6">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="flex items-center justify-center shrink-0 rounded-full size-14 bg-white shadow-(--shadow-drop) border border-border">
                    <RecordingIcon recording={recording} />
                  </div>
                  <div className="flex flex-col gap-1 min-w-0">
                    <p className="truncate">{stripExt(recording.title)}</p>
                    <p className="opacity-40 md:text-sm">{relativeDate(recording.addedAt)}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button aria-label={`Play ${recording.title}`} onClick={() => open(recording.id)} className="btn-surface max-md:flex-1 h-10 md:size-10">
                    <PlayIcon size={20} weight="fill" color="var(--color-play)" />
                  </button>
                  <button aria-label={`Delete ${recording.title}`} onClick={() => setDeleting(recording)} className="btn-surface max-md:flex-1 h-10 md:size-10">
                    <TrashIcon size={20} weight="fill" className="opacity-40" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {newButton("max-md:hidden min-h-18 border-t shadow-inset-dim hover:bg-surface-track cursor-pointer")}
        </section>
      </div>
      <NewRecordingDialog open={adding} onOpenChange={setAdding} />
      <Dialog title="Delete Recording" open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
        <p className="font-inria text-black/70 pb-6">Delete “{stripExt(deleting?.title ?? "")}”? Its loop and settings go with it.</p>
        <div className="flex gap-3">
          <button onClick={() => setDeleting(null)} className="btn-surface flex-1 h-10 rounded-lg">
            Cancel
          </button>
          <button
            onClick={() => {
              void remove(deleting!.id);
              setDeleting(null);
            }}
            className="flex-1 h-10 rounded-lg bg-red-500 text-white hover:bg-red-600 cursor-pointer"
          >
            Delete
          </button>
        </div>
      </Dialog>
    </main>
  );
}
