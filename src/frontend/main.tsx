import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { BrowserRouter } from "react-router";
import { AudioStoreProvider } from "./AudioStore.tsx";
import { RecordingsStoreProvider } from "./RecordingsStore.tsx";
import posthog from "posthog-js";
import { PostHogErrorBoundary, PostHogProvider } from "@posthog/react";

posthog.init(import.meta.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN, {
  api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
  defaults: "2026-01-30",
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PostHogProvider client={posthog}>
      <PostHogErrorBoundary>
        <BrowserRouter>
          <AudioStoreProvider>
            <RecordingsStoreProvider>
              <App />
            </RecordingsStoreProvider>
          </AudioStoreProvider>
        </BrowserRouter>
      </PostHogErrorBoundary>
    </PostHogProvider>
  </StrictMode>
);
