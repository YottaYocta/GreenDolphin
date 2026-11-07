import { useEffect, useState } from "react";
import { ArrowClockwiseIcon } from "@phosphor-icons/react";

const THRESHOLD_PX = 80;
const DROP_PX = 48;
const BLURS_PX = [1, 2, 4, 8, 16];
const IGNORED = ".touch-none, input, textarea, select, [role=dialog]";

const scrolled = (target: EventTarget | null) => {
  for (let el = target instanceof Element ? target : null; el; el = el.parentElement) if (el.scrollTop > 0) return true;
  return false;
};

export function PullToRefresh() {
  const [pull, setPull] = useState(0);

  useEffect(() => {
    let start: { id: number; y: number } | null = null;
    let distance = 0;
    const begin = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (e.touches.length !== 1 || (e.target instanceof Element && e.target.closest(IGNORED)) || scrolled(e.target)) return;
      start = { id: touch.identifier, y: touch.clientY };
    };
    const follow = (e: TouchEvent) => {
      const touch = [...e.touches].find((t) => t.identifier === start?.id);
      if (!start || !touch || e.touches.length !== 1) return finish(false);
      distance = Math.max(0, touch.clientY - start.y);
      setPull(distance);
    };
    const finish = (accepted: boolean) => {
      if (start && accepted && distance >= THRESHOLD_PX) window.location.reload();
      start = null;
      distance = 0;
      setPull(0);
    };
    const release = () => finish(true);
    const cancel = () => finish(false);
    window.addEventListener("touchstart", begin, { passive: true });
    window.addEventListener("touchmove", follow, { passive: true });
    window.addEventListener("touchend", release);
    window.addEventListener("touchcancel", cancel);
    return () => {
      window.removeEventListener("touchstart", begin);
      window.removeEventListener("touchmove", follow);
      window.removeEventListener("touchend", release);
      window.removeEventListener("touchcancel", cancel);
    };
  }, []);

  if (pull === 0) return null;
  const progress = Math.min(1, pull / THRESHOLD_PX);
  return (
    <div aria-hidden className="fixed inset-x-0 top-0 z-50 flex justify-center items-end pointer-events-none" style={{ height: progress * DROP_PX + 44 }}>
      <div className="absolute inset-0 bg-linear-to-b from-white/40 to-transparent" style={{ opacity: progress }} />
      {BLURS_PX.map((blur, i) => {
        const mask = `linear-gradient(to bottom, black ${((BLURS_PX.length - i - 1) / BLURS_PX.length) * 100}%, transparent ${((BLURS_PX.length - i) / BLURS_PX.length) * 100}%)`;
        return <div key={blur} className="absolute inset-0" style={{ backdropFilter: `blur(${blur * progress}px)`, maskImage: mask }} />;
      })}
      <div className="relative flex items-center justify-center size-9 mb-1 rounded-full bg-white border border-border shadow-sm text-black/40" style={{ opacity: progress }}>
        <ArrowClockwiseIcon size={18} weight="bold" style={{ transform: `rotate(${progress * 270}deg)` }} />
      </div>
    </div>
  );
}
