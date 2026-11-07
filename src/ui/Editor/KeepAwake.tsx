import { useEffect, useState } from "react";
import { CheckIcon } from "@phosphor-icons/react";

type Status = "hidden" | "offer" | "checking" | "done" | "failed" | "spent";

const RESULT_MS = 1500;
const SHOWN = new Set<Status>(["offer", "checking", "done", "failed"]);

let held: WakeLockSentinel | null = null;
const requestLock = async () => {
  held = await navigator.wakeLock.request("screen");
};

export function KeepAwake({ enabled }: { enabled: boolean }) {
  const [status, setStatus] = useState<Status>("hidden");

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    const attempt = () =>
      requestLock().then(
        () => live && setStatus((s) => (s === "offer" ? "hidden" : s)),
        () => live && setStatus((s) => (s === "hidden" ? "offer" : s)),
      );
    void attempt();
    const again = () => document.visibilityState === "visible" && void attempt();
    document.addEventListener("visibilitychange", again);
    return () => {
      live = false;
      document.removeEventListener("visibilitychange", again);
      void held?.release();
      held = null;
    };
  }, [enabled]);

  useEffect(() => {
    if (status !== "done" && status !== "failed") return;
    const timer = setTimeout(() => setStatus("spent"), RESULT_MS);
    return () => clearTimeout(timer);
  }, [status]);

  if (!enabled || !SHOWN.has(status)) return null;
  const retry = () => {
    setStatus("checking");
    requestLock().then(
      () => setStatus("done"),
      () => setStatus("failed"),
    );
  };
  return (
    <button
      onClick={retry}
      disabled={status !== "offer"}
      className={`flex items-center justify-center gap-2 shrink-0 h-11 px-4 rounded-xl border border-border bg-surface [box-shadow:var(--shadow-btn)] font-inria truncate cursor-pointer enabled:hover:bg-white enabled:active:bg-neutral-100 disabled:cursor-default ${status === "failed" ? "text-red-600/80" : status === "done" ? "text-play" : "text-black/60"}`}
    >
      Keep my phone awake
      {status === "done" && <CheckIcon size={16} weight="bold" />}
    </button>
  );
}
