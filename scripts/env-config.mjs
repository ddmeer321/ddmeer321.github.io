import fs from "node:fs";
import path from "node:path";

export function readLocalEnv(repoRoot) {
  const envPath = path.join(repoRoot, ".env.local");
  if (!fs.existsSync(envPath)) return {};

  const result = {};
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separator = line.indexOf("=");
    if (separator < 1) continue;

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }

    result[key] = value;
  }

  return result;
}

export function createCameraKitConfig(localEnv, processEnv = process.env) {
  const apiToken =
    processEnv.SNAP_CAMERA_KIT_API_TOKEN || localEnv.SNAP_CAMERA_KIT_API_TOKEN || "";
  const lensGroupId =
    processEnv.SNAP_CAMERA_KIT_LENS_GROUP_ID || localEnv.SNAP_CAMERA_KIT_LENS_GROUP_ID || "";

  if (!apiToken || !lensGroupId) return null;
  return { apiToken, lensGroupId };
}
