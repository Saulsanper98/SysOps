import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5183,
    strictPort: true,
    proxy: {
      "/api": { target: "http://localhost:3012", changeOrigin: true },
      "/ws": { target: "ws://localhost:3012", ws: true },
    },
  },
  define: {
    "import.meta.env.VITE_API_URL": JSON.stringify(process.env.VITE_API_URL ?? ""),
  },
});
