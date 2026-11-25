import { useState, type ReactNode } from "react";
import type { StoredRecording } from "../../../persistence";
import { Menu } from "@base-ui/react/menu";
import { CaretRightIcon, GearSixIcon, HouseIcon, InfoIcon, MusicNotesPlusIcon } from "@phosphor-icons/react";
import { stripExt } from "../../shared/format";
import { useLibrary } from "../../context";
import { NewRecordingDialog, RecordingIcon } from "../../Library/NewRecordingDialog";
import { Dialog } from "../../shared/primitives";

const GHOST = "flex items-center gap-2 h-12 rounded-lg cursor-pointer hover:bg-black/5 active:bg-black/10";
const TEXT_BUTTON = "flex items-center cursor-pointer hover:text-black/60 active:text-black/40 data-popup-open:text-black/60";
const ACTION = "justify-center shrink-0 px-3 max-md:size-12 max-md:px-0";
const ITEM = "flex items-center gap-3 px-4 py-3 cursor-pointer outline-none data-highlighted:bg-neutral-50 active:bg-neutral-100";

function Action({ label, icon: Icon, text, onClick }: { label: string; icon: typeof InfoIcon; text?: string; onClick: () => void }) {
  return (
    <button aria-label={label} onClick={onClick} className={`${GHOST} ${ACTION}`}>
      <Icon size={16} weight="fill" className="opacity-50" />
      {text && <span className="opacity-40 font-inria max-md:hidden">{text}</span>}
    </button>
  );
}

export function TitleBar({ recording, info, editor }: { recording: StoredRecording; info: [string, string][]; editor?: ReactNode }) {
  const { recordings, open, home } = useLibrary();
  const [adding, setAdding] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const others = recordings.filter((r) => r.id !== recording.id);
  const details = [...info, ["Added", new Date(recording.addedAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })]];

  return (
    <div className="flex items-center gap-2 h-12 shrink-0">
      <div className="flex items-center gap-1 min-w-0 flex-1">
        <Menu.Root>
          <Menu.Trigger aria-label="Switch recording" className={`group ${TEXT_BUTTON} gap-2 h-12 min-w-0 pl-3 text-black/40`}>
            <CaretRightIcon size={14} weight="bold" className="shrink-0 transition-transform group-data-popup-open:rotate-90" />
            <span className="font-inria truncate">{stripExt(recording.title)}</span>
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner side="bottom" align="start" sideOffset={8}>
              <Menu.Popup className="z-50 w-80 max-w-[calc(100vw-2rem)] rounded-xl bg-white [box-shadow:var(--shadow-menu)] overflow-hidden flex flex-col outline-none">
                <div className="overflow-y-auto max-h-72 flex flex-col">
                  {others.length === 0 && <div className="p-4 font-inria text-black/50 text-sm text-center">No other recordings</div>}
                  {others.map((other) => (
                    <Menu.Item key={other.id} className={ITEM} onClick={() => open(other.id)}>
                      <RecordingIcon recording={other} size={18} />
                      <span className="flex-1 min-w-0 font-inria truncate">{stripExt(other.title)}</span>
                    </Menu.Item>
                  ))}
                </div>
                <Menu.Item className={`${ITEM} bg-surface-track`} onClick={() => setAdding(true)}>
                  <MusicNotesPlusIcon size={18} weight="fill" className="opacity-50" />
                  <span className="font-inria">New Recording</span>
                </Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
        <Action label="File info" icon={InfoIcon} onClick={() => setShowInfo(true)} />
      </div>
      {editor && <Action label="Editor settings" icon={GearSixIcon} text="Editor" onClick={() => setShowEditor(true)} />}
      <Action label="Home" icon={HouseIcon} text="Home" onClick={home} />
      <NewRecordingDialog open={adding} onOpenChange={setAdding} />
      <Dialog title="Editor" open={showEditor} onOpenChange={setShowEditor}>
        {editor}
      </Dialog>
      <Dialog title="File Info" open={showInfo} onOpenChange={setShowInfo}>
        <p className="font-inria text-lg pb-6 break-words">{stripExt(recording.title)}</p>
        <dl className="grid grid-cols-2 gap-6">
          {details.map(([label, value]) => (
            <div key={label} className="flex flex-col gap-1">
              <dt className="font-inria text-black/40 text-sm">{label}</dt>
              <dd className="font-space-mono text-black/90 break-all">{value}</dd>
            </div>
          ))}
        </dl>
      </Dialog>
    </div>
  );
}
