import { useEffect, useState } from "react";
import { tinykeys } from "tinykeys";
import { Drawer } from "@base-ui/react/drawer";
import { NumericInput } from "./PlaybackSettings";

const DEV = import.meta.env.VITE_DEV_TOOLS === "true";

export function DevDrawer() {
  const [open, setOpen] = useState(false);
  const [numVal, setNumVal] = useState("1.5");

  useEffect(() => {
    if (!DEV) return;
    return tinykeys(window, {
      "$mod+i": (e) => {
        e.preventDefault();
        setOpen((o) => !o);
      },
    });
  }, []);

  if (!DEV) return null;

  return (
    <Drawer.Root open={open} onOpenChange={setOpen} swipeDirection="right">
      <Drawer.Portal>
        <Drawer.Backdrop className="fixed inset-0 bg-black/20 z-40" />
        <Drawer.Viewport className="fixed inset-0 z-50 flex justify-end pointer-events-none">
          <Drawer.Popup className="pointer-events-auto w-80 h-full bg-white shadow-xl p-6 overflow-y-auto outline-none flex flex-col">
            <p className="text-lg font-mono text-black/40 mb-6">Components</p>

            <section className="mb-6">
              <p className="text-sm font-medium mb-3">NumericInput</p>
              <div className="flex items-center gap-3">
                <NumericInput
                  value={numVal}
                  onCommit={(v) => setNumVal(String(v))}
                />
                <span className="text-sm text-black/50">
                  committed: {numVal}
                </span>
              </div>
            </section>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
