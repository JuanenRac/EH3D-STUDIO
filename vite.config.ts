import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";

// The server reads this file (next to the pages) to tell which version of Studio it is serving.
const studioVersion = () => ({
  name: "eh3d-studio-version",
  generateBundle() {
    const { version } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string };
    this.emitFile({ type: "asset", fileName: "version.json", source: JSON.stringify({ name: "eh3d-studio", version }) + "\n" });
  },
});

// While developing, the pages are served by Vite and the API of the server is reached through it (`EH3D_SERVER` names the server).
const server = process.env.EH3D_SERVER ?? "http://127.0.0.1:18200";

// The number of the version shown in the page is the one of package.json, so it cannot fall behind it.
const packageVersion = (JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string }).version;

export default defineConfig({
  define: { __STUDIO_VERSION__: JSON.stringify(packageVersion) },
  plugins: [react(), studioVersion()],
  server: {
    host: "127.0.0.1",
    port: 5188,
    strictPort: true,
    proxy: { "/api": { target: server, changeOrigin: true, ws: true } },
  },
  test: { environment: "node" },
});
