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
import { ArrowRightIcon } from "@phosphor-icons/react";
export interface TutorialStep {
  htmlSelector: string;
  contents: ReactNode;
}

export interface TutorialProps {
  steps: TutorialStep[];
  handleTutorialFinished?: () => void;
}

export const Tutorial: FC<TutorialProps> = ({
  steps,
  handleTutorialFinished,
}) => {
  const HIGHLIGHT_OFFSET = 8;

  const [currentStepIndex, setCurrentStepIndex] = useState<number | null>(
    steps.length > 0 ? 0 : null,
  );

  useEffect(() => {
    if (steps.length === 0) setCurrentStepIndex(null);
    else setCurrentStepIndex(0);
  }, [steps]);

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
        className="border-4 border-emerald-500 rounded-sm fixed z-50"
      >
        <div
          className={`absolute left-1/2 -translate-x-1/2 w-min min-w-64 flex flex-col rounded-xl overflow-clip bg-white border border-[#0000001A] [box-shadow:var(--shadow-menu)] ${popupBelow ? "top-full mt-4" : "bottom-full mb-4"}`}
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
              {currentStepIndex !== null && currentStepIndex === steps.length - 1
                ? "Finish"
                : "Next"}
              <ArrowRightIcon size={13} weight="fill" />
            </button>
          </div>
        </div>
      </div>
    </>
  ) : (
    <></>
  );
};
