import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    include: ["src/**/*.test.{js,jsx}"],
    environment: "jsdom",
    setupFiles: ["./src/test/setup.js"],
    css: true,
    coverage: { reporter: ["text", "json", "html"] },
  },
});
