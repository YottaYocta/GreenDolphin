import { useContext } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { AudioStore } from "../AudioStore";
import { RecordingsStore } from "../RecordingsStore";
import { formatSeconds, formatSize } from "../lib/util";

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
    <Dialog.Root>
      <Dialog.Trigger
        className={`${headerBtn} w-full h-12 cursor-pointer`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="21"
          height="21"
          viewBox="0 0 256 256"
          style={{ opacity: 0.54, flexShrink: 0 }}
        >
          <path
            d="M144,148a20,20,0,1,1-20-20A20,20,0,0,1,144,148Zm72-60V216a16,16,0,0,1-16,16H56a16,16,0,0,1-16-16V40A16,16,0,0,1,56,24h96a8,8,0,0,1,5.66,2.34l56,56A8,8,0,0,1,216,88Zm-50.34,90.34-11.2-11.19a36.05,36.05,0,1,0-11.31,11.31l11.19,11.2a8,8,0,0,0,11.32-11.32ZM196,88,152,44V88Z"
            fill="#000000"
          />
        </svg>
        <span className={headerBtnLabel}>File Info</span>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-black/20 z-40" />
        <Dialog.Popup className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-84 rounded-xl bg-white border border-border [box-shadow:var(--shadow-dialog)] p-6 flex flex-col gap-5 outline-none">
          <div className="flex items-start justify-between gap-4">
            <Dialog.Title className="font-inria font-bold text-black text-lg/6">
              File Info
            </Dialog.Title>
            <Dialog.Close className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-neutral-100 active:bg-neutral-200 cursor-pointer outline-none -mt-0.5 -mr-0.5">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 256 256"
              >
                <path
                  d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z"
                  fill="#666"
                />
              </svg>
            </Dialog.Close>
          </div>
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
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
