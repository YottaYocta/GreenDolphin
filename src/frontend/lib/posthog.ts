import { PostHog } from "posthog-node/edge";

const enabled = import.meta.env.VITE_POSTHOG_ENABLED === "true";

function getOrCreateDistinctId(): string {
  const key = "posthog_distinct_id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

export const posthogClient = new PostHog(
  import.meta.env.VITE_POSTHOG_KEY as string,
  {
    host: import.meta.env.VITE_POSTHOG_HOST as string,
    isServer: false,
    enableExceptionAutocapture: enabled,
  },
);

export const distinctId = getOrCreateDistinctId();

if (enabled) {
  posthogClient.identify({
    distinctId,
    properties: {
      $set_once: { first_seen: new Date().toISOString() },
    },
  });
}

export function capture(
  event: string,
  properties?: Record<string, unknown>,
): void {
  if (!enabled) return;
  posthogClient.capture({ distinctId, event, properties });
}

export function captureException(
  error: unknown,
  properties?: Record<string, unknown>,
): void {
  if (!enabled) return;
  posthogClient.captureException(
    error,
    distinctId,
    properties as Record<string | number, unknown>,
  );
}
