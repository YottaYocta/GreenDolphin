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

/**
 * returns the number of semitones needed to pitch-shift an audio stream with playback speed equal to playbackShift
 * @requires playbackShift > 0
 */
export const getInverseShift = (playbackShift: number): number => {
  return Math.log(1 / playbackShift) / Math.log(Math.pow(2, 1 / 12));
};

export const computeMS = (sampleRate: number, sampleIndex: number) => {
  return (sampleIndex / sampleRate) * 1000;
};

export const computeSampleIndex = (sampleRate: number, ms: number) => {
  return Math.floor((ms / 1000) * sampleRate);
};
