import { SoundTouchNode } from "@soundtouchjs/audio-worklet";
import soundTouchUrl from "@soundtouchjs/audio-worklet/processor?url";
import freezeUrl from "./freezeProcessor.ts?worker&url";
import { core, type Playback, type RecordingSeconds } from "../core";
import type { Audio, AudioEngine, FreezeMessage, LinearGain, Semitones, Spectrum } from "./interfaces";
import { audioContext, bufferOf, outputDelay } from "./recording";
import { tonePlayer } from "./tones";

const FADE = 0.03;
const STRETCH_LATENCY = 0.125;
const ANALYSER_SIZE = 16384;
const FREEZE_WINDOW_SECONDS = 2;
const FREEZE_REACH_SECONDS = 0.25;
let registered: Promise<unknown> | null = null;

export const createEngine: Audio["createEngine"] = async (recording) => {
  const ctx = audioContext();
  await (registered ??= Promise.all([SoundTouchNode.register(ctx, soundTouchUrl), ctx.audioWorklet.addModule(freezeUrl)]));
  return new WebAudioEngine(ctx, bufferOf(recording));
};

class WebAudioEngine implements AudioEngine {
  private readonly limiter: DynamicsCompressorNode;
  private readonly ctx: AudioContext;
  private readonly buffer: AudioBuffer;
  private readonly stretch: SoundTouchNode;
  private readonly gain: GainNode;
  private readonly freeze: AudioWorkletNode;
  private readonly freezeGain: GainNode;
  readonly playTone: AudioEngine["playTone"];
  private source: AudioBufferSourceNode | null = null;
  private last: Playback | null = null;
  private idle: ReturnType<typeof setTimeout> | undefined;
  private freezeCentre = Infinity;

  constructor(ctx: AudioContext, buffer: AudioBuffer) {
    this.ctx = ctx;
    this.buffer = buffer;
    this.stretch = new SoundTouchNode({ context: ctx });
    this.stretch.setStretchParameters({ overlapMs: 4 });
    this.gain = ctx.createGain();
    this.limiter = new DynamicsCompressorNode(ctx, { threshold: -1, knee: 0, ratio: 20, attack: 0.001, release: 0.1 });
    this.stretch.connect(this.gain).connect(this.limiter).connect(ctx.destination);
    this.playTone = tonePlayer(ctx, this.limiter);
    this.freeze = new AudioWorkletNode(ctx, "gd-freeze", { numberOfInputs: 0, outputChannelCount: [buffer.numberOfChannels] });
    this.freezeGain = ctx.createGain();
    this.freezeGain.gain.value = 0;
    this.freeze.connect(this.freezeGain).connect(this.stretch);
    this.freeze.port.start();
  }

  now = () => this.ctx.currentTime;

  latency = () => STRETCH_LATENCY + outputDelay(this.ctx);

  render(p: Playback) {
    const prev = this.last;
    this.last = p;
    if (p.mode !== "silent") void this.ctx.resume();
    const modeChanged = !prev || prev.mode !== p.mode;
    const jumped = !modeChanged && !core.continues(prev!, p);
    const stopCancelled = !!prev && !prev.loopWraps && p.loopWraps;
    const freezing = p.mode === "frozen" || p.mode === "scrubbing";

    if (modeChanged || (jumped && p.mode !== "scrubbing") || (stopCancelled && p.mode === "playing")) {
      const position = core.positionAt(p, this.ctx.currentTime);
      this.stopSource();
      if (p.mode === "playing") this.startSource(p, position);
      if (freezing) this.seekFreeze(position, true);
      this.fadeFreeze(freezing);
    } else if (p.mode === "playing" && this.source) {
      Object.assign(this.source, { loopStart: p.loop.start, loopEnd: p.loop.end });
      this.source.playbackRate.value = p.rate;
      this.scheduleStop(this.source, p);
    } else if (p.mode === "scrubbing") this.seekFreeze(p.anchorPosition, false);

    this.stretch.playbackRate.value = p.mode === "playing" ? p.rate : 1;
  }

  openSpectrum(): Spectrum {
    const analyser = Object.assign(this.ctx.createAnalyser(), { fftSize: ANALYSER_SIZE, minDecibels: -140, maxDecibels: 0, smoothingTimeConstant: 0.1 });
    const data = new Float32Array(analyser.frequencyBinCount);
    this.limiter.connect(analyser);
    return {
      binHz: this.ctx.sampleRate / ANALYSER_SIZE,
      read: () => {
        analyser.getFloatFrequencyData(data);
        return data;
      },
      close: () => this.limiter.disconnect(analyser),
    };
  }

  setPitch(semitones: Semitones) {
    this.stretch.pitchSemitones.value = semitones;
  }

  setVolume(gain: LinearGain) {
    this.gain.gain.value = gain;
  }

  dispose() {
    this.stopSource();
    this.playTone(null);
    clearTimeout(this.idle);
    this.post({ type: "unload" });
    for (const node of [this.freeze, this.freezeGain, this.stretch, this.gain]) node.disconnect();
    this.limiter.disconnect(this.ctx.destination);
  }

  private startSource(p: Playback, position: RecordingSeconds) {
    const source = Object.assign(this.ctx.createBufferSource(), { buffer: this.buffer, loop: true, loopStart: p.loop.start, loopEnd: p.loop.end });
    source.playbackRate.value = p.rate;
    source.connect(this.stretch);
    source.start(0, position);
    this.scheduleStop(source, p);
    this.source = source;
  }

  private scheduleStop(source: AudioBufferSourceNode, p: Playback) {
    if (!p.loopWraps && p.anchorPosition < p.loop.end) source.stop(p.anchorTime + (p.loop.end - p.anchorPosition) / p.rate);
  }

  private stopSource() {
    this.source?.stop();
    this.source?.disconnect();
    this.source = null;
  }

  private fadeFreeze(on: boolean) {
    const now = this.ctx.currentTime;
    const g = this.freezeGain.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(on ? 1 : 0, now + FADE);
    clearTimeout(this.idle);
    if (on) this.post({ type: "active", active: true });
    else this.idle = setTimeout(() => this.post({ type: "active", active: false }), FADE * 2000);
  }

  private seekFreeze(position: RecordingSeconds, jump: boolean) {
    const { sampleRate, length, numberOfChannels } = this.buffer;
    const at = Math.round(position * sampleRate);
    if (Math.abs(at - this.freezeCentre) <= (FREEZE_WINDOW_SECONDS / 2 - FREEZE_REACH_SECONDS) * sampleRate) return this.post({ type: "seek", position, jump });
    this.freezeCentre = at;
    const firstSample = Math.max(0, at - (FREEZE_WINDOW_SECONDS * sampleRate) / 2);
    const channels = Array.from({ length: numberOfChannels }, (_, c) => {
      const copy = new Float32Array(Math.min(length - firstSample, FREEZE_WINDOW_SECONDS * sampleRate));
      this.buffer.copyFromChannel(copy, c, firstSample);
      return copy;
    });
    this.post({ type: "seek", position, jump, window: { channels, firstSample } }, channels.map((c) => c.buffer));
  }

  private post(message: FreezeMessage, transfer: Transferable[] = []) {
    this.freeze.port.postMessage(message, transfer);
  }
}
