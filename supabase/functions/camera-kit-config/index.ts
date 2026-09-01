import { withSupabase } from "npm:@supabase/server@1.4.1";

const ALLOWED_ROLES = new Set(["tester", "admin", "owner"]);
const ALLOWED_ORIGINS = new Set([
  "https://ddmeer321.github.io",
  "http://127.0.0.1:8915",
  "http://localhost:8915",
]);

export default {
  fetch: withSupabase({ auth: "user" }, async (request, context) => {
    const origin = request.headers.get("origin");
    if (origin && !ALLOWED_ORIGINS.has(origin)) {
      return Response.json({ error: "Origin nicht erlaubt." }, { status: 403 });
    }

    const userId = context.userClaims?.sub;
    if (!userId) {
      return Response.json({ error: "Nicht angemeldet." }, { status: 401 });
    }

    const { data: profile, error: profileError } = await context.supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      return Response.json({ error: "Rolle konnte nicht geprüft werden." }, { status: 500 });
    }

    if (!profile || !ALLOWED_ROLES.has(profile.role)) {
      return Response.json({ error: "Kein Zugriff auf den Camera-Kit-Test." }, { status: 403 });
    }

    const apiToken = Deno.env.get("SNAP_CAMERA_KIT_API_TOKEN");
    const lensGroupId = Deno.env.get("SNAP_CAMERA_KIT_LENS_GROUP_ID");

    if (!apiToken || !lensGroupId) {
      return Response.json(
        { error: "Camera Kit ist serverseitig noch nicht konfiguriert." },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }

    return Response.json(
      { apiToken, lensGroupId },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }),
};
