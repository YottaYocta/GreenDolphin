import { useEffect, useState, type ReactNode } from "react";
import { PauseIcon, PlayIcon, SkipBackIcon, SkipForwardIcon, SlidersIcon, SnowflakeIcon } from "@phosphor-icons/react";
import { capture } from "../../../analytics";
import { clamp } from "../Timeline/geometry";
import type { Player } from "../../../core";
import { useKeys } from "../../shared/keys";
import { Dialog } from "../../shared/primitives";
import { usePlayer } from "../session";

const BTN = "btn-surface rounded-xl h-full min-h-0 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed p-3 md:p-6";
const COLORED = "[box-shadow:var(--shadow-btn-colored)]";

function useCountdown(player: Player, waitingUntil: number | null) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (waitingUntil === null) return;
    let raf = 0;
    const tick = () => {
      setLeft(player.delayRemaining());
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [player, waitingUntil]);
  return left;
}

export function Controls({ player, freeze, settings }: { player: Player; freeze: boolean; settings: ReactNode }) {
  const { playState, waitingUntil } = usePlayer(player);
  const [open, setOpen] = useState(false);
  const countdown = useCountdown(player, waitingUntil);
  const togglePlay = () => {
    capture(playState === "playing" ? "playback_paused" : "playback_started");
    player.dispatch({ type: "toggle-play" });
  };
  const toggleFreeze = () => freeze && player.dispatch({ type: "toggle-freeze" });
  const nudge = (seconds: number) => player.dispatch({ type: "move", position: clamp(player.position() + seconds, 0, player.duration) });
  useKeys({
    " ": togglePlay,
    p: togglePlay,
    f: toggleFreeze,
    h: () => nudge(-5),
    l: () => nudge(5),
    ArrowLeft: () => nudge(-0.2),
    ArrowRight: () => nudge(0.2),
    "0": () => player.dispatch({ type: "move", position: 0 }),
  });

  const nav = (Icon: typeof SkipBackIcon, seconds: number, label: string) => (
    <button aria-label={label} onClick={() => nudge(seconds)} className={BTN}>
      <Icon size={freeze ? 28 : 32} weight="fill" className="opacity-65 shrink-0" />
    </button>
  );
  const playColor = playState === "waiting" ? `bg-waiting hover:bg-waiting-hover active:bg-waiting-active ${COLORED}` : playState === "playing" ? `bg-play hover:bg-play-hover active:bg-play-active ${COLORED}` : "";

  return (
    <div className="grid gap-4 w-full h-min max-md:flex-1 max-md:grid-cols-2 max-md:grid-rows-2 grid-cols-4">
      <button aria-label={playState === "playing" ? "Pause" : "Play"} data-state={playState} onClick={togglePlay} className={`${BTN} ${playColor}`}>
        <span className="size-10 flex items-center justify-center">
          {playState === "playing" ? (
            <PauseIcon size={36} weight="fill" color="var(--color-icon-white)" />
          ) : playState === "waiting" ? (
            <span className="font-space-mono text-white text-lg tabular-nums">{countdown.toFixed(1)}</span>
          ) : (
            <PlayIcon size={40} weight="fill" color="var(--color-play)" />
          )}
        </span>
      </button>
      {freeze && (
        <button aria-label="Freeze" aria-pressed={playState === "frozen"} onClick={toggleFreeze} className={`${BTN} ${playState === "frozen" ? `bg-freeze hover:bg-freeze-hover active:bg-freeze-active ${COLORED}` : ""}`}>
          <SnowflakeIcon size={40} weight="fill" color={playState === "frozen" ? "#fff" : "var(--color-freeze)"} />
        </button>
      )}
      <button aria-label="Settings" onClick={() => setOpen(true)} className={BTN}>
        <SlidersIcon size={32} weight="fill" className="opacity-55" />
      </button>
      <Dialog title="Settings" open={open} onOpenChange={setOpen}>
        <div className="flex flex-col gap-6 pb-4">{settings}</div>
      </Dialog>
      <div className={freeze ? "grid grid-cols-2 gap-4 min-h-0" : "contents"}>
        {nav(SkipBackIcon, -5, "Back 5 seconds")}
        {nav(SkipForwardIcon, 5, "Forward 5 seconds")}
      </div>
    </div>
  );
}
