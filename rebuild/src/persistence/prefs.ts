import type { Settings } from "../core/player";
import type { LoopMode, Section } from "../core/transport";

export interface RecordingPrefs extends Settings {
  loop: Section | null;
  view: Section | null;
  position: number;
}

export interface LoopPrefs {
  mode: "manual" | "automatic";
  delayMode: "fixed" | "relative";
  /** Seconds when fixed, percent of the loop length when relative. */
  delayValue: number;
}

export const DEFAULT_SETTINGS: Settings = { speed: 1, pitch: 0, gain: 1 };
const DEFAULT_LOOP: LoopPrefs = { mode: "automatic", delayMode: "fixed", delayValue: 0 };

const read = <T>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(`gd2:${key}`);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
};
const write = (key: string, value: unknown) => {
  try {
    localStorage.setItem(`gd2:${key}`, JSON.stringify(value));
  } catch (e) {
    console.error(e);
  }
};

type RecordingMap = Record<string, Partial<RecordingPrefs>>;

export const recordingPrefs = (name: string): RecordingPrefs => ({
  ...DEFAULT_SETTINGS,
  loop: null,
  view: null,
  position: 0,
  ...read<RecordingMap>("recordings", {})[name],
});

export const saveRecordingPrefs = (name: string, patch: Partial<RecordingPrefs>) => {
  const all = read<RecordingMap>("recordings", {});
  write("recordings", { ...all, [name]: { ...all[name], ...patch } });
};

export const removeRecordingPrefs = (name: string) => {
  const all = read<RecordingMap>("recordings", {});
  delete all[name];
  write("recordings", all);
};

export const loopPrefs = () => read("loop", DEFAULT_LOOP);
export const saveLoopPrefs = (patch: Partial<LoopPrefs>) => write("loop", { ...loopPrefs(), ...patch });

export const toLoopMode = (p: LoopPrefs, loopLength: number): LoopMode =>
  p.mode === "manual"
    ? { type: "manual" }
    : { type: "automatic", delay: p.delayMode === "fixed" ? p.delayValue : (p.delayValue / 100) * loopLength };

export const flag = (key: string) => read(`flag:${key}`, { on: false }).on;
export const setFlag = (key: string, on: boolean) => write(`flag:${key}`, { on });

export const lastOpened = () => read<{ name: string | null }>("last", { name: null }).name;
export const setLastOpened = (name: string | null) => write("last", { name });
