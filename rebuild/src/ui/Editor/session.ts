import { useEffect, useMemo, useSyncExternalStore } from "react";
import { FULL, clamp, fit, length, toFraction, toSection } from "./Timeline/geometry";
import type { Player, PlayerInit } from "../../core/player";
import type { Section } from "../../core/transport";
import { loopPrefs, recordingPrefs, saveRecordingPrefs, toLoopMode } from "../../persistence/prefs";

export const usePlayer = (player: Player) => useSyncExternalStore(player.subscribe, player.getState);

/** Everything a recording reopens with: player settings, view, and the loop under it. */
export function restore(name: string, duration: number) {
  const p = recordingPrefs(name);
  const full = { start: 0, end: duration };
  const view = p.view ? fit(p.view, full) : full;
  const loopFraction = p.loop ? toFraction(view, p.loop) : FULL;
  const loop = toSection(view, loopFraction);
  const init: PlayerInit = {
    position: clamp(p.position, 0, duration),
    loop,
    loopMode: toLoopMode(loopPrefs(), length(loop)),
    speed: p.speed,
    pitch: p.pitch,
    gain: p.gain,
  };
  return { view, loopFraction, init };
}

const POSITION_SAVE_MS = 1000;
const VIEW_SAVE_MS = 250;

/** Saves a recording's settings and position as they change; returns timeline persistence callbacks. */
export function usePersistence(name: string, player: Player) {
  const state = usePlayer(player);
  const { speed, pitch, gain, loop, playState } = state;

  useEffect(() => saveRecordingPrefs(name, { speed, pitch, gain }), [name, speed, pitch, gain]);
  useEffect(() => player.setLoopMode(toLoopMode(loopPrefs(), length(loop))), [player, loop]);
  useEffect(() => {
    const save = () => saveRecordingPrefs(name, { position: player.position() });
    save();
    const id = playState === "playing" ? setInterval(save, POSITION_SAVE_MS) : undefined;
    window.addEventListener("pagehide", save);
    document.addEventListener("visibilitychange", save);
    return () => {
      save();
      clearInterval(id);
      window.removeEventListener("pagehide", save);
      document.removeEventListener("visibilitychange", save);
    };
  }, [name, player, playState]);

  return useMemo(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    return {
      onView: (view: Section) => {
        clearTimeout(timer);
        timer = setTimeout(() => saveRecordingPrefs(name, { view }), VIEW_SAVE_MS);
      },
      onLoopCommit: (loop: Section) => saveRecordingPrefs(name, { loop }),
    };
  }, [name]);
}
