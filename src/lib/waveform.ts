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
  range: Section;
  section?: Section;
}

const computeFillStyle = (color: Color): string =>
  `rgb(${color.r} ${color.g} ${color.b} / ${color.a}%)`;

export const computePixel = (
  sampleIdx: number,
  rangeLength: number,
  canvas: HTMLCanvasElement
) => {
  return canvas.width * (sampleIdx / rangeLength);
};

export const computeSampleIndex = (
  pixel: number,
  rangeLength: number,
  canvas: HTMLCanvasElement
) => {
  return Math.floor((pixel / canvas.width) * rangeLength);
};

export const renderWaveform = (
  { data, section, range }: WaveformData,
  {
    resolution,
    primary = { r: 25, g: 202, b: 147, a: 100 },
    secondary = { r: 50, g: 170, b: 120, a: 50 },
    background = { r: 256, g: 256, b: 256, a: 100 },
  }: WaveformStyle,
  canvas: HTMLCanvasElement,
  position?: number
) => {
  const channelHeight = canvas.height / data.numberOfChannels;
  const canvasCtx = canvas.getContext("2d")!;
  canvasCtx.imageSmoothingEnabled = false;
  canvasCtx.fillStyle = computeFillStyle(background);

  canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

  const rangeLength = range.end - range.start;
  const MIN_WAVE_WIDTH = 1;

  const waveWidth = Math.max(MIN_WAVE_WIDTH, canvas.width / resolution);
  const trueResolution = canvas.width / waveWidth;
  const samplesPerWave = Math.max(0, rangeLength / trueResolution);

  const primaryFill = computeFillStyle(primary);
  const secondaryFill = computeFillStyle(secondary);

  for (let i = 0; i < data.numberOfChannels; i++) {
    const channelData = data.getChannelData(i);

    const subsamplingRate = Math.max(0, samplesPerWave / 10);
    for (
      let j = range.start;
      j < channelData.length && j < range.end;
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
      canvasCtx.fillStyle = section
        ? j >= section.start && j <= section.end
          ? primaryFill
          : secondaryFill
        : primaryFill;
      canvasCtx.fillRect(
        ((j - range.start) / samplesPerWave) * waveWidth,
        channelHeight * i + channelHeight / 2 - waveHeight / 2,
        waveWidth,
        waveHeight
      );
    }
  }

  if (section) {
    const startPos = computePixel(
      section.start - range.start,
      rangeLength,
      canvas
    );

    const endPos = computePixel(section.end - range.start, rangeLength, canvas);

    canvasCtx.fillStyle = "rgb(0 0 0)";
    canvasCtx.fillRect(startPos, 0, 1, canvas.height);
    canvasCtx.fillText(`sample ${section.start}`, startPos + 5, 10);
    canvasCtx.fillText(
      `${Math.trunc((section.start / data.sampleRate) * 100) / 100}s`,
      startPos + 5,
      20
    );

    canvasCtx.fillRect(endPos, 0, 1, canvas.height);
    canvasCtx.fillText(`sample ${section.end}`, endPos + 5, 10);
    canvasCtx.fillText(
      `${Math.trunc((section.end / data.sampleRate) * 100) / 100}s`,
      endPos + 5,
      20
    );
  }

  if (position) {
    const pos = computePixel(position - range.start, rangeLength, canvas);
    if (pos > 0 && pos < canvas.width) {
      canvasCtx.fillStyle = "rgb(10 136 97)";
      canvasCtx.fillRect(pos, 0, 2, canvas.height);
    }
  }
};
