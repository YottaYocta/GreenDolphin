import { useCallback, useEffect, useState } from "react";
import { Tooltip } from "@base-ui/react/tooltip";
import { ArrowCounterClockwiseIcon, CoffeeIcon } from "@phosphor-icons/react";

type Awake = { method: "wake-lock" | "video" | null; error: string | null };
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

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
