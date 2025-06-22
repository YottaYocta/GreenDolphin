export type FrequencyData = Float32Array<ArrayBuffer>;

export interface FrequencyBucket {
  start: number;
  end: number;
}

export const createFrequencyData = (
  length: number,
  defaultValue = 0
): FrequencyData => {
  const data = new Float32Array(length);
  for (let i = 0; i < data.length; i++) {
    data[i] = defaultValue;
  }
  return data;
};

export const setAmplitude = (
  data: FrequencyData,
  index: number,
  value: number
): FrequencyData => {
  data[index] = value;
  return data;
};

export const addAmplitude = (
  data: FrequencyData,
  index: number,
  value: number
): FrequencyData => {
  data[index] += value;
  return data;
};

export const getAmplitude = (data: FrequencyData, index: number): number => {
  return data[index];
};

export const fromArray = (frequencies: number[]): FrequencyData => {
  const data = createFrequencyData(frequencies.length);
  for (let i = 0; i < data.length; i++) data[i] = frequencies[i];
  return data;
};

export const groupFrequencies = (
  data: FrequencyData,
  range: number,
  groupings: FrequencyBucket[]
): FrequencyData => {
  let fIndex = 0;
  let gIndex = 0;

  const fBucketSize = range / data.length;
  const result = createFrequencyData(groupings.length, 0);

  while (fIndex < data.length && gIndex < groupings.length) {
    const fStart = fIndex * fBucketSize;
    const fEnd = fStart + fBucketSize;
    const overlap =
      Math.min(fEnd, groupings[gIndex].end) -
      Math.max(fStart, groupings[gIndex].start);

    // console.log(overlap / (44100 / 2));
    // console.log(overlap);
    if (overlap > 0) {
      addAmplitude(result, gIndex, data[fIndex] * overlap);
    }
    if (groupings[gIndex].end <= fEnd) gIndex++;
    else fIndex++;
  }
  for (let i = 0; i < result.length; i++) {
    result[i] = result[i] / (groupings[i].end - groupings[i].start);
  }
  return result;
};

const QUARTER_STEP_RATIO = Math.pow(2, 1 / 24);

const computeFrequency = (pitchIndex: number) => {
  return 440 * Math.pow(2, (1 / 12) * (pitchIndex - 57));
};

const computeNoteName = (pitchIndex: number) => {
  const notes = [
    "c",
    "db",
    "d",
    "eb",
    "e",
    "f",
    "gb",
    "g",
    "ab",
    "a",
    "bb",
    "b",
  ];

  const octave = Math.floor(pitchIndex / 12);
  const noteIndex = pitchIndex % 12;
  return `${notes[noteIndex]}${octave}`;
};

const generatePitchBuckets = () => {
  const buckets: FrequencyBucket[] = [];
  // C0 to C8 covers 9 octaves, 12 notes per octave = 108 notes
  // idx 0 is C0, idx 107 is B8
  for (let i = 0; i < 108; i++) {
    const freq = computeFrequency(i);
    const start = freq / QUARTER_STEP_RATIO;
    const end = freq * QUARTER_STEP_RATIO;
    buckets.push({ start, end });
  }
  return buckets;
};

export const PITCH_BUCKETS = generatePitchBuckets();

export const drawFrequencyNoteBars = (
  pitches: FrequencyData,
  canvas: HTMLCanvasElement
) => {
  const pitchBarWidth = canvas.width / (PITCH_BUCKETS.length - 3);
  const fillStyle = `rgb(25 202 147)`;
  const pitchCtx = canvas.getContext("2d");
  if (!pitchCtx) return;

  pitchCtx.clearRect(0, 0, canvas.width, canvas.height);

  pitches.forEach((rawIntensity, idx) => {
    const intensity = Math.min(140, rawIntensity + 140);
    if (intensity > 10) {
      const base = (intensity * Math.pow(idx, 1 / 5)) / 2;
      const barHeight = Math.sqrt(Math.pow(base * base * base, base / 130)) / 2;

      pitchCtx.fillStyle = fillStyle;
      pitchCtx.fillRect(
        idx * pitchBarWidth,
        canvas.height - barHeight / 2,
        pitchBarWidth,
        barHeight / 2
      );

      pitchCtx.fillStyle = `${fillStyle.slice(0, -1)} / ${Math.pow(
        Math.max(0, barHeight - 10),
        2
      )}%)`;
      pitchCtx.font = "16px Arial";
      pitchCtx.fillText(
        `${computeNoteName(idx)}`,
        idx * pitchBarWidth - pitchBarWidth,
        canvas.height - barHeight / 2 - 2
      );
    }
  });
};
