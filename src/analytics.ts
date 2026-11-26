const enabled = import.meta.env.VITE_POSTHOG_ENABLED === "true";

let started: Promise<typeof import("posthog-js").default> | null = null;
const start = () =>
  (started ??= import("posthog-js").then(({ default: posthog }) => {
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
      capture_exceptions: { capture_unhandled_errors: true, capture_unhandled_rejections: true, capture_console_errors: true },
      disable_surveys: true,
      disable_web_experiments: true,
      disable_product_tours: true,
      disable_conversations: true,
    });
    return posthog;
  }));

export function setReplay(on: boolean) {
  if (!enabled) return;
  if (on) void start().then((posthog) => posthog.startSessionRecording());
  else void started?.then((posthog) => posthog.stopSessionRecording());
}
