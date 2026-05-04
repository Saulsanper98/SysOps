import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const dir = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf-8")) as { version?: string };

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
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(pkg.version ?? "0.0.0"),
  },
});
