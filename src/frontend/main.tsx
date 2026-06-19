import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { AudioStoreProvider } from "./AudioStore.tsx";
import { RecordingsStoreProvider } from "./RecordingsStore.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AudioStoreProvider>
      <RecordingsStoreProvider>
        <App />
      </RecordingsStoreProvider>
    </AudioStoreProvider>
  </StrictMode>
);
