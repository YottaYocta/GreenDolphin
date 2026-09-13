import { useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { ArrowRightIcon, InfoIcon } from "@phosphor-icons/react";
import { Dialog } from "@base-ui/react/dialog";
import { useFirstVisit } from "../lib/useFirstVisit";
import { capture } from "../lib/posthog";

export interface TutorialStep {
  htmlSelector: string;
  contents: ReactNode;
}

const btn = "btn-surface px-3 py-1 rounded-md cursor-pointer text-sm";
const btnPrimary = `${btn} bg-play hover:bg-play-hover active:bg-play-active [box-shadow:var(--shadow-btn-colored)] text-white`;

export function Tutorial({ steps }: { steps: TutorialStep[] }) {
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
              <button onClick={markTutorialShown} className={btn}>
                <span className="opacity-40">Maybe later</span>
              </button>
              <button
                onClick={() => setWalkthroughActive(true)}
                className={btnPrimary}
              >
                Yes
              </button>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>

      {walkthroughActive && (
        <Walkthrough
          handleTutorialFinished={() => {
            capture("tutorial_completed");
            markTutorialShown();
            setWalkthroughActive(false);
          }}
          steps={steps}
        />
      )}
    </>
  );
}

const HIGHLIGHT_OFFSET = 8;

function Walkthrough({
  steps,
  handleTutorialFinished,
}: {
  steps: TutorialStep[];
  handleTutorialFinished: () => void;
}) {
  const [currentStepIndex, setCurrentStepIndex] = useState<number | null>(
    steps.length > 0 ? 0 : null,
  );

  useEffect(() => {
    if (currentStepIndex === null) handleTutorialFinished();
  }, [currentStepIndex, handleTutorialFinished]);

  const currentStep =
    currentStepIndex === null ? null : (steps[currentStepIndex] ?? null);
  const selector = currentStep?.htmlSelector ?? null;

  const [rect, setRect] = useState<DOMRect | null>(null);

  const advanceStep = (amount: number) => {
    setCurrentStepIndex((currentValue) =>
      currentValue !== null && steps[currentValue + amount]
        ? currentValue + amount
        : null,
    );
  };

  useLayoutEffect(() => {
    if (!selector) return;
    const measure = () => {
      const target = document.querySelector(selector);
      setRect(
        target instanceof HTMLElement ? target.getBoundingClientRect() : null,
      );
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [selector]);

  if (currentStepIndex === null || !currentStep || !rect) return null;

  const popupBelow = rect.top <= window.innerHeight - rect.bottom;

  return (
    <div
      className="border-4 border-emerald-500 rounded-sm fixed z-50 pointer-events-none"
      style={{
        left: rect.left - HIGHLIGHT_OFFSET,
        top: rect.top - HIGHLIGHT_OFFSET,
        width: rect.width + HIGHLIGHT_OFFSET * 2,
        height: rect.height + HIGHLIGHT_OFFSET * 2,
      }}
    >
      <div
        className={`absolute left-1/2 -translate-x-1/2 w-min min-w-64 flex flex-col rounded-xl overflow-clip bg-white border border-[#0000001A] [box-shadow:var(--shadow-menu)] ${popupBelow ? "top-full mt-4" : "bottom-full mb-4"} pointer-events-auto`}
      >
        <div className="p-4 w-full">{currentStep.contents}</div>
        <div className="flex items-center gap-2 px-2 py-2 w-full justify-between">
          <button onClick={() => setCurrentStepIndex(null)} className={btn}>
            Skip
          </button>
          <button
            onClick={() => advanceStep(-1)}
            className={`btn-surface px-3 py-1 rounded-md text-sm ${currentStepIndex > 0 ? "cursor-pointer" : "opacity-0 pointer-events-none"}`}
          >
            Back
          </button>
          <span className="text-xs opacity-70 px-3 py-1 bg-neutral-100 rounded-full whitespace-nowrap">
            {currentStepIndex + 1} / {steps.length}
          </span>
          <button
            onClick={() => advanceStep(1)}
            className={`${btnPrimary} flex items-center gap-1`}
          >
            {currentStepIndex === steps.length - 1 ? (
              "Finish"
            ) : (
              <>
                Next
                <ArrowRightIcon size={13} weight="fill" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
