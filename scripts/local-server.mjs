import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createCameraKitConfig, readLocalEnv } from "./env-config.mjs";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptsDir, "..");
const localEnv = readLocalEnv(repoRoot);
const cameraKitConfig = createCameraKitConfig(localEnv);
const host = process.env.LOCAL_HOST || localEnv.LOCAL_HOST || "127.0.0.1";
const port = Number(process.env.LOCAL_PORT || localEnv.LOCAL_PORT || 8915);

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".wasm": "application/wasm",
};

function sendJson(response, status, value) {
  response.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(value));
}

function resolveStaticPath(urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }

  const relativePath = decoded === "/" ? "index.html" : decoded.replace(/^\/+/, "");
  const candidate = path.resolve(repoRoot, relativePath);
  const relative = path.relative(repoRoot, candidate);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
  return candidate;
}

const server = http.createServer((request, response) => {
  const requestUrl = new URL(request.url || "/", `http://${request.headers.host || host}`);

  if (requestUrl.pathname === "/__camera-kit/config") {
    if (!cameraKitConfig) {
      sendJson(response, 503, {
        configured: false,
        message: "Camera Kit ist lokal noch nicht konfiguriert.",
      });
      return;
    }

    sendJson(response, 200, { configured: true, ...cameraKitConfig });
    return;
  }

  const filePath = resolveStaticPath(requestUrl.pathname);
  if (!filePath) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.stat(filePath, (statError, stat) => {
    let targetPath = filePath;
    if (!statError && stat.isDirectory()) targetPath = path.join(filePath, "index.html");

    fs.readFile(targetPath, (readError, data) => {
      if (readError) {
        response.writeHead(readError.code === "ENOENT" ? 404 : 500, {
          "Content-Type": "text/plain; charset=utf-8",
        });
        response.end(readError.code === "ENOENT" ? "Not found" : "Server error");
        return;
      }

      response.writeHead(200, {
        "Cache-Control": "no-cache",
        "Content-Type": mimeTypes[path.extname(targetPath).toLowerCase()] || "application/octet-stream",
      });
      response.end(data);
    });
  });
});

server.listen(port, host, () => {
  console.log(`Spielebibliothek: http://${host}:${port}/`);
  console.log(`Camera Arcade: http://${host}:${port}/test-chatgpt/camera-kit/`);
  console.log(
    cameraKitConfig
      ? "Camera Kit: lokale Konfiguration geladen (Werte werden nicht ausgegeben)."
      : "Camera Kit: nicht konfiguriert; .env.local nach .env.example anlegen."
  );
});
