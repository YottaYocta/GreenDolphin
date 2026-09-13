import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FC,
  type ReactNode,
} from "react";
import { ArrowRightIcon, InfoIcon } from "@phosphor-icons/react";
import { Dialog } from "@base-ui/react/dialog";
import { useFirstVisit } from "../lib/useFirstVisit";
import { capture } from "../lib/posthog";

export interface TutorialStep {
  htmlSelector: string;
  contents: ReactNode;
}

export function Tutorial({
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
        <Walkthrough
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

const Walkthrough: FC<{
  steps: TutorialStep[];
  handleTutorialFinished?: () => void;
}> = ({ steps, handleTutorialFinished }) => {
  const HIGHLIGHT_OFFSET = 8;

  const [currentStepIndex, setCurrentStepIndex] = useState<number | null>(
    steps.length > 0 ? 0 : null,
  );

  useEffect(() => {
    if (steps.length === 0) setCurrentStepIndex(null);
    else if (currentStepIndex !== null && currentStepIndex >= steps.length)
      setCurrentStepIndex(null);
  }, [currentStepIndex, steps]);

  useEffect(() => {
    if (handleTutorialFinished && currentStepIndex === null)
      handleTutorialFinished();
  }, [currentStepIndex, handleTutorialFinished]);

  const currentStep = useMemo<TutorialStep | null>(() => {
    if (currentStepIndex !== null && steps && steps[currentStepIndex]) {
      return steps[currentStepIndex];
    } else return null;
  }, [currentStepIndex, steps]);

  const [popupBelow, setPopupBelow] = useState(true);
  const highlightRef = useRef<HTMLDivElement>(null);

  const advanceStep = (amount: number) => {
    if (steps.length === 0) setCurrentStepIndex(null);
    else {
      setCurrentStepIndex((currentValue) => {
        if (currentValue !== null && steps[currentValue + amount])
          return currentValue + amount;
        else {
          return null;
        }
      });
    }
  };

  const updateContainerRef = useCallback(() => {
    if (highlightRef.current && currentStep) {
      const selection = document.querySelector(currentStep.htmlSelector);
      if (selection instanceof HTMLElement) {
        const rect = selection.getBoundingClientRect();
        setPopupBelow(rect.top <= window.innerHeight - rect.bottom);
        highlightRef.current.style.left = `${rect.left - HIGHLIGHT_OFFSET}px`;
        highlightRef.current.style.top = `${rect.top - HIGHLIGHT_OFFSET}px`;
        highlightRef.current.style.width = `${rect.width + HIGHLIGHT_OFFSET * 2}px`;
        highlightRef.current.style.height = `${rect.height + HIGHLIGHT_OFFSET * 2}px`;
      }
    }
  }, [currentStep]);

  useLayoutEffect(() => {
    updateContainerRef();
    window.addEventListener("resize", updateContainerRef);
    return () => {
      window.removeEventListener("resize", updateContainerRef);
    };
  }, [updateContainerRef]);

  return currentStep ? (
    <>
      <div
        ref={highlightRef}
        className="border-4 border-emerald-500 rounded-sm fixed z-50 pointer-events-none"
      >
        <div
          className={`absolute left-1/2 -translate-x-1/2 w-min min-w-64 flex flex-col rounded-xl overflow-clip bg-white border border-[#0000001A] [box-shadow:var(--shadow-menu)] ${popupBelow ? "top-full mt-4" : "bottom-full mb-4"} pointer-events-auto`}
        >
          <div className="p-4 w-full">{currentStep.contents}</div>
          <div className="flex items-center gap-2 px-2 py-2 w-full justify-between">
            <button
              onClick={() => setCurrentStepIndex(null)}
              className="btn-surface px-3 py-1 rounded-md cursor-pointer text-sm"
            >
              Skip
            </button>
            <button
              onClick={() => advanceStep(-1)}
              className={`btn-surface px-3 py-1 rounded-md text-sm ${currentStepIndex !== null && currentStepIndex > 0 ? "cursor-pointer" : "opacity-0 pointer-events-none"}`}
            >
              Back
            </button>
            <span className="text-xs opacity-70 px-3 py-1 bg-neutral-100 rounded-full whitespace-nowrap">
              {(currentStepIndex ?? 0) + 1} / {steps.length}
            </span>
            <button
              onClick={() => advanceStep(1)}
              className="btn-surface px-3 py-1 rounded-md cursor-pointer text-sm flex items-center gap-1 bg-play hover:bg-play-hover active:bg-play-active [box-shadow:var(--shadow-btn-colored)] text-white"
            >
              {currentStepIndex !== null &&
              currentStepIndex === steps.length - 1 ? (
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
    </>
  ) : (
    <></>
  );
};
