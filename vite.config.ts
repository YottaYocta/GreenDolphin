import { defineConfig, loadEnv } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const allowedHosts = env.NGROK_HOST ? [env.NGROK_HOST] : [];
  return {
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate", // auto updates service worker
      includeAssets: ["favicon/favicon.svg", "favicon/apple-touch-icon.png"],
      manifest: {
        name: "GreenDolphin",
        short_name: "GreenDolphin",
        description: "Music looper and analysis tool",
        theme_color: "#ffffff",
        icons: [
          {
            src: "favicon/web-app-manifest-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "favicon/web-app-manifest-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "favicon/web-app-manifest-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
    }),
  ],
    base: "/",
    server: { allowedHosts },
  };
});
