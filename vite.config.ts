import { defineConfig } from "vite";

/**
 * GitHub Pages servira projekt na https://<korisnik>.github.io/<repo>/,
 * pa build mora znati pod-putanju. Lokalni dev i preview rade na korijenu.
 * Workflow u .github/workflows/deploy.yml postavlja BASE_PATH.
 */
const base = process.env.BASE_PATH ?? "/";

export default defineConfig({
  base,
  build: {
    target: "es2020",
    sourcemap: false,
    chunkSizeWarningLimit: 2500,
  },
  server: {
    host: true,
    port: 5173,
  },
});
