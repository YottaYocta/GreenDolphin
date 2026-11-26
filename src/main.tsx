import { lazy, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { App } from "./ui/App";
import { setReplay } from "./analytics";
import { persistence } from "./persistence";

const DesignSystem = import.meta.env.DEV && location.pathname === "/design" ? lazy(() => import("./ui/DesignSystem")) : null;

for (const key of ["gd2:flag:piano", "gd2:flag:allowSleep", "gd2:flag:noReplay", "gd_loop_prefs", "gd_session", "tutorial_shown"]) localStorage.removeItem(key);
setReplay(persistence.editorSettings().replay);

createRoot(document.getElementById("root")!).render(
  <StrictMode>{DesignSystem ? <DesignSystem /> : <App />}</StrictMode>,
);
