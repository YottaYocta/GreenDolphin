import { createRef, useCallback, useEffect, useMemo, useRef, type FC, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { FULL, at, clamp, isFull, length, pan, rescale, resizeLoop, shiftLoop, toSection, zoom, type LoopFraction } from "../domain/geometry";
import { formatTick, tickStep } from "../domain/format";
import type { Player } from "../domain/player";
import type { Section } from "../domain/transport";
import { drag } from "./drag";
import { useKeys } from "./keys";

export interface TimelineProps {
  player: Player;
  initialView: Section;
  initialLoop: LoopFraction;
  onView: (view: Section) => void;
  onLoopCommit: (loop: Section) => void;
  /** Draws the content lane; without it the lane shows grid lines. */
  draw?: (canvas: HTMLCanvasElement, view: Section, loop: Section) => void;
}

const TAP_PX = 6;
const WHEEL_SETTLE_MS = 250;
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_PX = 24;
const KEY_STEP = 0.1;
const ROW = "relative h-7 shrink-0 bg-surface rounded-lg overflow-hidden px-4";

const Triangle: FC<{ points: string; fill: string }> = ({ points, fill }) => (
  <svg width="16" height="22" viewBox="0 0 16 22" className="block">
    <polygon points={points} fill={fill} />
  </svg>
);

function createModel(props: TimelineProps, content: RefObject<HTMLDivElement | null>) {
  const { player, initialView, initialLoop, onView, onLoopCommit } = props;
  const m = { view: initialView, loop: initialLoop, version: 0 };
  const width = () => content.current?.clientWidth || 1;
  const fraction = (clientX: number) => (clientX - (content.current?.getBoundingClientRect().left ?? 0)) / width();
  return {
    m,
    width,
    fraction,
    time: (clientX: number) => at(m.view, clamp(fraction(clientX), 0, 1 - 1e-6)),
    setView(view: Section) {
      m.loop = rescale(m.view, view, m.loop);
      m.view = view;
      m.version++;
      onView(view);
    },
    setLoop(loop: LoopFraction) {
      m.loop = loop;
      m.version++;
    },
    lift: () => player.setLoop(null),
    commit() {
      const loop = toSection(m.view, m.loop);
      player.setLoop(loop);
      onLoopCommit(loop);
    },
  };
}

type Model = ReturnType<typeof createModel>;
const ELEMENTS = ["ticks", "grid", "grip", "line", "shade", "marks", "startHandle", "endHandle", "startLine", "endLine"] as const;
type Els = Record<(typeof ELEMENTS)[number], RefObject<HTMLDivElement | null>>;

export function Timeline(props: TimelineProps) {
  const { player, draw } = props;
  const root = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const els = useMemo(() => Object.fromEntries(ELEMENTS.map((k) => [k, createRef<HTMLDivElement>()])) as Els, []);
  const lastTap = useRef({ time: -Infinity, x: 0 });
  const duration = player.duration;
  // One model per player; callbacks and initial values are read once when it opens.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const model = useMemo(() => createModel(props, content), [player]);
  const onTap = useCallback((time: number) => player.dispatch({ type: "move", position: time }), [player]);

  useKeys({
    j: () => keyView(zoom(model.m.view, 0.5, 1 / (1 - KEY_STEP), duration)),
    k: () => keyView(zoom(model.m.view, 0.5, 1 - KEY_STEP, duration)),
    H: () => keyView(pan(model.m.view, -KEY_STEP * length(model.m.view), duration)),
    L: () => keyView(pan(model.m.view, KEY_STEP * length(model.m.view), duration)),
  });
  const keyView = (view: Section) => {
    model.setView(view);
    model.commit();
  };

  useViewportGestures(root, model, duration, onTap);
  useRender(model, player, els, canvas, content, draw);

  const handle = (side: "start" | "end") => (e: ReactPointerEvent<HTMLDivElement>) => {
    model.lift();
    drag(e, (x) => model.setLoop(resizeLoop(model.m.loop, side, clamp(model.fraction(x), 0, 1))), () => model.commit());
  };
  const shift = (e: ReactPointerEvent<HTMLDivElement>) => {
    const from = model.m.loop;
    model.lift();
    drag(e, (_, dx) => model.setLoop(shiftLoop(from, dx / model.width())), () => model.commit());
  };
  const scrub = (e: ReactPointerEvent<HTMLDivElement>) =>
    drag(e, (x) => player.scrubTo(model.time(x)), (moved) => moved && player.endScrub(), TAP_PX);
  const resetOnDoubleTap = (e: ReactPointerEvent) => {
    if (!e.isPrimary) return;
    const last = lastTap.current;
    if (e.timeStamp - last.time < DOUBLE_TAP_MS && Math.abs(e.clientX - last.x) < DOUBLE_TAP_PX) {
      model.setLoop(FULL);
      model.commit();
    }
    lastTap.current = { time: e.timeStamp, x: e.clientX };
  };

  const loopHandle = (ref: RefObject<HTMLDivElement | null>, side: "start" | "end") => (
    <div ref={ref} data-control aria-label={`Loop ${side}`} className="absolute bottom-0 -translate-x-1/2 z-10 flex items-end justify-center w-9 h-full cursor-ew-resize touch-none" onPointerDown={handle(side)}>
      <Triangle points="8,0 16,22 0,22" fill="var(--color-neutral-2)" />
    </div>
  );

  return (
    <div ref={root} className="relative flex flex-col w-full flex-1 min-h-0 select-none touch-none">
      <div id="timeline-ruler" className={ROW}>
        <div className="relative w-full h-full">
          <div ref={els.ticks} className="absolute inset-0 pointer-events-none" />
          <div ref={els.grip} data-control aria-label="Playhead" className="absolute top-0 -translate-x-1/2 z-10 flex justify-center w-9 h-7 cursor-ew-resize touch-none" onPointerDown={scrub}>
            <Triangle points="0,0 16,0 8,22" fill="var(--color-play)" />
          </div>
        </div>
      </div>
      <div className="relative flex-1 min-h-0 flex flex-col overflow-hidden bg-white px-4">
        <div ref={content} className="relative w-full flex-1 min-h-0">
          {draw ? <canvas id="waveform-canvas" ref={canvas} className="absolute inset-0 w-full h-full" /> : <div ref={els.grid} className="absolute inset-0 pointer-events-none" />}
          <div ref={els.startLine} className="absolute inset-y-0 w-px bg-black/12 pointer-events-none" />
          <div ref={els.endLine} className="absolute inset-y-0 w-px -translate-x-full bg-black/12 pointer-events-none" />
          <div ref={els.line} data-testid="playhead" className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-play pointer-events-none z-10" />
        </div>
      </div>
      <div id="timeline-loop" className={ROW}>
        <div className="relative w-full h-full" onPointerDown={resetOnDoubleTap}>
          <div ref={els.shade} data-control aria-label="Loop" className="absolute inset-y-0 bg-surface-active flex items-center justify-center cursor-grab active:cursor-grabbing touch-none" onPointerDown={shift}>
            <div ref={els.marks} className="flex gap-[3px]">
              {[0, 1, 2].map((i) => (
                <span key={i} className="w-px h-2 bg-black/25" />
              ))}
            </div>
          </div>
          {loopHandle(els.startHandle, "start")}
          {loopHandle(els.endHandle, "end")}
        </div>
      </div>
    </div>
  );
}

/** Tap sets the playhead; drag pans; two pointers or the wheel zoom. */
function useViewportGestures(root: RefObject<HTMLDivElement | null>, model: Model, duration: number, onTap: (time: number) => void) {
  useEffect(() => {
    const el = root.current!;
    const pointers = new Map<number, number>();
    let gesture: { kind: "pending" | "pan" | "pinch" | "done"; x: number; view: Section; spread: number; anchor: number } | null = null;
    let active = false;
    let wheelTimer: ReturnType<typeof setTimeout> | undefined;
    const begin = () => {
      if (!active) model.lift();
      active = true;
    };
    const end = () => {
      if (active) model.commit();
      active = false;
    };
    const xs = () => [...pointers.values()];

    const down = (e: PointerEvent) => {
      if (e.target instanceof Element && e.target.closest("[data-control]")) return;
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, e.clientX);
      const view = model.m.view;
      if (pointers.size === 1) gesture = { kind: "pending", x: e.clientX, view, spread: 0, anchor: 0 };
      else if (pointers.size === 2) {
        const [a, b] = xs();
        begin();
        gesture = { kind: "pinch", x: 0, view, spread: Math.max(1, Math.abs(a - b)), anchor: clamp(model.fraction((a + b) / 2), 0, 1) };
      }
    };
    const move = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId) || !gesture) return;
      pointers.set(e.pointerId, e.clientX);
      const g = gesture;
      if (g.kind === "pending" && Math.abs(e.clientX - g.x) > TAP_PX) {
        begin();
        g.kind = "pan";
      }
      if (g.kind === "pan") model.setView(pan(g.view, (-(e.clientX - g.x) / model.width()) * length(g.view), duration));
      if (g.kind === "pinch") {
        const [a, b] = xs();
        model.setView(zoom(g.view, g.anchor, g.spread / Math.max(1, Math.abs(a - b)), duration));
      }
    };
    const up = (e: PointerEvent) => {
      if (!pointers.delete(e.pointerId) || !gesture) return;
      if (gesture.kind === "pending" && e.type === "pointerup") onTap(model.time(e.clientX));
      if (pointers.size === 0) {
        gesture = null;
        end();
      } else gesture.kind = "done";
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      begin();
      clearTimeout(wheelTimer);
      wheelTimer = setTimeout(end, WHEEL_SETTLE_MS);
      const view = model.m.view;
      const anchor = clamp(model.fraction(e.clientX), 0, 1);
      if (e.ctrlKey) model.setView(zoom(view, anchor, 1 + e.deltaY / 100, duration));
      else if (Math.abs(e.deltaX) > Math.abs(e.deltaY) / 2) model.setView(pan(view, (e.deltaX / 400) * length(view), duration));
      else model.setView(zoom(view, anchor, 1 - e.deltaY / 1000, duration));
    };

    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("wheel", wheel, { passive: false });
    return () => {
      clearTimeout(wheelTimer);
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.removeEventListener("wheel", wheel);
    };
  }, [root, model, duration, onTap]);
}

