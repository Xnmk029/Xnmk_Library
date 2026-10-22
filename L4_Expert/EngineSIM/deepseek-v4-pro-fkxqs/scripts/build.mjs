/**
 * Build the browser bundles with esbuild.
 *
 *   dist/app.js             - the application (ESM, three.js bundled in)
 *   dist/engine-worklet.js  - the AudioWorklet (IIFE: worklet scopes have no
 *                             module loader in Chromium, so it must be flat)
 *   dist/index.html, dist/styles.css
 *
 * Usage: node scripts/build.mjs [--watch] [--dev]
 */

import { cpSync, mkdirSync, rmSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const DIST = join(ROOT, "dist");

const watch = process.argv.includes("--watch");
const dev = process.argv.includes("--dev");

rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });

const shared = {
  bundle: true,
  target: ["chrome110", "firefox115", "safari16"],
  minify: !dev,
  sourcemap: true,
  legalComments: "none",
  logLevel: "info",
  define: { "process.env.NODE_ENV": JSON.stringify(dev ? "development" : "production") },
};

const appOptions = {
  ...shared,
  entryPoints: [join(ROOT, "src/app/main.js")],
  outfile: join(DIST, "app.js"),
  format: "esm",
  banner: { js: "/* Cedar Ridge driving simulator - application bundle */" },
};

const workletOptions = {
  ...shared,
  entryPoints: [join(ROOT, "src/audio/worklet-processor.js")],
  outfile: join(DIST, "engine-worklet.js"),
  // An AudioWorkletGlobalScope cannot import modules: emit one flat script.
  format: "iife",
  banner: { js: "/* Cedar Ridge driving simulator - engine audio worklet */" },
};

function copyStatic() {
  cpSync(join(ROOT, "web/index.html"), join(DIST, "index.html"));
  cpSync(join(ROOT, "web/styles.css"), join(DIST, "styles.css"));
}

function report() {
  copyStatic();
  const sizes = ["app.js", "engine-worklet.js", "index.html", "styles.css"].map((name) => {
    const bytes = statSync(join(DIST, name)).size;
    return `${name} ${(bytes / 1024).toFixed(1)} KiB`;
  });
  console.log(`build complete: ${sizes.join(", ")}`);
}

if (watch) {
  const appContext = await esbuild.context(appOptions);
  const workletContext = await esbuild.context(workletOptions);
  await appContext.watch();
  await workletContext.watch();
  copyStatic();
  console.log("watching for changes (ctrl-c to stop)");
} else {
  await esbuild.build(appOptions);
  await esbuild.build(workletOptions);
  report();
}
