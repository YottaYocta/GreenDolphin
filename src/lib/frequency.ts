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
