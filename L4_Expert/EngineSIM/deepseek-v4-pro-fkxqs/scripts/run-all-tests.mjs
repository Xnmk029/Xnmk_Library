/**
 * Run every automated suite in order and print one summary.
 *
 *   node scripts/run-all-tests.mjs [--skip-browser]
 *
 * 1. Node unit tests (audio DSP, engine orders, output bounds, real-time budget,
 *    vehicle dynamics, track geometry, integration).
 * 2. The browser suite (audio context, driving input, HUD, rendering).
 */

import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const skipBrowser = process.argv.includes("--skip-browser");

/**
 * @param {string} label
 * @param {string[]} args
 */
function run(label, args) {
  return new Promise((resolve) => {
    const started = Date.now();
    console.log(`\n=== ${label} ===`);
    const child = spawn(process.execPath, args, { cwd: ROOT, stdio: "inherit" });
    child.on("exit", (code) => resolve({ label, code: code ?? 1, seconds: (Date.now() - started) / 1000 }));
  });
}

const suites = [
  { label: "node unit + integration tests", args: ["--test", "test/*.test.mjs"] },
  { label: "audio real-time benchmark", args: ["scripts/benchmark-audio.mjs"] },
];
if (!skipBrowser) suites.push({ label: "browser suite", args: ["scripts/test-browser.mjs"] });

const outcomes = [];
for (const suite of suites) {
  outcomes.push(await run(suite.label, suite.args));
}

console.log("\n=== summary ===");
for (const outcome of outcomes) {
  console.log(`${outcome.code === 0 ? "PASS" : "FAIL"}  ${outcome.label.padEnd(34)} ${outcome.seconds.toFixed(1)} s`);
}
const failed = outcomes.filter((outcome) => outcome.code !== 0);
process.exit(failed.length > 0 ? 1 : 0);
