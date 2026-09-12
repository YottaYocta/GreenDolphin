import { useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import {
  MusicNotesPlusIcon,
  SpinnerIcon,
  XIcon,
  YoutubeLogoIcon,
} from "@phosphor-icons/react";
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
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-black/20 z-40" />
        <Dialog.Popup className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-84 rounded-xl bg-white border border-border [box-shadow:var(--shadow-dialog)] flex flex-col outline-none">
          <div className="flex items-center justify-center gap-4 h-12 px-8 border-b border-border relative">
            <Dialog.Title className="font-inria text-black/40 text-lg/6">
              New Recording
            </Dialog.Title>
            <Dialog.Close className="btn-surface size-8 shrink-0 cursor-pointer outline-none absolute right-2">
              <XIcon
                size={16}
                weight="bold"
                color="var(--color-icon)"
                style={{ opacity: 0.4 }}
              />
            </Dialog.Close>
          </div>
          <div className="px-6 py-5 flex flex-col gap-4">
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
              <div className="flex items-center gap-2">
                <YoutubeLogoIcon
                  size={20}
                  weight="fill"
                  color="#FF0000"
                  style={{ flexShrink: 0, opacity: 0.8 }}
                />
                <span className="text-sm text-black/50 font-inria">
                  Add a YouTube video
                </span>
              </div>
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
                className="w-full rounded-lg border border-border bg-surface-input px-3 py-2.5 font-space-mono text-sm text-black/70 outline-none placeholder:text-black/25"
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
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
