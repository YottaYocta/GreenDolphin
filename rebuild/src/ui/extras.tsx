import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { Tooltip } from "@base-ui/react/tooltip";
import { ArrowCounterClockwiseIcon, ArrowRightIcon, CoffeeIcon, InfoIcon } from "@phosphor-icons/react";
import { capture } from "../analytics";
import { flag, setFlag } from "../persistence/prefs";

export interface TutorialStep {
  selector: string;
  text: string;
}

const BTN = "btn-surface px-3 py-1 rounded-md text-sm";
const PRIMARY = `${BTN} bg-play hover:bg-play-hover active:bg-play-active [box-shadow:var(--shadow-btn-colored)] text-white`;

export function Tutorial({ steps }: { steps: TutorialStep[] }) {
  const [seen, setSeen] = useState(() => flag("tutorial"));
  const [step, setStep] = useState<number | null>(null);
  const finish = () => {
    setFlag("tutorial", true);
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

type Awake = { method: "wake-lock" | "video" | null; error: string | null };
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** A silent looping video keeps some browsers awake where the Wake Lock API is missing or refused. */
async function blankVideo() {
  const canvas = Object.assign(document.createElement("canvas"), { width: 1, height: 1 });
  canvas.getContext("2d")!.fillRect(0, 0, 1, 1);
  const recorder = new MediaRecorder(canvas.captureStream(1));
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise<void>((resolve) => (recorder.onstop = () => resolve()));
  recorder.start();
  setTimeout(() => recorder.stop(), 200);
  await done;
  const video = Object.assign(document.createElement("video"), { loop: true, muted: true, playsInline: true, src: URL.createObjectURL(new Blob(chunks, { type: recorder.mimeType })) });
  video.style.cssText = "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none";
  document.body.appendChild(video);
  return video;
}

let fallback: Promise<HTMLVideoElement> | null = null;

export function KeepAwake() {
  const [state, setState] = useState<Awake>({ method: null, error: null });
  const [open, setOpen] = useState(false);
  const activate = useCallback(async () => {
    try {
      const lock = await navigator.wakeLock.request("screen");
      lock.addEventListener("release", () => setState({ method: null, error: null }));
      setState({ method: "wake-lock", error: null });
    } catch (lockError) {
      try {
        await (await (fallback ??= blankVideo())).play();
        setState({ method: "video", error: `Wake Lock: ${message(lockError)}` });
      } catch (videoError) {
        setState({ method: null, error: `Wake Lock: ${message(lockError)}; video: ${message(videoError)}` });
      }
    }
  }, []);
  useEffect(() => {
    void activate();
    const again = () => document.visibilityState === "visible" && void activate();
    document.addEventListener("visibilitychange", again);
    return () => document.removeEventListener("visibilitychange", again);
  }, [activate]);

  const color = state.method ? "var(--color-play)" : state.error ? "#ef4444" : "#a3a3a3";
  const status = state.method === "wake-lock" ? "Active (Screen Wake Lock)" : state.method === "video" ? "Active (video loop fallback)" : state.error ? "Error" : "Not yet activated";
  return (
    <div className="fixed top-3 right-4 z-50 flex items-center gap-2">
      {!state.method && state.error && (
        <button aria-label="Retry keep awake" onClick={() => void activate()} className="cursor-pointer">
          <ArrowCounterClockwiseIcon size={20} weight="fill" color="#ef4444" />
        </button>
      )}
      <Tooltip.Root open={open} onOpenChange={setOpen}>
        <Tooltip.Trigger aria-label="Keep awake status" className="cursor-pointer" onClick={() => setOpen((v) => !v)}>
          <CoffeeIcon size={20} weight="fill" color={color} />
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner side="bottom" align="end" sideOffset={6}>
            <Tooltip.Popup className="z-50 rounded-md bg-white border border-border shadow-(--shadow-menu) px-3 py-2 text-sm font-inria max-w-64">
              <p>Keep awake status: {status}</p>
              {state.error && <p className="mt-1 text-red-500">{state.error}</p>}
            </Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    </div>
  );
}
