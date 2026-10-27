import { useLayoutEffect, useState } from "react";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { ArrowRightIcon, InfoIcon } from "@phosphor-icons/react";
import { capture } from "../../analytics";
import { persistence } from "../../persistence";

export interface TutorialStep {
  selector: string;
  text: string;
}

const BTN = "btn-surface px-3 py-1 rounded-md text-sm";
const PRIMARY = `${BTN} bg-play hover:bg-play-hover active:bg-play-active [box-shadow:var(--shadow-btn-colored)] text-white`;

export function Tutorial({ steps }: { steps: TutorialStep[] }) {
  const [seen, setSeen] = useState(() => persistence.flag("tutorial"));
  const [step, setStep] = useState<number | null>(null);
  const finish = () => {
    persistence.setFlag("tutorial", true);
    setSeen(true);
    setStep(null);
  };
  return (
    <>
      {seen && step === null && (
        <button aria-label="Restart tutorial" onClick={() => setStep(0)} className="fixed top-3 left-4 z-50 cursor-pointer">
          <InfoIcon size={20} color="#a3a3a3" weight="fill" />
        </button>
      )}
      <BaseDialog.Root open={!seen && step === null} onOpenChange={(open) => !open && finish()}>
        <BaseDialog.Portal>
          <BaseDialog.Backdrop className="fixed inset-0 bg-black/20 z-40" />
          <BaseDialog.Popup className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-84 rounded-xl bg-white border border-border [box-shadow:var(--shadow-dialog)] flex flex-col gap-6 p-6 outline-none">
            <BaseDialog.Title className="font-inria text-black/60 text-center">
              Welcome to GreenDolphin!
              <br />
              Would you like a tutorial?
            </BaseDialog.Title>
            <div className="flex justify-center gap-4">
              <button onClick={finish} className={BTN}>
                <span className="opacity-40">Maybe later</span>
              </button>
              <button onClick={() => setStep(0)} className={PRIMARY}>
                Yes
              </button>
            </div>
          </BaseDialog.Popup>
        </BaseDialog.Portal>
      </BaseDialog.Root>
      {step !== null && (
        <Walkthrough
          steps={steps}
          step={step}
          onStep={(next) => {
            if (next >= 0 && next < steps.length) return setStep(next);
            capture("tutorial_completed");
            finish();
          }}
        />
      )}
    </>
  );
}

function Walkthrough({ steps, step, onStep }: { steps: TutorialStep[]; step: number; onStep: (next: number) => void }) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const { selector, text } = steps[step];
  useLayoutEffect(() => {
    const measure = () => setRect(document.querySelector(selector)?.getBoundingClientRect() ?? null);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [selector]);
  if (!rect) return null;
  const below = rect.top <= window.innerHeight - rect.bottom;
  return (
    <div className="border-4 border-emerald-500 rounded-sm fixed z-50 pointer-events-none" style={{ left: rect.left - 8, top: rect.top - 8, width: rect.width + 16, height: rect.height + 16 }}>
      <div className={`absolute left-1/2 -translate-x-1/2 min-w-64 flex flex-col rounded-xl bg-white border border-border [box-shadow:var(--shadow-menu)] pointer-events-auto ${below ? "top-full mt-4" : "bottom-full mb-4"}`}>
        <p className="p-4 font-inria">{text}</p>
        <div className="flex items-center justify-between gap-2 p-2">
          <button onClick={() => onStep(-1)} className={BTN}>
            Skip
          </button>
          <button onClick={() => onStep(step - 1)} className={`${BTN} ${step === 0 ? "invisible" : ""}`}>
            Back
          </button>
          <span className="text-xs opacity-70 px-3 py-1 bg-neutral-100 rounded-full">
            {step + 1} / {steps.length}
          </span>
          <button onClick={() => onStep(step + 1)} className={`${PRIMARY} flex items-center gap-1`}>
            {step === steps.length - 1 ? "Finish" : <>Next <ArrowRightIcon size={13} weight="fill" /></>}
          </button>
        </div>
      </div>
    </div>
  );
}
