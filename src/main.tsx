import { lazy, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { App } from "./ui/App";
import { startAnalytics } from "./analytics";
import { persistence } from "./persistence";

const DesignSystem = lazy(() => import("./ui/DesignSystem"));

startAnalytics(persistence.editorSettings().replay);

createRoot(document.getElementById("root")!).render(
  <StrictMode>{location.pathname === "/design" ? <DesignSystem /> : <App />}</StrictMode>,
);
