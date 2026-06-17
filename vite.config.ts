import { defineConfig, loadEnv } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const allowedHosts = env.NGROK_HOST ? [env.NGROK_HOST] : [];
  return {
    plugins: [react(), tailwindcss()],
    base: "/",
    server: { allowedHosts },
  };
});
