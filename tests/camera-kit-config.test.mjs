import assert from "node:assert/strict";
import test from "node:test";
import { createCameraKitConfig } from "../scripts/env-config.mjs";

test("liefert ohne Token oder Lens-Gruppe keine Browser-Konfiguration", () => {
  assert.equal(createCameraKitConfig({}, {}), null);
  assert.equal(createCameraKitConfig({ SNAP_CAMERA_KIT_API_TOKEN: "token" }, {}), null);
});

test("liest beide Camera-Kit-Werte aus der lokalen Umgebung", () => {
  assert.deepEqual(
    createCameraKitConfig(
      {
        SNAP_CAMERA_KIT_API_TOKEN: "staging-token",
        SNAP_CAMERA_KIT_LENS_GROUP_ID: "demo-group",
      },
      {}
    ),
    { apiToken: "staging-token", lensGroupId: "demo-group" }
  );
});
test("Prozessvariablen ueberschreiben die lokale Datei", () => {
  assert.deepEqual(
    createCameraKitConfig(
      {
        SNAP_CAMERA_KIT_API_TOKEN: "local-token",
        SNAP_CAMERA_KIT_LENS_GROUP_ID: "local-group",
      },
      {
        SNAP_CAMERA_KIT_API_TOKEN: "ci-token",
        SNAP_CAMERA_KIT_LENS_GROUP_ID: "ci-group",
      }
    ),
    { apiToken: "ci-token", lensGroupId: "ci-group" }
  );
});
