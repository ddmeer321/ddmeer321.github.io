import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptsDir, "..");
const entryPoint = path.join(repoRoot, "test-chatgpt", "camera-kit", "js", "camera-arcade.js");
const outputFile = path.join(repoRoot, "test-chatgpt", "camera-kit", "js", "camera-arcade.bundle.js");

await build({
  entryPoints: [entryPoint],
  outfile: outputFile,
  bundle: true,
  format: "iife",
  globalName: "CameraArcade",
  legalComments: "eof",
  minify: true,
  platform: "browser",
  target: "es2020",
});

// Einige SDK-Texte enthalten Leerzeichen am Zeilenende. Das Bereinigen hält
// den generierten Commit reproduzierbar und lässt die Programmlogik unverändert.
const generated = fs.readFileSync(outputFile, "utf8");
const normalized = generated.replace(/[\t ]+$/gm, "").replace(/\n+$/, "\n");
fs.writeFileSync(outputFile, normalized, "utf8");
