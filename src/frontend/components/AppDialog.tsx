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
          <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-border">
            <Dialog.Title className="font-inria font-bold text-black text-lg/6">
              {title}
            </Dialog.Title>
            <Dialog.Close className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-neutral-100 active:bg-neutral-200 cursor-pointer outline-none -mt-0.5 -mr-0.5">
              <XIcon size={16} weight="bold" color="var(--color-icon-muted)" />
            </Dialog.Close>
          </div>
          <div className="px-6 py-5">
            {children}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
