import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { BrowserRouter } from "react-router";
import { AudioStoreProvider } from "./AudioStore.tsx";
import { RecordingsStoreProvider } from "./RecordingsStore.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AudioStoreProvider>
        <RecordingsStoreProvider>
          <App />
        </RecordingsStoreProvider>
      </AudioStoreProvider>
    </BrowserRouter>
  </StrictMode>
);
