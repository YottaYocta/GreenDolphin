import { useState } from "react";
import {
  MusicNotesPlusIcon,
  SpinnerIcon,
  YoutubeLogoIcon,
} from "@phosphor-icons/react";
import { AppDialog } from "./AppDialog";
import { parseYouTubeVideoId } from "../lib/youtubeFile";

export function NewRecordingDialog({
  open,
  onOpenChange,
  onUpload,
  onAddYouTube,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpload: () => void;
  onAddYouTube: (videoId: string, url: string) => Promise<void>;
}) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = async () => {
    const videoId = parseYouTubeVideoId(url);
    if (!videoId) {
      setError("Couldn't find a video in that link.");
      return;
    }
    setError(null);
    setIsAdding(true);
    try {
      await onAddYouTube(videoId, url.trim());
      setUrl("");
      onOpenChange(false);
    } catch {
      setError("Couldn't add that video. Please try again.");
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <AppDialog title="New Recording" open={open} onOpenChange={onOpenChange}>
      <div className="flex flex-col gap-4">
        <button
          onClick={() => {
            onOpenChange(false);
            onUpload();
          }}
          className="btn-surface rounded-xl gap-2 h-12 w-full cursor-pointer"
        >
          <MusicNotesPlusIcon
            size={20}
            weight="fill"
            style={{ opacity: 0.5, flexShrink: 0 }}
          />
          <span className="opacity-40">Upload Audio File</span>
        </button>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-sm text-black/30 font-inria">or</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <div className="flex flex-col gap-2">
          <input
            type="url"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
            }}
            placeholder="https://www.youtube.com/watch?v=…"
            className="w-full rounded-sm bg-surface-input px-3 py-2.5 font-space-mono text-base/5 text-black/60 outline-none placeholder:text-black/25"
          />
          {error && (
            <p className="text-sm text-red-600/80 font-inria">{error}</p>
          )}
          <button
            onClick={handleAdd}
            disabled={isAdding || url.trim() === ""}
            className="btn-surface rounded-xl gap-2 h-12 w-full cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isAdding ? (
              <SpinnerIcon
                size={20}
                className="animate-spin opacity-40 shrink-0"
              />
            ) : (
              <YoutubeLogoIcon
                size={20}
                weight="fill"
                style={{ opacity: 0.5, flexShrink: 0 }}
              />
            )}
            <span className="opacity-40">
              {isAdding ? "Adding…" : "Add Video"}
            </span>
          </button>
        </div>
      </div>
    </AppDialog>
  );
}
