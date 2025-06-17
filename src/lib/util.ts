import { type Section } from "./waveform";

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
