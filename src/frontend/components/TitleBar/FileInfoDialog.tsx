import { useContext } from "react";
import { AudioStore } from "../../AudioStore";
import { RecordingsStore } from "../../RecordingsStore";
import { formatSeconds, formatSize, stripExt } from "../../lib/util";
import { AppDialog } from "../AppDialog";

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

type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function InfoDialog({
  children,
  ...props
}: DialogProps & { children: React.ReactNode }) {
  return (
    <AppDialog title="File Info" {...props}>
      {children}
    </AppDialog>
  );
}

/** File metadata dialog for the current recording; opened from the recordings menu. */
export function FileInfoDialog(props: DialogProps) {
  const { audio, video } = useContext(AudioStore);
  const { fileMeta } = useContext(RecordingsStore);

  if (video) {
    const uploadedAt = fileMeta.get(video.filename)?.uploadedAt;
    return (
      <InfoDialog {...props}>
        <div className="flex flex-col gap-6 p-2">
          <span className="font-inria text-black text-lg min-w-0">
            {stripExt(video.filename)}
          </span>
          <div className="flex flex-col gap-6">
            <div className="flex gap-4">
              <FileInfoCell label="Source" value="YouTube" />
              <FileInfoCell label="Video ID" value={video.videoId} />
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
      </InfoDialog>
    );
  }

  if (!audio) return null;
  const { buffer: data, filename, fileSize } = audio;

  const uploadedAt = fileMeta.get(filename)?.uploadedAt;

  return (
    <InfoDialog {...props}>
      <div className="flex flex-col gap-6 p-2">
        <div className="flex gap-4 flex-col items-start">
          <span className="font-inria text-black text-lg min-w-0">
            {stripExt(filename)}
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
    </InfoDialog>
  );
}
