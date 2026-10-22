/**
 * Tiny static server for the built app.
 *
 *   node scripts/serve.mjs [--port 8125] [--root dist]
 *
 * It exists so the project has no runtime dependency on a dev-server package,
 * and so the browser test can start/stop it programmatically.
 */

import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".wav": "audio/wav",
  ".ico": "image/x-icon",
};

/**
 * @param {object} [options]
 * @param {number} [options.port] 0 picks a free port
 * @param {string} [options.root]
 * @param {boolean} [options.quiet]
 */
export function startServer({ port = 8125, root = join(ROOT, "dist"), quiet = false } = {}) {
  const base = resolve(root);
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    let pathname = decodeURIComponent(url.pathname);
    if (pathname.endsWith("/")) pathname += "index.html";
    const target = join(base, normalize(pathname).replace(/^([/\\.]+)/, ""));
    if (!target.startsWith(base) || !existsSync(target) || !statSync(target).isFile()) {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("not found");
      if (!quiet) console.log(`404 ${pathname}`);
      return;
    }
    response.writeHead(200, {
      "content-type": MIME[extname(target)] ?? "application/octet-stream",
      "cache-control": "no-cache",
    });
    createReadStream(target).pipe(response);
    if (!quiet) console.log(`200 ${pathname}`);
  });

  return new Promise((resolvePromise, reject) => {
    server.on("error", reject);
    server.listen(port, "127.0.0.1", () => {
      const address = server.address();
      const actualPort = typeof address === "object" && address ? address.port : port;
      resolvePromise({
        server,
        port: actualPort,
        url: `http://127.0.0.1:${actualPort}/`,
        close: () => new Promise((done) => server.close(() => done())),
      });
    });
  });
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}` || process.argv[1]?.endsWith("serve.mjs")) {
  const portArgument = process.argv.indexOf("--port");
  const rootArgument = process.argv.indexOf("--root");
  const port = portArgument > 0 ? Number(process.argv[portArgument + 1]) : Number(process.env.PORT ?? 8125);
  const root = rootArgument > 0 ? resolve(process.argv[rootArgument + 1]) : join(ROOT, "dist");
  if (!existsSync(root)) {
    console.error(`${root} does not exist - run "npm run build" first`);
    process.exit(1);
  }
  const instance = await startServer({ port, root });
  console.log(`serving ${root} at ${instance.url}`);
}
