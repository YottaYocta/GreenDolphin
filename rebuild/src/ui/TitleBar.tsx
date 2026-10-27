import { useState } from "react";
import { Menu } from "@base-ui/react/menu";
import { CaretRightIcon, FileMagnifyingGlassIcon, HouseIcon, MusicNotesPlusIcon } from "@phosphor-icons/react";
import { stripExt } from "../domain/format";
import { useLibrary } from "./context";
import { NewRecordingDialog, RecordingIcon } from "./Library";
import { Dialog } from "./primitives";

const GHOST = "flex items-center justify-center gap-2 h-12 shrink-0 rounded-lg cursor-pointer hover:bg-black/5 active:bg-black/10";
const ITEM = "flex items-center gap-3 px-4 py-3 cursor-pointer outline-none data-highlighted:bg-neutral-50 active:bg-neutral-100";

export function TitleBar({ name, info }: { name: string; info: [string, string][] }) {
  const { recordings, open, home } = useLibrary();
  const [adding, setAdding] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const others = recordings.filter((r) => r.file.name !== name);
  const addedAt = recordings.find((r) => r.file.name === name)?.addedAt;
  const details = addedAt ? [...info, ["Added", new Date(addedAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })]] : info;

  return (
    <div className="flex items-center justify-between gap-4 h-12 shrink-0">
      <div className="flex items-center min-w-0 flex-1">
        <Menu.Root>
          <Menu.Trigger aria-label="Switch recording" className={`group ${GHOST} justify-start min-w-0 px-2`}>
            <CaretRightIcon size={14} weight="bold" className="opacity-50 shrink-0 transition-transform group-data-popup-open:rotate-90" />
            <span className="font-inria truncate">{stripExt(name)}</span>
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner side="bottom" align="start" sideOffset={8}>
              <Menu.Popup className="z-50 w-80 max-w-[calc(100vw-2rem)] rounded-xl bg-white border border-border [box-shadow:var(--shadow-menu)] overflow-hidden flex flex-col outline-none">
                <div className="overflow-y-auto max-h-72 flex flex-col">
                  {others.length === 0 && <div className="p-4 font-inria text-black/50 text-sm text-center">No other recordings</div>}
                  {others.map(({ file }) => (
                    <Menu.Item key={file.name} className={ITEM} onClick={() => open(file.name)}>
                      <RecordingIcon file={file} size={18} />
                      <span className="flex-1 min-w-0 font-inria truncate">{stripExt(file.name)}</span>
                    </Menu.Item>
                  ))}
                </div>
                <Menu.Item className={`${ITEM} border-t border-border`} onClick={() => setAdding(true)}>
                  <MusicNotesPlusIcon size={18} weight="fill" className="opacity-50" />
                  <span className="font-inria">New Recording</span>
                </Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
        <button aria-label="File info" onClick={() => setShowInfo(true)} className={`${GHOST} size-12`}>
          <FileMagnifyingGlassIcon size={16} weight="fill" className="opacity-50" />
        </button>
      </div>
      <button aria-label="Home" onClick={home} className={`${GHOST} px-3 max-md:size-12 max-md:px-0`}>
        <HouseIcon size={16} weight="fill" className="opacity-50" />
        <span className="opacity-40 font-inria max-md:hidden">Home</span>
      </button>
      <NewRecordingDialog open={adding} onOpenChange={setAdding} />
      <Dialog title="File Info" open={showInfo} onOpenChange={setShowInfo}>
        <p className="font-inria text-lg pb-6 break-words">{stripExt(name)}</p>
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
