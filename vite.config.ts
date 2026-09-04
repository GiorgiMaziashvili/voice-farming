import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  base: "/voice-farming/",
  server: {
    port: 8080,
    open: true,
  },
});
