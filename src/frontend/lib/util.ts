import { type Section } from "./waveform";

export const NOTE_COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#ef4444",
  "#14b8a6",
];

export function hashFilename(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (Math.imul(h, 31) + name.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function noteColor(filename: string): string {
  return NOTE_COLORS[hashFilename(filename) % NOTE_COLORS.length];
}

export function relativeDate(ts: number): string {
  const now = Date.now();
  const diffMs = now - ts;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Added today";
  if (diffDays === 1) return "Added yesterday";
  if (diffDays < 7) return `Added ${diffDays} days ago`;
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks === 1) return "Added 1 week ago";
  if (diffWeeks < 5) return `Added ${diffWeeks} weeks ago`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths === 1) return "Added 1 month ago";
  return `Added ${diffMonths} months ago`;
}

export function formatSize(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export const formatSeconds = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const secondsRemainder = Math.floor(seconds % 60);
  return `${minutes}:${
    secondsRemainder < 10 ? `0${secondsRemainder}` : secondsRemainder
  }`;
};

export const clampSection = (
  targetSection: Section,
  clampToSection: Section
): Section => {
  const targetSectionLength = targetSection.end - targetSection.start;

  if (targetSectionLength > clampToSection.end - clampToSection.start) {
    return clampToSection;
  }

  if (targetSection.end > clampToSection.end) {
    return {
      start: clampToSection.end - targetSectionLength,
      end: clampToSection.end,
    };
  }

  if (targetSection.start < clampToSection.start) {
    return {
      start: clampToSection.start,
      end: clampToSection.start + targetSectionLength,
    };
  }

  return targetSection;
};

export const computeMS = (sampleRate: number, sampleIndex: number) => {
  return (sampleIndex / sampleRate) * 1000;
};

export const MStoSampleIndex = (sampleRate: number, ms: number) => {
  return Math.floor((ms / 1000) * sampleRate);
};
