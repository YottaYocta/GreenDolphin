import { useContext } from "react";
import { FileMagnifyingGlassIcon } from "@phosphor-icons/react";
import { NoteIcon } from "./NoteIcon";
import { Dialog } from "@base-ui/react/dialog";
import { AudioStore } from "../AudioStore";
import { RecordingsStore } from "../RecordingsStore";
import { formatSeconds, formatSize } from "../lib/util";
import { AppDialog } from "./AppDialog";

const headerBtn = "btn-surface rounded-lg gap-3 px-3.25 py-3.25";
const headerBtnLabel =
  "opacity-40 font-inria text-black text-base/5 whitespace-nowrap max-md:hidden";

function FileInfoCell({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 flex-1">
      <span className="font-inria text-black/50 text-sm shrink-0">{label}</span>
      <span
        className={`text-black text-base min-w-0 break-all ${mono ? "font-space-mono" : "font-inria"}`}
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
        <Dialog.Trigger className={`${headerBtn} w-full h-12 cursor-pointer`}>
          <FileMagnifyingGlassIcon
            size={21}
            weight="fill"
            color="var(--color-icon)"
            style={{ opacity: 0.54, flexShrink: 0 }}
          />
          <span className={headerBtnLabel}>File Info</span>
        </Dialog.Trigger>
      }
    >
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <NoteIcon filename={filename} />
          <span className="font-inria font-bold text-black text-base leading-snug min-w-0">
            {filename}
          </span>
        </div>
        <div className="flex flex-col gap-6">
          <div className="flex gap-4">
            <FileInfoCell label="Size" value={formatSize(fileSize)} mono />
            <FileInfoCell
              label="Duration"
              value={formatSeconds(data.duration)}
              mono
            />
          </div>
          <div className="flex gap-4">
            <FileInfoCell
              label="Sample rate"
              value={`${data.sampleRate.toLocaleString()} Hz`}
              mono
            />
            <FileInfoCell
              label="Channels"
              value={String(data.numberOfChannels)}
              mono
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
                mono={false}
              />
            </div>
          )}
        </div>
      </div>
    </AppDialog>
  );
}
