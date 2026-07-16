import { useContext } from "react";
import { FileMagnifyingGlassIcon } from "@phosphor-icons/react";
import { Dialog } from "@base-ui/react/dialog";
import { AudioStore } from "../../AudioStore";
import { RecordingsStore } from "../../RecordingsStore";
import { formatSeconds, formatSize } from "../../lib/util";
import { AppDialog } from "../AppDialog";

const headerBtn = "btn-surface rounded-l-none gap-2 px-5 py-3.25 border-l-0";

function FileInfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 flex-1">
      <span className="font-inria text-black/40 text-sm shrink-0">{label}</span>
      <span
        className={`text-black/90 min-w-0 break-all font-space-mono text-base`}
      >
        {value}
      </span>
    </div>
  );
}

export function FileInfoButton() {
  const { audio } = useContext(AudioStore);
  const { fileMeta } = useContext(RecordingsStore);
  if (!audio) return null;
  const { buffer: data, filename, fileSize } = audio;

  const uploadedAt = fileMeta.get(filename)?.uploadedAt;

  return (
    <AppDialog
      title="File Info"
      trigger={
        <Dialog.Trigger className={`${headerBtn} w-fit h-12 cursor-pointer`}>
          <FileMagnifyingGlassIcon
            size={18}
            weight="fill"
            color="var(--color-icon)"
            style={{ opacity: 0.54, flexShrink: 0 }}
          />
        </Dialog.Trigger>
      }
    >
      <div className="flex flex-col gap-6 p-2">
        <div className="flex gap-4 flex-col items-start">
          <span className="font-inria text-black text-lg min-w-0">
            {filename}
          </span>
        </div>
        <div className="flex flex-col gap-6">
          <div className="flex gap-4">
            <FileInfoCell label="Size" value={formatSize(fileSize)} />
            <FileInfoCell
              label="Duration"
              value={formatSeconds(data.duration)}
            />
          </div>
          <div className="flex gap-4">
            <FileInfoCell
              label="Sample rate"
              value={`${data.sampleRate.toLocaleString()} Hz`}
            />
            <FileInfoCell
              label="Channels"
              value={String(data.numberOfChannels)}
            />
          </div>
          {uploadedAt != null && (
            <div className="flex gap-4">
              <FileInfoCell
                label="Added"
                value={new Date(uploadedAt).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              />
            </div>
          )}
        </div>
      </div>
    </AppDialog>
  );
}
