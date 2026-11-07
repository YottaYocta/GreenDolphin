import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { ArrowCounterClockwiseIcon, DownloadSimpleIcon, MusicNotesIcon, PencilSimpleIcon, TrashIcon } from "@phosphor-icons/react";
import { stripExt } from "../shared/format";
import { typing } from "../shared/keys";
import { notesToMidi, type NoteStore } from "./notes";

const TOOL_BUTTON = "flex items-center justify-center size-9 rounded-lg cursor-pointer disabled:opacity-40 disabled:cursor-default";

function ToolButton({ label, on, onClick, disabled, children }: { label: string; on?: boolean; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button aria-label={label} aria-pressed={on} disabled={disabled} onClick={onClick} className={`${TOOL_BUTTON} ${on ? "bg-surface-active text-play" : "text-black/40 enabled:hover:bg-black/5"}`}>
      {children}
    </button>
  );
}

function exportMidi(title: string, notes: NoteStore) {
  const url = URL.createObjectURL(new Blob([notesToMidi(notes.get())], { type: "audio/midi" }));
  Object.assign(document.createElement("a"), { href: url, download: `${stripExt(title)}.mid` }).click();
  URL.revokeObjectURL(url);
}

function useUndoKeys(notes: NoteStore) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z" || typing(e.target)) return;
      e.preventDefault();
      if (e.shiftKey) notes.redo();
      else notes.undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [notes]);
}

interface NotesToolbarProps {
  title: string;
  notes: NoteStore;
  pen: boolean;
  onPen: (pen: boolean) => void;
  playNotes: boolean;
  onPlayNotes: (playNotes: boolean) => void;
}

export function NotesToolbar({ title, notes, pen, onPen, playNotes, onPlayNotes }: NotesToolbarProps) {
  const hasNotes = useSyncExternalStore(notes.subscribe, () => notes.get().length > 0);
  const hasSelection = useSyncExternalStore(notes.subscribe, () => notes.selected().size > 0);
  const canUndo = useSyncExternalStore(notes.subscribe, notes.canUndo);
  useUndoKeys(notes);
  return (
    <div className="flex items-center justify-between w-full">
      <div className="flex items-center gap-1">
        <ToolButton label="Pen" on={pen} onClick={() => onPen(!pen)}>
          <PencilSimpleIcon size={20} weight="fill" />
        </ToolButton>
        <ToolButton label="Undo" disabled={!canUndo} onClick={notes.undo}>
          <ArrowCounterClockwiseIcon size={20} weight="bold" />
        </ToolButton>
        {hasSelection && (
          <ToolButton label="Delete selected" onClick={notes.deleteSelected}>
            <TrashIcon size={20} weight="fill" />
          </ToolButton>
        )}
      </div>
      <div className="flex items-center gap-1">
        <ToolButton label="Play notes" on={playNotes} onClick={() => onPlayNotes(!playNotes)}>
          <MusicNotesIcon size={20} weight="fill" />
        </ToolButton>
        <ToolButton label="Export notes" disabled={!hasNotes} onClick={() => exportMidi(title, notes)}>
          <DownloadSimpleIcon size={20} weight="bold" />
        </ToolButton>
      </div>
    </div>
  );
}
