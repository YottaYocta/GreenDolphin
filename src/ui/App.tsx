import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LibraryContext, type LibraryApi, type Opened } from "./context";
import { AudioEditor, YouTubeEditor } from "./Editor";
import { Library } from "./Library";
import { Loading } from "./shared/primitives";
import { PullToRefresh } from "./shared/PullToRefresh";
import { audio } from "../audio";
import { persistence, type StoredRecording } from "../persistence";
import { youtube } from "../youtube";

const DEMO = "Wynton Kelly - On Green Dolphin Street.mp3";
const DEMO_VIDEO = { title: "Bill Evans Trio - Re: Person I Knew", videoId: "9j6PLXMSTmw" };

type Screen = { kind: "loading" } | { kind: "library"; error: string | null } | { kind: "editor"; opened: Opened };

let seeding: Promise<void> | null = null;
const seedDemo = () =>
  (seeding ??= (async () => {
    if (persistence.flag("demo")) return;
    const res = await fetch(`/${encodeURIComponent(DEMO)}`).catch(() => null);
    if (!res?.ok) return;
    await persistence.addYouTube(DEMO_VIDEO.title, DEMO_VIDEO.videoId);
    await persistence.addAudio(DEMO, await res.arrayBuffer());
    persistence.setFlag("demo", true);
  })());

export function App() {
  const [recordings, setRecordings] = useState<StoredRecording[]>([]);
  const [screen, setScreen] = useState<Screen>({ kind: "loading" });
  const opened = screen.kind === "editor" ? screen.opened : null;
  const error = screen.kind === "library" ? screen.error : null;
  const request = useRef(0);

  const openRecording = useCallback(async (recording: StoredRecording) => {
    const { id, title, source } = recording;
    const ticket = ++request.current;
    setScreen({ kind: "loading" });
    try {
      const opened: Opened =
        source.kind === "youtube"
          ? { recording, kind: "youtube", videoId: source.videoId }
          : { recording, kind: "audio", decoded: await audio.decode(await persistence.readAudio(id)) };
      if (ticket !== request.current) return;
      setScreen({ kind: "editor", opened });
      persistence.setReopenOnLaunch(id);
      persistence.saveRecordingPrefs(id, { openedAt: Date.now() });
    } catch {
      if (ticket === request.current) setScreen({ kind: "library", error: `Couldn't open “${title}”. Is it an audio file?` });
    }
  }, []);

  useEffect(() => {
    (async () => {
      await seedDemo();
      const list = await persistence.listRecordings();
      setRecordings(list);
      const last = list.find((r) => r.id === persistence.reopenOnLaunch());
      if (last) await openRecording(last);
      else setScreen({ kind: "library", error: null });
    })().catch(() => setScreen({ kind: "library", error: null }));
  }, [openRecording]);

  useEffect(() => () => void (opened?.kind === "audio" && audio.release(opened.decoded)), [opened]);

  const api = useMemo<LibraryApi>(() => {
    const refresh = async () => setRecordings(await persistence.listRecordings());
    const home = () => {
      request.current++;
      setScreen({ kind: "library", error: null });
      persistence.setReopenOnLaunch(null);
    };
    return {
      recordings,
      error,
      open: openRecording,
      add: async (file) => {
        try {
          const added = await persistence.addAudio(file.name, await file.arrayBuffer());
          await refresh();
          await openRecording(added);
        } catch {
          setScreen({ kind: "library", error: `Couldn't save “${file.name}”.` });
        }
      },
      addYouTube: async (link) => {
        const videoId = youtube.parseVideoId(link);
        if (!videoId) return "Couldn't find a video in that link.";
        const found = await youtube.lookupVideo(videoId);
        if ("error" in found) return found.error;
        const added = await persistence.addYouTube(found.title, videoId);
        await refresh();
        await openRecording(added);
        return null;
      },
      remove: async (id) => {
        home();
        await persistence.deleteRecording(id);
        await refresh();
      },
      home,
    };
  }, [recordings, error, openRecording]);

  return (
    <LibraryContext.Provider value={api}>
      <PullToRefresh />
      {screen.kind === "loading" ? (
        <Loading />
      ) : screen.kind === "library" ? (
        <Library />
      ) : screen.opened.kind === "audio" ? (
        <AudioEditor key={screen.opened.recording.id} recording={screen.opened.recording} decoded={screen.opened.decoded} />
      ) : (
        <YouTubeEditor key={screen.opened.recording.id} recording={screen.opened.recording} videoId={screen.opened.videoId} />
      )}
    </LibraryContext.Provider>
  );
}
