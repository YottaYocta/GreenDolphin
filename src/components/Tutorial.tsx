import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FC,
  type ReactNode,
} from "react";

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
      className="fixed min-w-16 min-h-4 bg-white border border-neutral-2 z-50"
    >
      {currentStep.contents}
      <button onClick={() => setCurrentStepIndex(null)}>Skip</button>
      {currentStepIndex !== null && currentStepIndex > 0 ? (
        <button onClick={() => advanceStep(-1)}>Previous</button>
      ) : (
        <></>
      )}
      <button onClick={() => advanceStep(1)}>
        {currentStepIndex !== null && currentStepIndex === steps.length - 1
          ? "Finish"
          : "Next"}
      </button>
    </div>
  ) : (
    <></>
  );
};
