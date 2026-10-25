const FADE = 0.02;

/** One-voice player: starting anything stops what was playing. */
export const createPlayer = (ctx: AudioContext) => {
  let active: { node: AudioScheduledSourceNode; gain: GainNode }[] = [];

  const stop = () => {
    for (const { node } of active) {
      try {
        node.stop();
      } catch {
        // already stopped
      }
    }
    active = [];
  };

  const voice = (buffer: AudioBuffer, at: number, gainFrom: number, loop: boolean) => {
    const node = ctx.createBufferSource();
    node.buffer = buffer;
    node.loop = loop;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainFrom, at);
    node.connect(gain).connect(ctx.destination);
    const v = { node, gain };
    active.push(v);
    return v;
  };

  return {
    stop,
    /** Play `buffer` from `offset` seconds, for `duration` seconds or forever when looping. */
    play: (buffer: AudioBuffer, { offset = 0, duration, loop = false }: { offset?: number; duration?: number; loop?: boolean } = {}) => {
      stop();
      void ctx.resume();
      const { node } = voice(buffer, ctx.currentTime, 1, loop);
      node.start(ctx.currentTime, offset, loop ? undefined : duration);
    },
    /** Fade whatever is playing out and a new looping buffer in. */
    crossfade: (buffer: AudioBuffer, seconds = 0.08) => {
      void ctx.resume();
      const now = ctx.currentTime;
      for (const { node, gain } of active) {
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(gain.gain.value, now);
        gain.gain.linearRampToValueAtTime(0, now + seconds);
        node.stop(now + seconds);
      }
      active = [];
      const next = voice(buffer, now, 0, true);
      next.gain.gain.linearRampToValueAtTime(1, now + seconds);
      next.node.start(now);
    },
    /** Play the source up to `atSeconds`, then crossfade into the looping freeze, like pressing freeze mid-playback. */
    leadIn: (source: AudioBuffer, atSeconds: number, leadSeconds: number, freeze: AudioBuffer) => {
      stop();
      void ctx.resume();
      const t0 = ctx.currentTime + 0.05;
      const from = Math.max(0, atSeconds - leadSeconds);
      const switchAt = t0 + (atSeconds - from);
      const lead = voice(source, t0, 1, false);
      lead.gain.gain.setValueAtTime(1, switchAt - FADE);
      lead.gain.gain.linearRampToValueAtTime(0, switchAt + FADE);
      lead.node.start(t0, from, atSeconds - from + FADE * 2);
      const frozen = voice(freeze, t0, 0, true);
      frozen.gain.gain.setValueAtTime(0, switchAt - FADE);
      frozen.gain.gain.linearRampToValueAtTime(1, switchAt + FADE);
      frozen.node.start(switchAt - FADE);
    },
  };
};

export type Player = ReturnType<typeof createPlayer>;
