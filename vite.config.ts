import vue from "@vitejs/plugin-vue"
import { defineConfig } from "vite"

// The review app is built at publish time into dist/app, which the daemon serves.
export default defineConfig({
  root: "app",
  plugins: [vue()],
  build: { outDir: "../dist/app", emptyOutDir: true },
})
