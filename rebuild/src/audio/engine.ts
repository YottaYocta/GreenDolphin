import { SoundTouchNode } from "@soundtouchjs/audio-worklet";
import soundTouchUrl from "@soundtouchjs/audio-worklet/processor?url";
import freezeUrl from "./freezeProcessor.ts?worker&url";
import type { Backend, Output } from "../domain/player";
import type { FreezeMessage } from "./freezeProcessor";

const FADE = 0.03;
const ANALYSER_SIZE = 16384;
const registered = new WeakMap<BaseAudioContext, Promise<unknown>>();

/** Web Audio backend: buffer source or freeze worklet → SoundTouch (pitch/tempo) → gain → analyser. */
export class AudioEngine implements Backend {
  readonly nativeLoop = true;
  readonly analyser: AnalyserNode;
  readonly ctx: AudioContext;
  private readonly buffer: AudioBuffer;
  private readonly stretch: SoundTouchNode;
  private readonly gain: GainNode;
  private readonly freeze: AudioWorkletNode;
  private readonly freezeGain: GainNode;
  private source: AudioBufferSourceNode | null = null;
  private tone: OscillatorNode | null = null;
  private last: Output | null = null;
  private idle: ReturnType<typeof setTimeout> | undefined;

  static async create(ctx: AudioContext, buffer: AudioBuffer) {
    if (!registered.has(ctx))
      registered.set(ctx, Promise.all([SoundTouchNode.register(ctx, soundTouchUrl), ctx.audioWorklet.addModule(freezeUrl)]));
    await registered.get(ctx);
    return new AudioEngine(ctx, buffer);
  }

  private constructor(ctx: AudioContext, buffer: AudioBuffer) {
    this.ctx = ctx;
    this.buffer = buffer;
    this.stretch = new SoundTouchNode({ context: ctx });
    this.stretch.setStretchParameters({ overlapMs: 4 });
    this.gain = ctx.createGain();
    this.analyser = Object.assign(ctx.createAnalyser(), { fftSize: ANALYSER_SIZE, minDecibels: -140, maxDecibels: 0, smoothingTimeConstant: 0.1 });
    this.stretch.connect(this.gain).connect(this.analyser).connect(ctx.destination);
    this.freeze = new AudioWorkletNode(ctx, "gd-freeze", { numberOfInputs: 0, outputChannelCount: [buffer.numberOfChannels] });
    this.freezeGain = ctx.createGain();
    this.freezeGain.gain.value = 0;
    this.freeze.connect(this.freezeGain).connect(this.stretch);
    const channels = Array.from({ length: buffer.numberOfChannels }, (_, c) => {
      const copy = new Float32Array(buffer.length);
      buffer.copyFromChannel(copy, c);
      return copy;
    });
    this.post({ type: "load", channels }, channels.map((c) => c.buffer));
  }

  now = () => this.ctx.currentTime;

  get mode() {
    return this.last?.mode ?? "silent";
  }

  apply(o: Output) {
    const prev = this.last;
    this.last = o;
    if (o.mode !== "silent") void this.ctx.resume();
    const restart = !prev || prev.mode !== o.mode || prev.generation !== o.generation || (prev.stopAt !== null && o.stopAt === null);
    const frozen = o.mode === "freeze" || o.mode === "scrub";

    if (restart) {
      this.stopSource();
      if (o.mode === "play") this.startSource(o);
      if (frozen) this.post({ type: "seek", position: o.position, jump: true });
      this.fadeFreeze(frozen);
    } else if (o.mode === "play" && this.source) {
      Object.assign(this.source, { loopStart: o.loop.start, loopEnd: o.loop.end });
      this.source.playbackRate.value = o.speed;
      if (o.stopAt !== null) this.source.stop(o.stopAt);
    } else if (o.mode === "scrub") this.post({ type: "seek", position: o.position, jump: false });

    this.stretch.playbackRate.value = o.mode === "play" ? o.speed : 1;
    this.stretch.pitchSemitones.value = o.pitch;
    this.gain.gain.value = o.gain;
  }

  playTone(frequency: number | null) {
    this.tone?.stop();
    this.tone = null;
    if (frequency === null) return;
    void this.ctx.resume();
    const level = this.ctx.createGain();
    level.gain.value = 10 ** (-10 / 20);
    this.tone = Object.assign(this.ctx.createOscillator(), { type: "sine" as const });
    this.tone.frequency.value = frequency;
    this.tone.connect(level).connect(this.analyser);
    this.tone.start();
  }

  dispose() {
    this.stopSource();
    this.playTone(null);
    clearTimeout(this.idle);
    this.post({ type: "active", active: false });
    for (const node of [this.freeze, this.freezeGain, this.stretch, this.gain, this.analyser]) node.disconnect();
  }

  private startSource(o: Output) {
    const source = Object.assign(this.ctx.createBufferSource(), { buffer: this.buffer, loop: true, loopStart: o.loop.start, loopEnd: o.loop.end });
    source.playbackRate.value = o.speed;
    source.connect(this.stretch);
    source.start(0, o.position);
    if (o.stopAt !== null) source.stop(o.stopAt);
    this.source = source;
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

  private post(message: FreezeMessage, transfer: Transferable[] = []) {
    this.freeze.port.postMessage(message, transfer);
  }
}
