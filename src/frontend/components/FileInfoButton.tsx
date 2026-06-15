import { useContext } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { AudioStore } from "../AudioStore";
import { RecordingsStore } from "../RecordingsStore";
import { formatSeconds, formatSize } from "../lib/util";
import { AppDialog } from "./AppDialog";

const headerBtn = "btn-surface rounded-lg gap-3 px-3.25 py-3.25";
const headerBtnLabel =
  "opacity-40 font-inria text-black text-base/5 whitespace-nowrap max-md:hidden";

function FileInfoRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="opacity-50 font-inria text-black text-sm shrink-0">
        {label}
      </span>
      <span
        className={`text-black text-sm text-right min-w-0 break-all ${mono ? "font-space-mono" : "font-inria"}`}
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

  return (
    <AppDialog
      title="File Info"
      trigger={
        <Dialog.Trigger className={`${headerBtn} w-full h-12 cursor-pointer`}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="21"
            height="21"
            viewBox="0 0 256 256"
            style={{ opacity: 0.54, flexShrink: 0 }}
          >
            <path
              d="M144,148a20,20,0,1,1-20-20A20,20,0,0,1,144,148Zm72-60V216a16,16,0,0,1-16,16H56a16,16,0,0,1-16-16V40A16,16,0,0,1,56,24h96a8,8,0,0,1,5.66,2.34l56,56A8,8,0,0,1,216,88Zm-50.34,90.34-11.2-11.19a36.05,36.05,0,1,0-11.31,11.31l11.19,11.2a8,8,0,0,0,11.32-11.32ZM196,88,152,44V88Z"
              fill="var(--color-icon)"
            />
          </svg>
          <span className={headerBtnLabel}>File Info</span>
        </Dialog.Trigger>
      }
    >
      <div className="flex flex-col gap-3">
        <FileInfoRow label="Name" value={filename} mono={false} />
        <FileInfoRow label="Size" value={formatSize(fileSize)} mono />
        <FileInfoRow
          label="Duration"
          value={formatSeconds(data.duration)}
          mono
        />
        <FileInfoRow
          label="Sample rate"
          value={`${data.sampleRate.toLocaleString()} Hz`}
          mono
        />
        <FileInfoRow
          label="Channels"
          value={String(data.numberOfChannels)}
          mono
        />
        {fileMeta.get(filename)?.uploadedAt != null && (
          <FileInfoRow
            label="Added"
            value={new Date(
              fileMeta.get(filename)!.uploadedAt,
            ).toLocaleDateString(undefined, {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
            mono={false}
          />
        )}
      </div>
    </AppDialog>
  );
}
