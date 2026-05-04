import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import wasm from "vite-plugin-wasm";

export default defineConfig({
  plugins: [react(), wasm()],
  worker: {
    format: "es",
    plugins: () => [wasm()],
  },
  server: {
    host: "0.0.0.0",
    port: 3000,
  },
});
