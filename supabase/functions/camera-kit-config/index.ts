// Frueher lief das ueber npm:@supabase/server@1.4.1 (withSupabase-Wrapper).
// Der Wrapper hat KEIN CORS-Preflight behandelt: ddmeer321.github.io und
// *.supabase.co sind unterschiedliche Origins, und der Authorization-Header
// zwingt den Browser zu einem OPTIONS-Preflight VOR der echten Anfrage.
// Preflights tragen laut Fetch-Spec nie einen Authorization-Header - also
// lief auch das OPTIONS durch withSupabase({auth:"user"}), fand keine
// Claims und bekam das eigene 401 zurueck. Ein 401 auf den Preflight laesst
// den Browser die echte Anfrage nie senden - daher 401 fuer jeden, auch mit
// gueltiger Sitzung. Jetzt: exakt das Muster aus admin-delete-user, das in
// diesem Projekt nachweislich funktioniert (eigener OPTIONS-Zweig, manuelles
// Auslesen des Authorization-Headers, Standard-createClient + getUser()).
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const ALLOWED_ROLES = new Set(["tester", "admin", "owner"]);
const ALLOWED_ORIGINS = [
  "https://ddmeer321.github.io",
  "http://127.0.0.1:8915",
  "http://localhost:8915",
];

function corsHeadersFor(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  const allowOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
  };
}

function json(cors: Record<string, string>, body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, ...extra, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  const cors = corsHeadersFor(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const origin = req.headers.get("origin");
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return json(cors, { error: "Origin nicht erlaubt." }, 403);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const callerClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: callerAuth } = await callerClient.auth.getUser();
  const userId = callerAuth?.user?.id;
  if (!userId) {
    return json(cors, { error: "Nicht angemeldet." }, 401);
  }

  const { data: profile, error: profileError } = await callerClient
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    return json(cors, { error: "Rolle konnte nicht geprüft werden." }, 500);
  }

  if (!profile || !ALLOWED_ROLES.has(profile.role)) {
    return json(cors, { error: "Kein Zugriff auf den Camera-Kit-Test." }, 403);
  }

  const apiToken = Deno.env.get("SNAP_CAMERA_KIT_API_TOKEN");
  const lensGroupId = Deno.env.get("SNAP_CAMERA_KIT_LENS_GROUP_ID");

  if (!apiToken || !lensGroupId) {
    return json(cors, { error: "Camera Kit ist serverseitig noch nicht konfiguriert." }, 503, { "Cache-Control": "no-store" });
  }

  return json(cors, { apiToken, lensGroupId }, 200, { "Cache-Control": "no-store, max-age=0" });
});
