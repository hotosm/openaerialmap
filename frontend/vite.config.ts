import react from "@vitejs/plugin-react";
import UnoCSS from "unocss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [UnoCSS(), react()],
  server: {
    host: "0.0.0.0",
    port: 3000,
  },
});
