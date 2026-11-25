import { useEffect } from "react";

export function useKeepAwake(enabled: boolean) {
  useEffect(() => {
    if (!enabled || !("wakeLock" in navigator)) return;
    let live = true;
    let pending = false;
    let held: WakeLockSentinel | null = null;
    const request = () => {
      if (pending || (held && !held.released)) return;
      pending = true;
      navigator.wakeLock
        .request("screen")
        .then((lock) => (live ? (held = lock) : void lock.release()))
        .catch(() => {})
        .finally(() => (pending = false));
    };
    request();
    window.addEventListener("pointerdown", request, true);
    window.addEventListener("keydown", request, true);
    return () => {
      live = false;
      window.removeEventListener("pointerdown", request, true);
      window.removeEventListener("keydown", request, true);
      void held?.release();
    };
  }, [enabled]);
}
