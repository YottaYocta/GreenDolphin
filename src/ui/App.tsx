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

let seeding: Promise<void> | null = null;
const seedDemo = () =>
  (seeding ??= (async () => {
    await persistence.listRecordings();
    if (persistence.flag("demo")) return;
    const res = await fetch(`/${encodeURIComponent(DEMO)}`).catch(() => null);
    if (!res?.ok) return;
    await persistence.addYouTube(DEMO_VIDEO.title, DEMO_VIDEO.videoId);
    await persistence.addAudio(DEMO, await res.arrayBuffer());
    persistence.setFlag("demo", true);
  })());

export function App() {
  const [recordings, setRecordings] = useState<StoredRecording[]>([]);
  const [opened, setOpened] = useState<Opened | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);

  const openRecording = useCallback(async (recording: StoredRecording) => {
    const { id, title, source } = recording;
    const ticket = ++request.current;
    setLoading(true);
    setError(null);
    try {
      const next: Opened =
        source.kind === "youtube"
          ? { recording, kind: "youtube", videoId: source.videoId }
          : { recording, kind: "audio", size: source.size, decoded: await audio.decode(await persistence.readAudio(id)) };
      if (ticket !== request.current) return;
      setOpened(next);
      persistence.setLastOpened(id);
      persistence.saveRecordingPrefs(id, { openedAt: Date.now() });
    } catch {
      if (ticket === request.current) setError(`Couldn't open “${title}”. Is it an audio file?`);
    } finally {
      if (ticket === request.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await seedDemo();
      const list = await persistence.listRecordings();
      setRecordings(list);
      const last = list.find((r) => r.id === persistence.lastOpened());
      if (last) await openRecording(last);
      else setLoading(false);
    })().catch(() => setLoading(false));
  }, [openRecording]);

  useEffect(() => () => void (opened?.kind === "audio" && audio.release(opened.decoded)), [opened]);

  const api = useMemo<LibraryApi>(() => {
    const refresh = async () => setRecordings(await persistence.listRecordings());
    return {
      recordings,
      error,
      open: (id) => {
        const rec = recordings.find((r) => r.id === id);
        if (!rec) return;
        void openRecording(rec);
      },
      add: async (file) => {
        const added = await persistence.addAudio(file.name, await file.arrayBuffer());
        await refresh();
        await openRecording(added);
      },
      addYouTube: async (link) => {
        const videoId = youtube.parseVideoId(link);
        if (!videoId) throw new Error("Couldn't find a video in that link.");
        const found = await youtube.lookupVideo(videoId);
        if ("error" in found) throw new Error(found.error);
        const added = await persistence.addYouTube(found.title ?? `YouTube ${videoId}`, videoId);
        await refresh();
        await openRecording(added);
      },
      remove: async (id) => {
        await persistence.deleteRecording(id);
        await refresh();
      },
      home: () => {
        request.current++;
        setOpened(null);
        setLoading(false);
        persistence.setLastOpened(null);
      },
    };
  }, [recordings, error, openRecording]);

  return (
    <LibraryContext.Provider value={api}>
      <PullToRefresh />
      {loading ? (
        <Loading />
      ) : opened?.kind === "audio" ? (
        <AudioEditor key={opened.recording.id} recording={opened.recording} size={opened.size} decoded={opened.decoded} />
      ) : opened?.kind === "youtube" ? (
        <YouTubeEditor key={opened.recording.id} recording={opened.recording} videoId={opened.videoId} />
      ) : (
        <Library />
      )}
    </LibraryContext.Provider>
  );
}
