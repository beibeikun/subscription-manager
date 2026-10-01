import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
export default defineConfig({
  plugins: [
    react(),
    tailwind(),
    {
      name: "version-service-worker",
      apply: "build",
      closeBundle() {
        const hash = createHash("sha256");
        for (const name of readdirSync("dist", { recursive: true })
          .map(String)
          .sort()) {
          const path = resolve("dist", name);
          if (statSync(path).isFile())
            hash.update(name).update(readFileSync(path));
        }
        const path = resolve("dist/sw.js");
        writeFileSync(
          path,
          readFileSync(path, "utf8").replace(
            "__CACHE_VERSION__",
            hash.digest("hex").slice(0, 16),
          ),
        );
      },
    },
  ],
  server: { proxy: { "/api": "http://localhost:3000" } },
  build: { outDir: "dist" },
});
