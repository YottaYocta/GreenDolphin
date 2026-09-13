import { useState } from "react";
import { InfoIcon } from "@phosphor-icons/react";
import { Dialog } from "@base-ui/react/dialog";
import { Tutorial, type TutorialStep } from "./Tutorial";
import { useFirstVisit } from "../lib/useFirstVisit";
import { capture } from "../lib/posthog";

export function TutorialFlow({
  steps,
  ready = true,
  source,
}: {
  steps: TutorialStep[];
  ready?: boolean;
  source?: string;
}) {
  const { isFirstVisit: showTutorial, markVisited: markTutorialShown } =
    useFirstVisit();
  const [walkthroughActive, setWalkthroughActive] = useState(false);

  return (
    <>
      {!showTutorial && !walkthroughActive && (
        <button
          onClick={() => setWalkthroughActive(true)}
          aria-label="Restart tutorial"
          className="fixed top-3 left-4 z-50 cursor-pointer bg-transparent border-0 p-0"
        >
          <InfoIcon size={20} color="#a3a3a3" weight="fill" />
        </button>
      )}

      <Dialog.Root
        open={showTutorial && !walkthroughActive}
        onOpenChange={(open) => {
          if (!open) markTutorialShown();
        }}
      >
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 bg-black/20 z-40" />
          <Dialog.Popup className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-84 rounded-xl bg-white border border-border [box-shadow:var(--shadow-dialog)] flex flex-col gap-6 p-6 outline-none">
            <Dialog.Title className="font-inria text-black/60 text-center">
              Welcome to GreenDolphin!
              <br />
              Would you like a tutorial?
            </Dialog.Title>
            <div className="flex justify-center gap-4">
              <button
                onClick={markTutorialShown}
                className="btn-surface px-3 py-1 rounded-md cursor-pointer text-sm"
              >
                <span className="opacity-40">Maybe later</span>
              </button>
              <button
                onClick={() => setWalkthroughActive(true)}
                className="btn-surface px-3 py-1 rounded-md cursor-pointer text-sm bg-play hover:bg-play-hover active:bg-play-active [box-shadow:var(--shadow-btn-colored)] text-white"
              >
                Yes
              </button>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>

      {walkthroughActive && ready && (
        <Tutorial
          handleTutorialFinished={() => {
            capture("tutorial_completed", source ? { source } : undefined);
            markTutorialShown();
            setWalkthroughActive(false);
          }}
          steps={steps}
        />
      )}
    </>
  );
}
