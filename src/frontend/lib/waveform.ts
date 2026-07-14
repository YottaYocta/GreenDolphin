import { formatSeconds } from "./util";

export interface Section {
  start: number;
  end: number;
}

export interface Color {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface WaveformStyle {
  resolution: number;
  primary?: Color;
  secondary?: Color;
  background?: Color;
}

export interface WaveformData {
  data: AudioBuffer;
  viewport: Section;
  selection?: Section;
}

const computeFillStyle = (color: Color): string =>
  `rgb(${color.r} ${color.g} ${color.b} / ${color.a}%)`;

const computePixel = (
  sampleIdx: number,
  rangeLength: number,
  canvas: HTMLCanvasElement,
) => {
  return canvas.width * (sampleIdx / rangeLength);
};

export const computeSampleIndex = (
  pixel: number,
  rangeLength: number,
  canvas: HTMLCanvasElement,
) => {
  return Math.floor((pixel / canvas.width) * rangeLength);
};

export const renderWaveform = (
  { data, selection, viewport }: WaveformData,
  {
    resolution,
    primary = { r: 25, g: 202, b: 147, a: 100 },
    secondary = { r: 25, g: 202, b: 147, a: 30 },
    background = { r: 256, g: 256, b: 256, a: 100 },
  }: WaveformStyle,
  canvas: HTMLCanvasElement,
  position?: number,
) => {
  const channelHeight = canvas.height / data.numberOfChannels;
  const canvasCtx = canvas.getContext("2d")!;
  canvasCtx.imageSmoothingEnabled = false;
  canvasCtx.fillStyle = computeFillStyle(background);

  canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

  const rangeLength = viewport.end - viewport.start;
  const MIN_WAVE_WIDTH = 1;

  const waveWidth = Math.max(MIN_WAVE_WIDTH, canvas.width / resolution);
  const trueResolution = canvas.width / waveWidth;
  const samplesPerWave = Math.max(0, rangeLength / trueResolution);

  const primaryFill = computeFillStyle(primary);
  const secondaryFill = computeFillStyle(secondary);

  for (let i = 0; i < data.numberOfChannels; i++) {
    const channelData = data.getChannelData(i);

    const subsamplingRate = Math.max(1, samplesPerWave / 10);
    for (
      let j = viewport.start;
      j < channelData.length && j < viewport.end;
      j += samplesPerWave
    ) {
      let sampleSum = 0;
      let sampleCount = 0;
      for (
        let k = j;
        k < channelData.length && k < j + samplesPerWave;
        k += subsamplingRate
      ) {
        sampleSum += Math.abs(channelData[Math.floor(k)]);
        sampleCount++;
      }
      const sampleIntensity = sampleSum / sampleCount;
      const waveHeight = Math.round(Math.abs(sampleIntensity) * channelHeight);
      canvasCtx.fillStyle = selection
        ? j >= selection.start && j <= selection.end
          ? primaryFill
          : secondaryFill
        : primaryFill;
      canvasCtx.fillRect(
        ((j - viewport.start) / samplesPerWave) * waveWidth,
        channelHeight * i + channelHeight / 2 - waveHeight / 2,
        waveWidth,
        waveHeight,
      );
    }
  }

  if (selection) {
    const startPos = computePixel(
      selection.start - viewport.start,
      rangeLength,
      canvas,
    );

    const endPos = computePixel(selection.end - viewport.start, rangeLength, canvas);

    canvasCtx.fillStyle = primaryFill;
    canvasCtx.fillRect(startPos, 0, 1, canvas.height);
    canvasCtx.fillStyle = "rgb(0 0 0)";
    canvasCtx.fillText(
      `${formatSeconds(
        Math.trunc((selection.start / data.sampleRate) * 100) / 100,
      )}`,
      startPos + 5,
      10,
    );

    canvasCtx.fillStyle = primaryFill;
    canvasCtx.fillRect(endPos, 0, 1, canvas.height);

    if (endPos - startPos > 70) {
      const endString = `${formatSeconds(
        Math.trunc((selection.end / data.sampleRate) * 100) / 100,
      )}`;
      canvasCtx.fillStyle = "rgb(0 0 0)";
      canvasCtx.fillText(
        endString,
        endPos - 5 - canvasCtx.measureText(endString).width,
        10,
      );
    }
  }

  if (position !== undefined) {
    const pos = computePixel(position - viewport.start, rangeLength, canvas);
    if (pos > 0 && pos < canvas.width) {
      canvasCtx.fillStyle = "rgb(10 150 100)";
      canvasCtx.fillRect(pos, 0, 2, canvas.height);
    }
  }
};
