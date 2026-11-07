import { useEffect, useState } from "react";

const NOTICE_MS = 1500;

let held: WakeLockSentinel | null = null;
const requestLock = async () => {
  held = await navigator.wakeLock.request("screen");
};

export function KeepAwake({ enabled, onUnsupported }: { enabled: boolean; onUnsupported: () => void }) {
  const [notice, setNotice] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    const onInteraction = () => {
      removeInteraction();
      requestLock().catch(() => {
        if (!live) return;
        setNotice(true);
        onUnsupported();
      });
    };
    const removeInteraction = () => {
      window.removeEventListener("pointerdown", onInteraction, true);
      window.removeEventListener("keydown", onInteraction, true);
    };
    const attempt = () =>
      requestLock().catch(() => {
        if (!live) return;
        window.addEventListener("pointerdown", onInteraction, true);
        window.addEventListener("keydown", onInteraction, true);
      });
    void attempt();
    const again = () => document.visibilityState === "visible" && void attempt();
    document.addEventListener("visibilitychange", again);
    return () => {
      live = false;
      removeInteraction();
      document.removeEventListener("visibilitychange", again);
      void held?.release();
      held = null;
    };
  }, [enabled, onUnsupported]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(false), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  if (!notice) return null;
  return <p className="shrink-0 w-full h-7 flex items-center justify-center px-4 bg-red-500 text-white text-sm font-inria truncate">Keep awake not supported on your device</p>;
}
