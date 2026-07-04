import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "html5-qrcode": "html5-qrcode/esm/index.js"
    }
  },
  optimizeDeps: {
    include: ["html5-qrcode"]
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:8000"
    }
  }
});
