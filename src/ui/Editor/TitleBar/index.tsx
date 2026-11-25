import { useState, type ReactNode } from "react";
import type { StoredRecording } from "../../../persistence";
import { Menu } from "@base-ui/react/menu";
import { CaretRightIcon, GearSixIcon, HouseIcon, FileIcon, MusicNotesPlusIcon, type Icon } from "@phosphor-icons/react";
import { stripExt } from "../../shared/format";
import { useLibrary } from "../../context";
import { NewRecordingDialog, RecordingIcon } from "../../Library/NewRecordingDialog";
import { Dialog, IconButton } from "../../shared/primitives";

const ITEM = "flex items-center gap-3 px-4 py-3 cursor-pointer outline-none data-highlighted:bg-surface-active active:bg-surface-input";

function Action({ label, icon, size = 16, text, onClick }: { label: string; icon: Icon; size?: number; text: string; onClick: () => void }) {
  return (
    <IconButton aria-label={label} icon={icon} size={size} fill="none" onClick={onClick} className="shrink-0 size-12 md:w-auto md:px-3">
      <span className="max-md:hidden">{text}</span>
    </IconButton>
  );
}

export function TitleBar({ recording, info, editor }: { recording: StoredRecording; info: [string, string][]; editor?: ReactNode }) {
  const { recordings, open, home, remove } = useLibrary();
  const [adding, setAdding] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const others = recordings.filter((r) => r.id !== recording.id);
  const details = [...info, ["Added", new Date(recording.addedAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })]];

  return (
    <div className="flex items-center gap-2 h-12 shrink-0">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <Menu.Root>
          <Menu.Trigger aria-label="Switch recording" className="group btn-surface bg-transparent hover:bg-surface-active justify-start gap-2 h-12 rounded-lg min-w-0 max-w-64 px-3 text-ink-40 hover:text-ink-55 data-popup-open:bg-surface-active">
            <CaretRightIcon size={16} weight="fill" className="shrink-0 transition-transform group-data-popup-open:rotate-90" />
            <span className="truncate">{stripExt(recording.title)}</span>
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner side="bottom" align="start" sideOffset={8}>
              <Menu.Popup className="z-50 w-80 max-w-[calc(100vw-2rem)] rounded-xl bg-white shadow-menu overflow-hidden flex flex-col outline-none">
                <div className="overflow-y-auto max-h-72 flex flex-col">
                  {others.length === 0 && <div className="p-4 text-ink-40 text-sm text-center">No other recordings</div>}
                  {others.map((other) => (
                    <Menu.Item key={other.id} className={ITEM} onClick={() => open(other.id)}>
                      <RecordingIcon recording={other} size={18} />
                      <span className="flex-1 min-w-0 truncate">{stripExt(other.title)}</span>
                    </Menu.Item>
                  ))}
                </div>
                <Menu.Item className={`${ITEM} bg-page-bg`} onClick={() => setAdding(true)}>
                  <MusicNotesPlusIcon size={18} weight="fill" className="text-ink-40" />
                  <span>New Recording</span>
                </Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
        <Action label="File" icon={FileIcon} size={14} text="File" onClick={() => setShowInfo(true)} />
      </div>
      {editor && <Action label="Editor settings" icon={GearSixIcon} text="Editor" onClick={() => setShowEditor(true)} />}
      <Action label="Home" icon={HouseIcon} size={14} text="Home" onClick={home} />
      <NewRecordingDialog open={adding} onOpenChange={setAdding} />
      <Dialog title="Editor" open={showEditor} onOpenChange={setShowEditor}>
        {editor}
      </Dialog>
      <Dialog
        title="File"
        open={showInfo}
        onOpenChange={(next) => {
          setShowInfo(next);
          setConfirming(false);
        }}
      >
        <p className="text-lg pb-6 break-words">{stripExt(recording.title)}</p>
        <dl className="grid grid-cols-2 gap-6">
          {details.map(([label, value]) => (
            <div key={label} className="flex flex-col gap-1">
              <dt className="text-ink-40 text-sm">{label}</dt>
              <dd className="font-space-mono text-ink-70 break-all">{value}</dd>
            </div>
          ))}
        </dl>
        {confirming && <p className="text-ink-70 pt-6">Are you sure?</p>}
        <div className="flex gap-3 pt-6">
          {confirming ? (
            <>
              <button onClick={() => setConfirming(false)} className="btn-surface flex-1 h-10 rounded-lg">
                No
              </button>
              <button
                onClick={() => {
                  void remove(recording.id);
                  home();
                }}
                className="btn-surface flex-1 h-10 rounded-lg bg-danger text-white hover:bg-danger-hover active:bg-danger-active"
              >
                Yes, I'm sure
              </button>
            </>
          ) : (
            <button onClick={() => setConfirming(true)} className="btn-surface flex-1 h-10 rounded-lg text-danger">
              Delete
            </button>
          )}
        </div>
      </Dialog>
    </div>
  );
}
