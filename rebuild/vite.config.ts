import { defineConfig, loadEnv } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, fileURLToPath(new URL("..", import.meta.url)), "");
  return {
    root,
    envDir: "..",
    publicDir: "../public",
    plugins: [react(), tailwindcss()],
    server: { allowedHosts: env.NGROK_HOST ? [env.NGROK_HOST] : [] },
  };
});
