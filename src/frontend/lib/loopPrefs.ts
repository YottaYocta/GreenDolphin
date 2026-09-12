import type { LoopOptions } from "../playback/PlaybackContext";

const KEY = "gd_loop_prefs";

export interface LoopPrefs {
  loopOptions?: LoopOptions;
  delayMode?: "fixed" | "relative";
  delayValue?: number;
}

export function loadLoopPrefs(): LoopPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as LoopPrefs) : {};
  } catch {
    return {};
  }
}

export function saveLoopPrefs(patch: Partial<LoopPrefs>) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...loadLoopPrefs(), ...patch }));
  } catch (e) {
    console.error(e);
  }
}
