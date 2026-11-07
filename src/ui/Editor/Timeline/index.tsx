import { createRef, useCallback, useEffect, useMemo, useRef, type FC, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { FULL, at, clamp, isFull, length, pan, rescale, resizeLoop, shiftLoop, toSection, zoom, type LoopFraction } from "./geometry";
import { formatTick, tickStep } from "./ticks";
import type { DurationSeconds, Player, RecordingSeconds } from "../../../core";
import type { Section } from "../../../core";
import type { AudioEngine, NoteSynth } from "../../../audio";
import type { Note } from "../../../persistence";
import { DEFAULT_NOTE, HIGH_PITCH, LOW_PITCH, MIN_NOTE, clampPitch, deleteSelected, hitNote, moveNotes, notesInBox, pitchFrequency, resizeNote, withEdited, type NotePoint, type NoteResize, type NoteStore } from "../notes";
import { drawNotes } from "./noteCanvas";
import { PIANO_WIDTH, Piano } from "./Piano";
import { drag } from "../../shared/drag";
import { useKeys } from "../../shared/keys";

export interface RollProps {
  notes: NoteStore;
  synth: NoteSynth;
  spectrum?: AudioEngine;
  pen: boolean;
}

export interface TimelineProps {
  player: Player;
  initialView: Section;
  initialLoop: LoopFraction;
  onView: (view: Section) => void;
  onLoopCommit: (loop: Section) => void;
  draw?: (canvas: HTMLCanvasElement, view: Section, loop: Section) => void;
  initialPitchTop: number | null;
  onPitchTop: (top: number) => void;
  roll: RollProps | null;
}

const TAP_PX = 6;
const WHEEL_SETTLE_MS = 250;
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_PX = 24;
const MIN_TAP_NOTE_PX = 24;
const KEY_STEP = 0.1;
const EDGE_PX = { mouse: 6, touch: 14 };
const ROW_HEIGHT = { fine: 12, coarse: 18 };
const STRIP = "h-12";
const ROW = "relative h-7 shrink-0 bg-surface rounded-lg overflow-hidden px-4";

const Triangle: FC<{ points: string; fill: string }> = ({ points, fill }) => (
  <svg width="16" height="22" viewBox="0 0 16 22" className="block">
    <polygon points={points} fill={fill} />
  </svg>
);

type ModelProps = Pick<TimelineProps, "player" | "initialView" | "initialLoop" | "onView" | "onLoopCommit" | "initialPitchTop" | "onPitchTop">;

function createModel(props: ModelProps, content: RefObject<HTMLDivElement | null>, pane: RefObject<HTMLDivElement | null>) {
  const { player, initialView, initialLoop, onView, onLoopCommit, initialPitchTop, onPitchTop } = props;
  const m = { view: initialView, loop: initialLoop, version: 0, pitchTop: initialPitchTop, rollVersion: 0, noteLength: DEFAULT_NOTE, box: null as [NotePoint, NotePoint] | null };
  const rowHeight = window.matchMedia("(pointer: coarse)").matches ? ROW_HEIGHT.coarse : ROW_HEIGHT.fine;
  const paneHeight = () => pane.current?.clientHeight || 1;
  const top = () => clamp(m.pitchTop ?? (HIGH_PITCH - 60) * rowHeight - paneHeight() / 2, 0, Math.max(0, (HIGH_PITCH - LOW_PITCH + 1) * rowHeight - paneHeight()));
  const width = () => content.current?.clientWidth || 1;
  const fraction = (clientX: number) => (clientX - (content.current?.getBoundingClientRect().left ?? 0)) / width();
  return {
    m,
    width,
    fraction,
    time: (clientX: number) => at(m.view, clamp(fraction(clientX), 0, 1 - 1e-6)),
    rowHeight,
    top,
    pitch: (clientY: number) => clampPitch(HIGH_PITCH - Math.floor((clientY - (pane.current?.getBoundingClientRect().top ?? 0) + top()) / rowHeight)),
    newNoteLength: () => Math.max(m.noteLength, (MIN_TAP_NOTE_PX / width()) * length(m.view)),
    rememberNoteLength(noteLength: number) {
      m.noteLength = noteLength;
    },
    setBox(box: [NotePoint, NotePoint] | null) {
      m.box = box;
      m.rollVersion++;
    },
    setTop(next: number) {
      m.pitchTop = next;
      m.pitchTop = top();
      m.rollVersion++;
      onPitchTop(m.pitchTop);
    },
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
const ELEMENTS = ["ticks", "grid", "grip", "line", "shade", "marks", "startHandle", "endHandle", "startLine", "endLine", "keys"] as const;
type Els = Record<(typeof ELEMENTS)[number], RefObject<HTMLDivElement | null>>;

export function Timeline(props: TimelineProps) {
  const { player, draw, roll } = props;
  const pane = useRef<HTMLDivElement>(null);
  const noteCanvas = useRef<HTMLCanvasElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const els = useMemo(() => Object.fromEntries(ELEMENTS.map((k) => [k, createRef<HTMLDivElement>()])) as Els, []);
  const lastTap = useRef({ time: -Infinity, x: 0 });
  const duration = player.duration;
  const { initialView, initialLoop, onView, onLoopCommit, initialPitchTop, onPitchTop } = props;
  const model = useMemo(
    () => createModel({ player, initialView, initialLoop, onView, onLoopCommit, initialPitchTop, onPitchTop }, content, pane),
    [player, initialView, initialLoop, onView, onLoopCommit, initialPitchTop, onPitchTop],
  );
  const inset = roll ? { paddingLeft: PIANO_WIDTH } : undefined;
  const onTap = useCallback((time: RecordingSeconds) => player.dispatch({ type: "move", position: time }), [player]);

  useKeys({
    j: () => keyView(zoom(model.m.view, 0.5, 1 / (1 - KEY_STEP), duration)),
    k: () => keyView(zoom(model.m.view, 0.5, 1 - KEY_STEP, duration)),
    H: () => keyView(pan(model.m.view, -KEY_STEP * length(model.m.view), duration)),
    L: () => keyView(pan(model.m.view, KEY_STEP * length(model.m.view), duration)),
    ...(roll && { Delete: () => deleteSelected(roll.notes), Backspace: () => deleteSelected(roll.notes) }),
  });
  const keyView = (view: Section) => {
    model.setView(view);
    model.commit();
  };

  useViewportGestures(root, model, duration, onTap, roll);
  useRender(model, player, els, canvas, content, draw, noteCanvas, pane, roll?.notes ?? null);

  const handle = (side: "start" | "end") => (e: ReactPointerEvent<HTMLDivElement>) => {
    model.lift();
    drag(e, (x) => model.setLoop(resizeLoop(model.m.loop, side, clamp(model.fraction(x), 0, 1))), () => model.commit());
  };
  const shift = (e: ReactPointerEvent<HTMLDivElement>) => {
    const from = model.m.loop;
    model.lift();
    drag(e, (_, dx) => model.setLoop(shiftLoop(from, dx / model.width())), () => model.commit());
  };
  const scrub = (e: ReactPointerEvent<HTMLDivElement>) => {
    let started = false;
    const follow = (x: number) => {
      const at = model.time(x);
      if (started) return player.scrubTo(at);
      started = true;
      player.startScrub(at);
    };
    drag(e, follow, (moved) => moved && player.endScrub(), TAP_PX);
  };
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
      <div id="timeline-ruler" className={ROW} style={inset}>
        <div className="relative w-full h-full">
          <div ref={els.ticks} className="absolute inset-0 pointer-events-none" />
          <div ref={els.grip} data-control aria-label="Playhead" className="absolute top-0 -translate-x-1/2 z-10 flex justify-center w-9 h-7 cursor-ew-resize touch-none" onPointerDown={scrub}>
            <Triangle points="0,0 16,0 8,22" fill="var(--color-play)" />
          </div>
        </div>
      </div>
      <div className={`relative ${draw || roll ? "flex-1 min-h-0" : "h-12"} flex flex-col overflow-hidden bg-white px-4`} style={inset}>
        {roll && (
          <div className={`absolute left-0 right-0 bottom-0 ${draw ? "top-12" : "top-0"}`} style={{ width: PIANO_WIDTH }}>
            <Piano keys={els.keys} top={model.top} rowHeight={model.rowHeight} roll={roll} player={player} newNoteLength={model.newNoteLength} />
          </div>
        )}
        <div ref={content} className="relative w-full flex-1 min-h-0">
          {draw ? <canvas id="waveform-canvas" ref={canvas} className={roll ? `absolute top-0 inset-x-0 w-full ${STRIP}` : "absolute inset-0 w-full h-full"} /> : !roll && <div ref={els.grid} className="absolute inset-0 pointer-events-none" />}
          {roll && (
            <div ref={pane} data-roll className={`absolute inset-x-0 bottom-0 ${draw ? "top-12 border-t border-border" : "top-0"} ${roll.pen ? "cursor-crosshair" : ""}`}>
              <canvas id="note-canvas" ref={noteCanvas} className="absolute inset-0 w-full h-full" />
            </div>
          )}
          <div ref={els.startLine} className="absolute inset-y-0 w-px bg-black/12 pointer-events-none" />
          <div ref={els.endLine} className="absolute inset-y-0 w-px -translate-x-full bg-black/12 pointer-events-none" />
          <div ref={els.line} data-testid="playhead" className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-play pointer-events-none z-10" />
        </div>
      </div>
      <div id="timeline-loop" className={ROW} style={inset}>
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

function useViewportGestures(root: RefObject<HTMLDivElement | null>, model: Model, duration: DurationSeconds, onTap: (time: RecordingSeconds) => void, roll: RollProps | null) {
  useEffect(() => {
    const el = root.current!;
    const pointers = new Map<number, { x: number; y: number }>();
    let gesture: {
      kind: "pending" | "pan" | "pinch" | "done" | "note" | "edit";
      id: number;
      x: number;
      y: number;
      view: Section;
      top: number;
      inRoll: boolean;
      panTime: boolean;
      spread: number;
      anchor: number;
      edge: number;
    } | null = null;
    let edit:
      | { kind: NoteResize; original: Note; base: Note[]; from: NotePoint; note: Note }
      | { kind: "move"; moving: Note[]; moved: Note[]; base: Note[]; from: NotePoint }
      | { kind: "box"; from: NotePoint }
      | null = null;
    let lastTap: { note: Note; time: number } | null = null;
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
    const points = () => [...pointers.values()];
    const inRollTarget = (target: EventTarget | null) => !!roll && target instanceof Element && !!target.closest("[data-roll]");
    const edgeSeconds = (pointerType: string) => ((pointerType === "mouse" ? EDGE_PX.mouse : EDGE_PX.touch) / model.width()) * length(model.m.view);

    const pointAt = (x: number, y: number) => ({ time: model.time(x), pitch: model.pitch(y) });
    const startEdit = (g: NonNullable<typeof gesture>) => {
      const { notes: store, synth } = roll!;
      const notes = store.get();
      const from = pointAt(g.x, g.y);
      g.kind = "edit";
      const hit = hitNote(notes, from.time, from.pitch, g.edge);
      if (!hit) {
        edit = { kind: "box", from };
        return store.select([]);
      }
      synth.playTone(pitchFrequency(hit.note.pitch));
      if (hit.part === "body") {
        const moving = store.selected().has(hit.note) ? [...store.selected()] : [hit.note];
        const others = new Set(moving);
        edit = { kind: "move", moving, moved: moving, base: notes.filter((n) => !others.has(n)), from };
        return store.select(moving);
      }
      edit = { kind: hit.part, original: hit.note, base: notes.filter((n) => n !== hit.note), from, note: hit.note };
      store.select([hit.note]);
    };
    const continueEdit = (x: number, y: number) => {
      const store = roll!.notes;
      const to = pointAt(x, y);
      if (!edit) return;
      if (edit.kind === "box") {
        model.setBox([edit.from, to]);
        return store.select(notesInBox(store.get(), edit.from, to));
      }
      if (edit.kind === "move") {
        const moved = moveNotes(edit.moving, edit.from, to, duration);
        if (moved[0].pitch !== edit.moved[0].pitch) roll!.synth.playTone(pitchFrequency(moved[0].pitch));
        edit.moved = moved;
        return store.preview(withEdited(edit.base, moved), moved);
      }
      edit.note = resizeNote(edit.kind, edit.original, edit.from, to, duration);
      store.preview(withEdited(edit.base, [edit.note]), [edit.note]);
    };
    const tapNote = (g: NonNullable<typeof gesture>, timeStamp: number) => {
      const { notes: store, synth } = roll!;
      const { time, pitch } = pointAt(g.x, g.y);
      const hit = hitNote(store.get(), time, pitch, 0);
      if (hit) {
        const repeated = lastTap?.note === hit.note && timeStamp - lastTap.time < DOUBLE_TAP_MS;
        lastTap = repeated ? null : { note: hit.note, time: timeStamp };
        if (repeated) return store.commit(store.get().filter((n) => n !== hit.note));
        synth.playNote(pitchFrequency(hit.note.pitch), 0, 0.2);
        return store.select([hit.note]);
      }
      lastTap = null;
      const start = Math.min(time, duration - MIN_NOTE);
      const note = { pitch, start, length: Math.min(model.newNoteLength(), duration - start) };
      store.commit(withEdited(store.get(), [note]), [note]);
      synth.playNote(pitchFrequency(pitch), 0, 0.2);
    };
    const finishEdit = (accepted: boolean) => {
      const store = roll!.notes;
      roll!.synth.playTone(null);
      if (edit?.kind === "box") model.setBox(null);
      if (edit?.kind === "move") {
        if (accepted) store.commit(withEdited(edit.base, edit.moved), edit.moved);
        else store.preview([...edit.base, ...edit.moving], edit.moving);
      }
      if (edit && "note" in edit) {
        if (!accepted) store.preview([...edit.base, edit.original], [edit.original]);
        else {
          model.rememberNoteLength(edit.note.length);
          store.commit(withEdited(edit.base, [edit.note]), [edit.note]);
        }
      }
      edit = null;
    };

    const down = (e: PointerEvent) => {
      if (e.target instanceof Element && e.target.closest("[data-control]")) return;
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const view = model.m.view;
      const top = model.top();
      const inRoll = inRollTarget(e.target);
      if (pointers.size === 1) gesture = { kind: inRoll && roll!.pen ? "note" : "pending", id: e.pointerId, x: e.clientX, y: e.clientY, view, top, inRoll, panTime: true, spread: 0, anchor: 0, edge: edgeSeconds(e.pointerType) };
      else if (pointers.size === 2 && gesture?.kind !== "edit") {
        const [a, b] = points();
        begin();
        gesture = { kind: "pinch", id: e.pointerId, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, view, top, inRoll: gesture?.inRoll ?? inRoll, panTime: true, spread: Math.max(1, Math.abs(a.x - b.x)), anchor: clamp(model.fraction((a.x + b.x) / 2), 0, 1), edge: 0 };
      }
    };
    const move = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId) || !gesture) {
        if (e.pointerType === "mouse" && roll?.pen && inRollTarget(e.target)) {
          const part = hitNote(roll.notes.get(), model.time(e.clientX), model.pitch(e.clientY), edgeSeconds("mouse"))?.part;
          el.style.cursor = !part ? "" : part === "body" ? "grab" : "ew-resize";
        }
        return;
      }
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const g = gesture;
      if ((g.kind === "note" || g.kind === "edit") && e.pointerId !== g.id) return;
      const [dx, dy] = [e.clientX - g.x, e.clientY - g.y];
      if (g.kind === "note" && Math.hypot(dx, dy) > TAP_PX) startEdit(g);
      if (g.kind === "edit") continueEdit(e.clientX, e.clientY);
      if (g.kind === "pending" && (g.inRoll ? Math.hypot(dx, dy) : Math.abs(dx)) > TAP_PX) {
        g.kind = "pan";
        g.panTime = !g.inRoll || Math.abs(dy) < 2 * Math.abs(dx);
        if (g.panTime) begin();
      }
      if (g.kind === "pan") {
        if (g.panTime) model.setView(pan(g.view, (-dx / model.width()) * length(g.view), duration));
        if (g.inRoll) model.setTop(g.top - dy);
      }
      if (g.kind === "pinch") {
        const [a, b] = points();
        const zoomed = zoom(g.view, g.anchor, g.spread / Math.max(1, Math.abs(a.x - b.x)), duration);
        model.setView(pan(zoomed, (-((a.x + b.x) / 2 - g.x) / model.width()) * length(zoomed), duration));
        if (g.inRoll) model.setTop(g.top - ((a.y + b.y) / 2 - g.y));
      }
    };
    const up = (e: PointerEvent) => {
      if (!pointers.delete(e.pointerId) || !gesture) return;
      if (gesture.kind === "pending" && e.type === "pointerup") {
        const hit = gesture.inRoll ? hitNote(roll!.notes.get(), model.time(e.clientX), model.pitch(e.clientY), 0) : null;
        if (hit) {
          roll!.synth.playNote(pitchFrequency(hit.note.pitch), 0, 0.2);
          roll!.notes.select([hit.note]);
        } else {
          onTap(model.time(e.clientX));
          roll?.notes.select([]);
        }
      }
      if (gesture.kind === "note" || gesture.kind === "edit") {
        if (e.pointerId !== gesture.id) return;
        if (gesture.kind === "note" && e.type === "pointerup") tapNote(gesture, e.timeStamp);
        if (gesture.kind === "edit") finishEdit(e.type === "pointerup");
      }
      if (pointers.size === 0) {
        gesture = null;
        end();
      } else gesture.kind = "done";
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const view = model.m.view;
      const anchor = clamp(model.fraction(e.clientX), 0, 1);
      if (!e.ctrlKey && inRollTarget(e.target) && Math.abs(e.deltaY) >= Math.abs(e.deltaX)) return model.setTop(model.top() + e.deltaY);
      begin();
      clearTimeout(wheelTimer);
      wheelTimer = setTimeout(end, WHEEL_SETTLE_MS);
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
      el.style.cursor = "";
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.removeEventListener("wheel", wheel);
    };
  }, [root, model, duration, onTap, roll]);
}

function useRender(model: Model, player: Player, els: Els, canvas: RefObject<HTMLCanvasElement | null>, content: RefObject<HTMLDivElement | null>, draw: TimelineProps["draw"], noteCanvas: RefObject<HTMLCanvasElement | null>, pane: RefObject<HTMLDivElement | null>, notes: NoteStore | null) {
  useEffect(() => notes?.subscribe(() => model.m.rollVersion++), [model, notes]);
  useEffect(() => {
    let raf = 0;
    let drawn = "";
    let rollDrawn = "";
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
      const rollKey = `${version}|${model.m.rollVersion}|${width}|${pane.current?.clientHeight}`;
      if (notes && noteCanvas.current && rollKey !== rollDrawn) {
        rollDrawn = rollKey;
        drawNotes(noteCanvas.current, notes.get(), notes.selected(), model.m.box, view, model.top(), model.rowHeight);
        if (els.keys.current) els.keys.current.style.transform = `translateY(${-model.top()}px)`;
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
  }, [model, player, els, canvas, content, draw, noteCanvas, pane, notes]);
}
