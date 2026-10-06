import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VALID_ROLES = ["user", "tester", "admin", "owner"];

const ALLOWED_ORIGINS = [
  "https://ddmeer321.github.io",
  "http://127.0.0.1:8899",
  "http://localhost:8899",
];

function corsHeadersFor(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  const allowOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Cache-Control": "no-store",
    "Vary": "Origin",
  };
}

function json(cors: Record<string, string>, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json; charset=utf-8" },
  });
}

Deno.serve(async (req) => {
  const cors = corsHeadersFor(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(cors, { error: "Methode nicht erlaubt." }, 405);

  try {
    const { targetId, newRole } = await req.json();
    if (!targetId || !VALID_ROLES.includes(newRole)) {
      return json(cors, { error: "Ungültige Anfrage." }, 400);
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json(cors, { error: "Nicht angemeldet." }, 401);
    }
    const jwt = authHeader.slice("Bearer ".length).trim();
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: callerAuth, error: callerError } = await admin.auth.getUser(jwt);
    if (callerError || !callerAuth.user) return json(cors, { error: "Nicht angemeldet." }, 401);
    const { data: callerProfile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", callerAuth.user.id)
      .maybeSingle();
    if (callerProfile?.role !== "owner") return json(cors, { error: "Keine Berechtigung." }, 403);

    if (targetId === callerAuth.user.id) {
      return json(cors, { error: "Du kannst deine eigene Rolle hier nicht ändern." }, 400);
    }

    const { data: targetProfile } = await admin.from("profiles").select("role").eq("id", targetId).maybeSingle();
    if (!targetProfile) return json(cors, { error: "Benutzer nicht gefunden." }, 404);

    if (targetProfile.role === "owner" && newRole !== "owner") {
      const { count } = await admin.from("profiles").select("*", { count: "exact", head: true }).eq("role", "owner");
      if ((count ?? 0) <= 1) {
        return json(cors, { error: "Der letzte Owner kann nicht degradiert werden." }, 400);
      }
    }

    const { error } = await admin.from("profiles").update({ role: newRole }).eq("id", targetId);
    if (error) return json(cors, { error: "Rolle konnte nicht geändert werden." }, 500);

    return json(cors, { ok: true });
  } catch {
    return json(cors, { error: "Ungültige Anfrage." }, 400);
  }
});
