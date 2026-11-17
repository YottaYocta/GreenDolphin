import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { App } from "./ui/App";
import { startAnalytics } from "./analytics";
import { persistence } from "./persistence";

startAnalytics(!persistence.flag("noReplay"));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
