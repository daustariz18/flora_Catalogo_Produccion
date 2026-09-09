import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";

const port = Number(process.argv[2] ?? 5173);
const root = resolve(process.argv[3] ?? "dist");
const rootPrefix = root.endsWith(sep) ? root : `${root}${sep}`;

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`);
  const requestedPath = decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html";
  const candidate = resolve(join(root, requestedPath));
  const filePath = candidate.startsWith(rootPrefix) ? candidate : join(root, "index.html");

  try {
    const bytes = await readFile(filePath);
    response.writeHead(200, { "Content-Type": contentTypes[extname(filePath)] ?? "application/octet-stream" });
    response.end(bytes);
  } catch {
    const bytes = await readFile(join(root, "index.html"));
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(bytes);
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`Local static server: http://127.0.0.1:${port}/`);
});
