import { useCallback, useEffect, useRef, useState } from "react";

function createBlankVideoUrl(): Promise<string> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext("2d");
    if (!ctx) return reject(new Error("no 2d context"));
    ctx.fillRect(0, 0, 1, 1);
    const stream = canvas.captureStream(1);
    const recorder = new MediaRecorder(stream);
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    recorder.onstop = () => {
      resolve(URL.createObjectURL(new Blob(chunks, { type: recorder.mimeType })));
    };
    recorder.start();
    setTimeout(() => recorder.stop(), 200);
  });
}

export type WakeMethod = "wake-lock" | "video" | null;

export interface AwakeState {
  method: WakeMethod;
  wakeLockError: string | null;
  videoError: string | null;
}

export function useAlwaysAwake() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playingRef = useRef(false);
  const [state, setState] = useState<AwakeState>({
    method: null,
    wakeLockError: null,
    videoError: null,
  });

  // Set up hidden video element — ready to play whenever needed
  useEffect(() => {
    const video = document.createElement("video");
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.style.cssText = "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;";
    document.body.appendChild(video);
    videoRef.current = video;

    let blobUrl: string;
    createBlankVideoUrl().then((url) => {
      blobUrl = url;
      video.src = url;
    }).catch(() => {});

    return () => {
      video.pause();
      video.remove();
      videoRef.current = null;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, []);

  const activate = useCallback(async () => {
    if (playingRef.current) return;
    playingRef.current = true;

    // Try Wake Lock first
    if ("wakeLock" in navigator) {
      try {
        const sentinel = await navigator.wakeLock.request("screen");
        setState({ method: "wake-lock", wakeLockError: null, videoError: null });
        sentinel.addEventListener("release", () => { playingRef.current = false; });
        return;
      } catch (e: unknown) {
        const wakeLockError = e instanceof Error ? e.message : String(e);
        // Fall through to video with the error recorded
        const video = videoRef.current;
        if (!video) {
          setState({ method: null, wakeLockError, videoError: "video element not ready" });
          return;
        }
        video.play()
          .then(() => setState({ method: "video", wakeLockError, videoError: null }))
          .catch((ve: unknown) => {
            playingRef.current = false;
            setState({ method: null, wakeLockError, videoError: ve instanceof Error ? ve.message : String(ve) });
          });
        return;
      }
    }

    // Wake Lock API not available — go straight to video
    const unsupportedMsg = "Wake Lock API not supported in this browser";
    const video = videoRef.current;
    if (!video) {
      setState({ method: null, wakeLockError: unsupportedMsg, videoError: "video element not ready" });
      return;
    }
    video.play()
      .then(() => setState({ method: "video", wakeLockError: unsupportedMsg, videoError: null }))
      .catch((ve: unknown) => {
        playingRef.current = false;
        setState({ method: null, wakeLockError: unsupportedMsg, videoError: ve instanceof Error ? ve.message : String(ve) });
      });
  }, []);

  return { activate, ...state };
}
