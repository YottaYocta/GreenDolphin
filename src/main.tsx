import { lazy, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { App } from "./ui/App";
import { setReplay } from "./analytics";
import { persistence } from "./persistence";

const DesignSystem = import.meta.env.DEV && location.pathname === "/design" ? lazy(() => import("./ui/DesignSystem")) : null;

setReplay(persistence.editorSettings().replay);

createRoot(document.getElementById("root")!).render(
  <StrictMode>{DesignSystem ? <DesignSystem /> : <App />}</StrictMode>,
);
