import { useRef, useState } from "react";
import { MusicNoteIcon, MusicNotesPlusIcon, SpinnerIcon, YoutubeLogoIcon } from "@phosphor-icons/react";
import { noteColor } from "../shared/format";
import { useLibrary } from "../context";
import { Dialog } from "../shared/primitives";
import type { StoredRecording } from "../../persistence";

export const RecordingIcon = ({ recording, size = 32 }: { recording: StoredRecording; size?: number }) =>
  recording.source.kind === "youtube" ? <YoutubeLogoIcon size={size} weight="fill" color="#FF0000" className="opacity-80 shrink-0" /> : <MusicNoteIcon size={size} weight="fill" color={noteColor(recording.name)} className="shrink-0" />;

export function NewRecordingDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { add, addYouTube } = useLibrary();
  const input = useRef<HTMLInputElement>(null);
  const [link, setLink] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await addYouTube(link);
      setLink("");
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't add that video. Please try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog title="New Recording" open={open} onOpenChange={onOpenChange}>
      <div className="flex flex-col gap-4">
        <button onClick={() => input.current?.click()} className="btn-surface rounded-lg gap-2 h-12 w-full">
          <MusicNotesPlusIcon size={20} weight="fill" className="opacity-50" />
          <span className="opacity-40">Upload Audio File</span>
        </button>
        <input
          ref={input}
          type="file"
          accept="audio/*,video/*"
          aria-label="Upload audio file"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            onOpenChange(false);
            void add(file);
          }}
        />
        <div className="flex items-center gap-3 text-sm text-black/30 font-inria">
          <div className="flex-1 h-px bg-border" />
          or
          <div className="flex-1 h-px bg-border" />
        </div>
        <input
          type="url"
          aria-label="YouTube link"
          value={link}
          onChange={(e) => {
            setLink(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && void submit()}
          placeholder="https://www.youtube.com/watch?v=…"
          className="rounded-lg bg-surface-input h-12 px-3 font-space-mono text-sm/5 text-black/60 outline-none placeholder:text-black/25"
        />
        {error && <p className="text-sm text-red-600/80 font-inria">{error}</p>}
        <button onClick={() => void submit()} disabled={busy || !link.trim()} className="btn-surface rounded-lg gap-2 h-12 w-full disabled:opacity-60 disabled:cursor-not-allowed">
          {busy ? <SpinnerIcon size={20} className="animate-spin opacity-40" /> : <YoutubeLogoIcon size={20} weight="fill" className="opacity-50" />}
          <span className="opacity-40">{busy ? "Adding…" : "Add Video"}</span>
        </button>
      </div>
    </Dialog>
  );
}
