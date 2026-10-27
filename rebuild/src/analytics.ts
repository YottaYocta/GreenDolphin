import posthog from "posthog-js";

const enabled = import.meta.env.VITE_POSTHOG_ENABLED === "true";
if (enabled) posthog.init(import.meta.env.VITE_POSTHOG_KEY as string, { api_host: import.meta.env.VITE_POSTHOG_HOST as string, defaults: "2026-01-30" });

export const capture = (event: string, properties?: Record<string, unknown>) => enabled && posthog.capture(event, properties);
