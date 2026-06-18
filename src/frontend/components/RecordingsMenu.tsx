import { useContext, useRef } from "react";
import { Menu } from "@base-ui/react/menu";
import {
  MusicNotesPlusIcon,
  MusicNoteIcon,
  CheckIcon,
} from "@phosphor-icons/react";
import { AudioStore } from "../AudioStore";
import { RecordingsStore } from "../RecordingsStore";
import { useDecodeFile } from "../lib/useDecodeFile";
import { noteColor } from "../lib/util";

const headerBtn = "btn-surface rounded-lg gap-3 px-3.25 py-3.25";

export function RecordingsMenu() {
  const decodeFile = useDecodeFile();
  const { cachedFiles, cacheFile } = useContext(RecordingsStore);
  const { audio } = useContext(AudioStore);
  const filename = audio?.filename ?? "";
  const uploadInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="min-w-0">
      <Menu.Root>
        <Menu.Trigger
          className={`${headerBtn} w-full h-12 cursor-pointer min-w-0`}
        >
          <span className="font-inria text-black text-base/5 truncate min-w-0">
            {filename}
          </span>
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner side="bottom" align="start" sideOffset={8}>
            <Menu.Popup className="z-50 w-80 rounded-xl bg-white border border-border [box-shadow:var(--shadow-menu)] overflow-hidden flex flex-col outline-none">
              <Menu.Item
                className="shrink-0 flex items-center gap-3 px-4 py-3 cursor-pointer outline-none data-highlighted:bg-neutral-50 active:bg-neutral-100 border-b border-border"
                closeOnClick={false}
                onClick={() => uploadInputRef.current?.click()}
              >
                <MusicNotesPlusIcon
                  size={18}
                  weight="fill"
                  style={{ opacity: 0.5, flexShrink: 0 }}
                />
                <span className="font-inria text-black text-base/5">
                  Upload a Recording
                </span>
              </Menu.Item>
              <div className="overflow-y-auto max-h-72 flex flex-col">
                {cachedFiles.length === 0 ? (
                  <div className="px-4 py-4 opacity-40 font-inria text-black text-sm text-center">
                    No recordings yet
                  </div>
                ) : (
                  cachedFiles.map((file) => (
                    <Menu.Item
                      key={file.name}
                      className="flex items-center gap-3 px-4 py-3 cursor-pointer outline-none data-highlighted:bg-neutral-50 active:bg-neutral-100"
                      onClick={async () => {
                        await decodeFile(file);
                      }}
                    >
                      <MusicNoteIcon
                        size={18}
                        weight="fill"
                        color={noteColor(file.name)}
                        style={{ flexShrink: 0 }}
                      />
                      <span
                        className={`flex-1 min-w-0 font-inria text-base/5 truncate ${file.name === filename ? "font-bold text-black" : "text-black"}`}
                      >
                        {file.name}
                      </span>
                      {file.name === filename && (
                        <CheckIcon
                          size={16}
                          weight="bold"
                          color="var(--color-play)"
                          style={{ flexShrink: 0 }}
                        />
                      )}
                    </Menu.Item>
                  ))
                )}
              </div>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>

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
        }}
      />
    </div>
  );
}
