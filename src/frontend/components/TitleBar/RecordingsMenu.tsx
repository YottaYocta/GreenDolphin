import { useContext, useRef, useState } from "react";
import { Menu } from "@base-ui/react/menu";
import {
  CaretRightIcon,
  MusicNotesPlusIcon,
  MusicNoteIcon,
  YoutubeLogoIcon,
} from "@phosphor-icons/react";
import { AudioStore } from "../../AudioStore";
import { RecordingsStore } from "../../RecordingsStore";
import { useDecodeFile } from "../../lib/useDecodeFile";
import { noteColor } from "../../lib/util";
import { capture } from "../../lib/posthog";
import {
  isYouTubeFile,
  readYouTubeFile,
  stripYouTubeExt,
} from "../../lib/youtubeFile";
import { useAddYouTubeVideo } from "../../lib/useAddYouTube";
import { NewRecordingDialog } from "../NewRecordingDialog";

export function RecordingsMenu() {
  const decodeFile = useDecodeFile();
  const { cachedFiles, cacheFile } = useContext(RecordingsStore);
  const { audio, video, setVideo } = useContext(AudioStore);
  const filename = audio?.filename ?? video?.filename ?? "";
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const handleAddYouTube = useAddYouTubeVideo();
  const otherFiles = cachedFiles.filter((file) => file.name !== filename);

  const openFile = async (file: File) => {
    if (isYouTubeFile(file)) {
      const { videoId } = await readYouTubeFile(file);
      setVideo({ videoId, filename: file.name });
      capture("recording_switched", { filename: file.name, source: "youtube" });
      return;
    }
    await decodeFile(file);
    capture("recording_switched", { filename: file.name });
  };

  return (
    <div className="flex-1 min-w-0">
      <Menu.Root>
        <Menu.Trigger
          aria-label="Switch recording"
          className="btn-surface group w-full h-12 cursor-pointer min-w-0 justify-start gap-4 px-4 py-3.25 rounded-lg rounded-r-none"
        >
          <CaretRightIcon
            size={16}
            weight="bold"
            color="var(--color-icon)"
            className="transition-transform group-data-popup-open:rotate-90"
            style={{ opacity: 0.5, flexShrink: 0 }}
          />
          <span className="font-inria text-black text-base/5 truncate min-w-0">
            {stripYouTubeExt(filename)}
          </span>
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner side="bottom" align="start" sideOffset={8}>
            <Menu.Popup className="z-50 w-80 rounded-xl bg-white border border-border [box-shadow:var(--shadow-menu)] overflow-hidden flex flex-col outline-none">
              <Menu.Item
                className="shrink-0 flex items-center gap-3 px-4 py-3 cursor-pointer outline-none data-highlighted:bg-neutral-50 active:bg-neutral-100 border-b border-border"
                onClick={() => setDialogOpen(true)}
              >
                <MusicNotesPlusIcon
                  size={18}
                  weight="fill"
                  style={{ opacity: 0.5, flexShrink: 0 }}
                />
                <span className="font-inria text-black text-base/5">
                  New Recording
                </span>
              </Menu.Item>
              <div className="overflow-y-auto max-h-72 flex flex-col">
                {otherFiles.length === 0 ? (
                  <div className="px-4 py-4 font-inria text-black/50 text-sm text-center">
                    No other recordings
                  </div>
                ) : (
                  otherFiles.map((file) => (
                    <Menu.Item
                      key={file.name}
                      className="flex items-center gap-3 px-4 py-3 cursor-pointer outline-none data-highlighted:bg-neutral-50 active:bg-neutral-100"
                      onClick={() => openFile(file).catch(console.error)}
                    >
                      {isYouTubeFile(file) ? (
                        <YoutubeLogoIcon
                          size={18}
                          weight="fill"
                          color="#FF0000"
                          style={{ flexShrink: 0, opacity: 0.8 }}
                        />
                      ) : (
                        <MusicNoteIcon
                          size={18}
                          weight="fill"
                          color={noteColor(file.name)}
                          style={{ flexShrink: 0 }}
                        />
                      )}
                      <span className="flex-1 min-w-0 font-inria text-base/5 truncate text-black">
                        {stripYouTubeExt(file.name)}
                      </span>
                    </Menu.Item>
                  ))
                )}
              </div>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>

      <NewRecordingDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onUpload={() => uploadInputRef.current?.click()}
        onAddYouTube={handleAddYouTube}
      />

      <input
        ref={uploadInputRef}
        type="file"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          e.target.value = "";
          await decodeFile(file);
          await cacheFile(file);
          capture("recording_uploaded_from_player", {
            filename: file.name,
            file_size: file.size,
          });
        }}
      />
    </div>
  );
}
