import { type ReactNode } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { XIcon } from "@phosphor-icons/react";

export function AppDialog({
  trigger,
  title,
  children,
}: {
  trigger: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <Dialog.Root>
      {trigger}
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-black/20 z-40" />
        <Dialog.Popup className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-84 rounded-xl bg-white border border-border [box-shadow:var(--shadow-dialog)] flex flex-col outline-none">
          <div className="flex items-center justify-center gap-4 h-12 px-8 border-b border-border relative">
            <Dialog.Title className="font-inria text-black/40 text-lg/6">
              {title}
            </Dialog.Title>
            <Dialog.Close className="btn-surface size-8 shrink-0 cursor-pointer outline-none absolute right-2">
              <XIcon
                size={16}
                weight="bold"
                color="var(--color-icon)"
                style={{ opacity: 0.4 }}
              />
            </Dialog.Close>
          </div>
          <div className="px-6 py-5">{children}</div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
