import { useState } from "react";
import { Tooltip } from "@base-ui/react/tooltip";
import type { AwakeStatus } from "../lib/useAlwaysAwake";

const STATUS_COLOR: Record<AwakeStatus, string> = {
  idle: "#a3a3a3",
  active: "var(--color-play)",
  error: "#ef4444",
};

export function AlwaysAwakeIndicator({ status, error }: { status: AwakeStatus; error: string | null }) {
  const [open, setOpen] = useState(false);

  return (
    <Tooltip.Root open={open} onOpenChange={setOpen}>
      <Tooltip.Trigger
        className="fixed top-3 right-4 z-50 cursor-pointer bg-transparent border-0 p-0"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          fill="currentColor"
          viewBox="0 0 256 256"
          style={{ color: STATUS_COLOR[status] }}
        >
          <path d="M80,56V24a8,8,0,0,1,16,0V56a8,8,0,0,1-16,0Zm40,8a8,8,0,0,0,8-8V24a8,8,0,0,0-16,0V56A8,8,0,0,0,120,64Zm32,0a8,8,0,0,0,8-8V24a8,8,0,0,0-16,0V56A8,8,0,0,0,152,64Zm96,56v8a40,40,0,0,1-37.51,39.91,96.59,96.59,0,0,1-27,40.09H208a8,8,0,0,1,0,16H32a8,8,0,0,1,0-16H56.54A96.3,96.3,0,0,1,24,136V88a8,8,0,0,1,8-8H208A40,40,0,0,1,248,120ZM200,96H40v40a80.27,80.27,0,0,0,45.12,72h69.76A80.27,80.27,0,0,0,200,136Zm32,24a24,24,0,0,0-16-22.62V136a95.78,95.78,0,0,1-1.2,15A24,24,0,0,0,232,128Z" />
        </svg>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner side="bottom" align="end" sideOffset={6}>
          <Tooltip.Popup className="z-50 rounded-md bg-white border border-border shadow-(--shadow-menu) px-3 py-2 text-sm font-inria">
            <p className="font-semibold text-black">
              Keep awake status: {status === "active" ? "Active" : status === "error" ? "Error" : "Inactive"}
            </p>
            {status === "error" && error && (
              <p className="mt-1 text-red-500">{error}</p>
            )}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
