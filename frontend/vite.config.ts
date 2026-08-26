import react from "@vitejs/plugin-react";
import UnoCSS from "unocss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [UnoCSS(), react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // keep WebAwesome cached independently of app deploys
          if (id.includes("@awesome.me/webawesome")) return "webawesome";
        },
      },
    },
  },
  server: {
    host: "0.0.0.0",
    port: 3000,
  },
});
