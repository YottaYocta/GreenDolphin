import type { LoopPrefs, Persistence, RecordingId, RecordingPrefs } from "./interfaces";

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

export const recordingPrefs: Persistence["recordingPrefs"] = (id) => ({
  speed: 1,
  pitch: 0,
  gain: 1,
  loop: null,
  view: null,
  position: 0,
  ...read<RecordingMap>("recordings", {})[id],
});

export const saveRecordingPrefs: Persistence["saveRecordingPrefs"] = (id, patch) => {
  const all = read<RecordingMap>("recordings", {});
  write("recordings", { ...all, [id]: { ...all[id], ...patch } });
};

export const removeRecordingPrefs = (id: RecordingId) => {
  const all = read<RecordingMap>("recordings", {});
  delete all[id];
  write("recordings", all);
};

export const loopPrefs: Persistence["loopPrefs"] = () => read("loop", DEFAULT_LOOP);
export const saveLoopPrefs: Persistence["saveLoopPrefs"] = (patch) => write("loop", { ...loopPrefs(), ...patch });

export const toLoopMode: Persistence["toLoopMode"] = (p, loopLength) =>
  p.mode === "manual"
    ? { type: "manual" }
    : { type: "automatic", delay: p.delayMode === "fixed" ? p.delayValue : (p.delayValue / 100) * loopLength };

export const flag: Persistence["flag"] = (key) => read(`flag:${key}`, { on: false }).on;
export const setFlag: Persistence["setFlag"] = (key, on) => write(`flag:${key}`, { on });

export const lastOpened: Persistence["lastOpened"] = () => read<{ id: string | null }>("last", { id: null }).id;
export const setLastOpened: Persistence["setLastOpened"] = (id) => write("last", { id });
