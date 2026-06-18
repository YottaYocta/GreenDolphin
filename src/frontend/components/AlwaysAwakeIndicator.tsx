import { useState } from "react";
import { Tooltip } from "@base-ui/react/tooltip";
import { CoffeeIcon } from "@phosphor-icons/react";
import type { AwakeState } from "../lib/useAlwaysAwake";

function iconColor({ method, wakeLockError, videoError }: AwakeState): string {
  if (method === "wake-lock" || method === "video") return "var(--color-play)";
  if (wakeLockError || videoError) return "#ef4444";
  return "#a3a3a3";
}

export function AlwaysAwakeIndicator(props: AwakeState) {
  const { method, wakeLockError, videoError } = props;
  const [open, setOpen] = useState(false);

  return (
    <Tooltip.Root open={open} onOpenChange={setOpen}>
      <Tooltip.Trigger
        className="fixed top-3 right-4 z-50 cursor-pointer bg-transparent border-0 p-0"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
      >
        <CoffeeIcon size={20} weight="fill" color={iconColor(props)} />
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner side="bottom" align="end" sideOffset={6}>
          <Tooltip.Popup className="z-50 rounded-md bg-white border border-border shadow-(--shadow-menu) px-3 py-2 text-sm font-inria max-w-64">
            {method === "wake-lock" && (
              <p>Keep awake status: Active (Screen Wake Lock)</p>
            )}
            {method === "video" && (
              <>
                <p>Keep awake status: Active (video loop fallback)</p>
                <p className="mt-1 text-[#a3a3a3]">Wake Lock failed: {wakeLockError}</p>
              </>
            )}
            {method === null && (wakeLockError || videoError) && (
              <>
                <p>Keep awake status: Error</p>
                {wakeLockError && <p className="mt-1 text-red-500">Wake Lock: {wakeLockError}</p>}
                {videoError && <p className="mt-1 text-red-500">Video: {videoError}</p>}
              </>
            )}
            {method === null && !wakeLockError && !videoError && (
              <p className="text-[#a3a3a3]">Not yet activated</p>
            )}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
