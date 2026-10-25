import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root,
  publicDir: fileURLToPath(new URL("../public", import.meta.url)),
  plugins: [react(), tailwindcss()],
});
