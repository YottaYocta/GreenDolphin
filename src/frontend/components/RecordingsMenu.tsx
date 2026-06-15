import { useContext, useRef } from "react";
import { Menu } from "@base-ui/react/menu";
import { AudioStore } from "../AudioStore";
import { RecordingsStore } from "../RecordingsStore";
import { useDecodeFile } from "../lib/useDecodeFile";

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
        <Menu.Trigger className={`${headerBtn} w-full h-12 cursor-pointer min-w-0`}>
          <span className="font-inria text-black text-base/5 truncate min-w-0">
            {filename}
          </span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="21"
            height="21"
            viewBox="0 0 256 256"
            style={{ flexShrink: 0 }}
          >
            <path
              d="M156,128a28,28,0,1,1-28-28A28,28,0,0,1,156,128ZM48,100a28,28,0,1,0,28,28A28,28,0,0,0,48,100Zm160,0a28,28,0,1,0,28,28A28,28,0,0,0,208,100Z"
              fill="#666666"
            />
          </svg>
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner side="bottom" align="start" sideOffset={8}>
            <Menu.Popup className="z-50 w-80 rounded-xl bg-white border border-border [box-shadow:var(--shadow-menu)] overflow-hidden flex flex-col outline-none">
              <Menu.Item
                className="shrink-0 flex items-center gap-3 px-4 py-3 cursor-pointer outline-none data-highlighted:bg-neutral-50 active:bg-neutral-100 border-b border-border"
                closeOnClick={false}
                onClick={() => uploadInputRef.current?.click()}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 256 256"
                  style={{ opacity: 0.5, flexShrink: 0 }}
                >
                  <path d="M232,48a8,8,0,0,1-8,8H208V72a8,8,0,0,1-16,0V56H176a8,8,0,0,1,0-16h16V24a8,8,0,0,1,16,0V40h16A8,8,0,0,1,232,48ZM160.6,77.86l-6.76-6.76A32.85,32.85,0,0,1,144,49.33a31.87,31.87,0,0,1,1.67-11.66,4,4,0,0,0-4.76-5.14L78.06,48.25A8,8,0,0,0,72,56V166.1A36,36,0,1,0,52.42,232C72.25,231.77,88,215.13,88,195.3V102.25l70.74-17.69A4,4,0,0,0,160.6,77.86Zm50.11,24.31a31.91,31.91,0,0,1-7.14,1.63,4,4,0,0,0-3.57,4V134.1A36,36,0,1,0,180.42,200c19.83-.23,35.58-16.86,35.58-36.7V106A4,4,0,0,0,210.71,102.17Z" />
                </svg>
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
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="18"
                        height="18"
                        viewBox="0 0 256 256"
                        style={{ opacity: 0.4, flexShrink: 0 }}
                      >
                        <path d="M210.3,56.34l-80-24A8,8,0,0,0,120,40V148.26A48,48,0,1,0,136,184V98.75l69.7,20.91A8,8,0,0,0,216,112V64A8,8,0,0,0,210.3,56.34Z" />
                      </svg>
                      <span
                        className={`flex-1 min-w-0 font-inria text-base/5 truncate ${file.name === filename ? "font-bold text-black" : "text-black"}`}
                      >
                        {file.name}
                      </span>
                      {file.name === filename && (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 256 256"
                          style={{ flexShrink: 0 }}
                        >
                          <path
                            d="M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z"
                            fill="var(--color-play)"
                          />
                        </svg>
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
