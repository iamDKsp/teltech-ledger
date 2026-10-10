import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { readdir } from "node:fs/promises";

const repoDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const apiDir = path.join(repoDir, "artifacts", "api-server");
const requireApi = createRequire(path.join(apiDir, "package.json"));
const { build } = requireApi("esbuild");
const testDir = path.join(apiDir, "src", "__tests__");
await build({
  entryPoints: (await readdir(testDir)).filter((f) => f.endsWith(".test.ts")).map((f) => path.join(testDir, f)),
  bundle: true, platform: "node", format: "esm",
  // Workspace packages export TS with directory imports; bundle them locally.
  alias: { "@workspace/db": path.join(repoDir, "lib", "db", "src", "index.ts") },
  outdir: path.join(apiDir, "dist", "tests"), outExtension: { ".js": ".mjs" }, logLevel: "error",
  banner: { js: "import { createRequire as createTestRequire } from 'node:module'; const require = createTestRequire(import.meta.url);" },
  plugins: [{ name: "runtime-packages", setup(builder) {
    builder.onResolve({ filter: /^(pg|pino|express|sharp|@whiskeysockets\/baileys)(\/.*)?$/ }, (args) => {
      const importerRequire = createRequire(args.importer || path.join(apiDir, "package.json"));
      return { path: pathToFileURL(importerRequire.resolve(args.path)).href, external: true };
    });
  } }],
});
