/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In dev, the browser calls /api on the Vite server and Vite forwards it to
// FastAPI, so the app needs no CORS setup and no hardcoded backend URL.
// REACT_APP_API_URL is the name the dev compose file still sets (left over
// from CRA). We read it too, so that file keeps working without edits.
const apiTarget =
  process.env.API_URL ?? process.env.REACT_APP_API_URL ?? "http://localhost:5001";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001,
    strictPort: true,
    // The dev compose sets CHOKIDAR_USEPOLLING=true: file events from a host
    // bind mount do not always reach the container, so we poll there.
    watch: { usePolling: process.env.CHOKIDAR_USEPOLLING === "true" },
    proxy: {
      "/api": { target: apiTarget, changeOrigin: true },
    },
  },
  test: {
    // Only pure helpers are unit-tested, so the default Node environment is enough.
    include: ["src/**/*.test.ts"],
  },
});
