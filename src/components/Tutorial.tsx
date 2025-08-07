import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FC,
  type ReactNode,
} from "react";
import { Button } from "./buttons";

export interface TutorialStep {
  htmlSelector: string;
  contents: ReactNode;
}

export interface TutorialProps {
  steps: TutorialStep[];
}

export const Tutorial: FC<TutorialProps> = ({ steps }) => {
  const [currentStepIndex, setCurrentStepIndex] = useState<number | null>(
    steps.length > 0 ? 0 : null
  );

  useEffect(() => {
    if (steps.length === 0) setCurrentStepIndex(null);
    else setCurrentStepIndex(0);
  }, [steps]);

  const currentStep = useMemo<TutorialStep | null>(() => {
    if (currentStepIndex !== null && steps && steps[currentStepIndex]) {
      return steps[currentStepIndex];
    } else return null;
  }, [currentStepIndex, steps]);

  const containerRef = useRef<HTMLDivElement>(null);

  const advanceStep = (amount: number) => {
    if (steps.length === 0) setCurrentStepIndex(null);
    else {
      setCurrentStepIndex((currentValue) => {
        if (currentValue !== null && steps[currentValue + amount])
          return currentValue + amount;
        else return null;
      });
    }
  };

  const updateContainerRef = useCallback(() => {
    if (containerRef.current && currentStep) {
      const selection = document.querySelector(currentStep.htmlSelector);
      if (selection instanceof HTMLElement) {
        const rect = selection.getBoundingClientRect();
        containerRef.current.style.left = `${rect.left + rect.width}px`;
        containerRef.current.style.top = `${rect.top}px`;
      }
    }
  }, [currentStep]);

  useEffect(() => {
    updateContainerRef();
    window.addEventListener("resize", updateContainerRef);
    return () => {
      window.removeEventListener("resize", updateContainerRef);
    };
  }, [updateContainerRef]);

  return currentStep ? (
    <div
      ref={containerRef}
      className="fixed min-w-16 min-h-4 bg-white border border-neutral-2 z-50 max-w-64 p-2 flex flex-col gap-4"
    >
      {currentStep.contents}
      <div className="flex items-center justify-between gap-2">
        <Button onClick={() => setCurrentStepIndex(null)} text="Skip"></Button>
        <div className="flex items-center gap-2">
          {currentStepIndex !== null && currentStepIndex > 0 ? (
            <Button text="Previous" onClick={() => advanceStep(-1)}></Button>
          ) : (
            <></>
          )}
          <Button
            onClick={() => advanceStep(1)}
            className="border border-emerald-500 rounded-full bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
            text={
              currentStepIndex !== null && currentStepIndex === steps.length - 1
                ? "Finish"
                : "Next"
            }
          ></Button>
        </div>
      </div>
    </div>
  ) : (
    <></>
  );
};