function useRender(model: Model, player: Player, els: Els, canvas: RefObject<HTMLCanvasElement | null>, content: RefObject<HTMLDivElement | null>, draw: TimelineProps["draw"]) {
  useEffect(() => {
    let raf = 0;
    let drawn = "";
    const place = (ref: RefObject<HTMLElement | null>, x: number) => {
      if (ref.current) ref.current.style.left = `${x}px`;
    };
    const frame = () => {
      raf = requestAnimationFrame(frame);
      const width = content.current?.clientWidth ?? 0;
      if (!width) return;
      const { view, loop, version } = model.m;
      const toPx = (t: number) => ((t - view.start) / length(view)) * width;
      const key = `${version}|${width}|${content.current?.clientHeight}`;
      if (key !== drawn) {
        drawn = key;
        const step = tickStep(length(view), width);
        let labels = "";
        let lines = "";
        for (let t = Math.ceil(view.start / step) * step; t <= view.end; t += step) {
          const x = toPx(t);
          lines += `<div class="absolute inset-y-0 w-px bg-border-solid" style="left:${x}px"></div>`;
          labels += `<div class="absolute top-1/2 -translate-y-1/2 font-space-mono text-[10px] leading-none text-black/30 tabular-nums" style="left:${x + 4}px">${formatTick(t, step)}</div>`;
        }
        if (els.ticks.current) els.ticks.current.innerHTML = lines + labels;
        if (els.grid.current) els.grid.current.innerHTML = lines;
        if (draw && canvas.current) draw(canvas.current, view, toSection(view, loop));
        const [from, to] = [loop.start * width, loop.end * width];
        if (els.shade.current) Object.assign(els.shade.current.style, { left: `${from}px`, width: `${to - from}px` });
        if (els.marks.current) els.marks.current.style.display = isFull(loop) ? "none" : "";
        [els.startHandle, els.startLine].forEach((r) => place(r, from));
        [els.endHandle, els.endLine].forEach((r) => place(r, to));
      }
      const x = toPx(player.position());
      const visible = x >= 0 && x <= width;
      for (const r of [els.grip, els.line]) {
        place(r, x);
        if (r.current) r.current.style.visibility = visible ? "" : "hidden";
      }
    };
    frame();
    return () => cancelAnimationFrame(raf);
  }, [model, player, els, canvas, content, draw]);
}
