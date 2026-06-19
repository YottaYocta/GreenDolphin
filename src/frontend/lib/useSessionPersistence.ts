import type { PlaybackSettings } from "../playback/PlaybackContext";
import type { Section } from "./waveform";

const KEY = "gd_session";

interface SessionData {
  filename: string;
  audioSettings: Partial<PlaybackSettings>;
  waveformRange?: Section;
}

export function loadSession(): SessionData | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SessionData) : null;
  } catch {
    return null;
  }
}

export function saveSession(patch: Partial<SessionData>) {
  try {
    const prev = loadSession() ?? ({} as SessionData);
    localStorage.setItem(KEY, JSON.stringify({ ...prev, ...patch }));
  } catch {}
}

export function clearSession() {
  localStorage.removeItem(KEY);
}
