import posthog from "posthog-js";

const enabled = import.meta.env.VITE_POSTHOG_ENABLED === "true";

export function startAnalytics(replay: boolean) {
  if (!enabled) return;
  posthog.init(import.meta.env.VITE_POSTHOG_KEY as string, {
    api_host: import.meta.env.VITE_POSTHOG_HOST as string,
    defaults: "2026-01-30",
    autocapture: false,
    rageclick: false,
    capture_pageview: false,
    capture_pageleave: false,
    capture_dead_clicks: false,
    capture_heatmaps: false,
    capture_performance: false,
    capture_exceptions: false,
    disable_surveys: true,
    disable_web_experiments: true,
    disable_product_tours: true,
    disable_conversations: true,
    disable_session_recording: !replay,
  });
}

export function setReplay(on: boolean) {
  if (!enabled) return;
  if (on) posthog.startSessionRecording();
  else posthog.stopSessionRecording();
}
