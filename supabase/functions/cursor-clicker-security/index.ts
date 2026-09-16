import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const ORIGINS = new Set([
  "https://ddmeer321.github.io",
  "http://127.0.0.1:8899", "http://localhost:8899",
  "http://127.0.0.1:8915", "http://localhost:8915",
  "http://127.0.0.1:8916", "http://localhost:8916",
]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function cors(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ORIGINS.has(origin) ? origin : "https://ddmeer321.github.io",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Cache-Control": "no-store",
    "Vary": "Origin",
  };
}
function json(headers: Record<string,string>, body: unknown, status=200) {
  return new Response(JSON.stringify(body), { status, headers: {...headers, "Content-Type":"application/json; charset=utf-8"} });
}
Deno.serve(async req => {
  const headers = cors(req);
  if (req.method === "OPTIONS") return new Response("ok", {headers});
  if (req.method !== "POST") return json(headers,{error:"Methode nicht erlaubt."},405);
  if (Number(req.headers.get("content-length")||0)>16384) return json(headers,{error:"Anfrage zu groß."},413);

  const token = req.headers.get("Authorization") ?? "";
  if (!token.startsWith("Bearer ")) return json(headers,{error:"Nicht angemeldet."},401);
  const caller = createClient(URL,ANON_KEY,{global:{headers:{Authorization:token}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data:auth,error:authError}=await caller.auth.getUser();
  if (authError||!auth.user) return json(headers,{error:"Nicht angemeldet."},401);

  const admin=createClient(URL,SERVICE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:profile}=await admin.from("profiles").select("role,banned").eq("id",auth.user.id).maybeSingle();
  if (!profile||profile.banned) return json(headers,{error:"Kein Zugriff."},403);

  let body:Record<string,unknown>;
  try { body=await req.json(); } catch { return json(headers,{error:"Ungültige Anfrage."},400); }
  const action=typeof body.action==="string"?body.action:"";
  const actionId=typeof body.clientActionId==="string"?body.clientActionId:"";

  if (action==="status") {
    const {data,error}=await admin.rpc("cc_security_status",{p_user_id:auth.user.id});
    return error?json(headers,{error:"Status konnte nicht geladen werden."},500):json(headers,data);
  }
  if (!UUID.test(actionId)) return json(headers,{error:"Ungültige Aktions-ID."},400);

  const since=new Date(Date.now()-60000).toISOString();
  const {count}=await admin.from("cc_security_actions").select("*",{count:"exact",head:true}).eq("user_id",auth.user.id).gte("created_at",since);
  if ((count??0)>=30) return json(headers,{error:"Zu viele Anfragen. Bitte kurz warten."},429);

  const {data:replay}=await admin.from("cc_security_actions").select("status,result_summary,reason_code").eq("user_id",auth.user.id).eq("client_action_id",actionId).maybeSingle();
  if (replay) return json(headers,{replay:true,...replay});

  try {
    if (action==="request_legacy_migration") {
      const {data,error}=await admin.rpc("cc_request_legacy_migration",{p_user_id:auth.user.id});
      if (error) throw error;
      await record(admin,auth.user.id,actionId,action,"accepted",null,data);
      return json(headers,data);
    }
    if (action==="owner_trade_history") {
      if (profile.role!=="owner") {
        await record(admin,auth.user.id,actionId,action,"rejected","owner_required",{});
        return json(headers,{error:"Keine Berechtigung."},403);
      }
      const limit=Number.isInteger(body.limit)?Math.min(Math.max(Number(body.limit),1),100):50;
      const before=typeof body.before==="string"?body.before:null;
      const {data,error}=await admin.rpc("cc_owner_trade_history",{p_owner_id:auth.user.id,p_limit:limit,p_before:before});
      if (error) throw error;
      await record(admin,auth.user.id,actionId,action,"accepted",null,{count:data?.length??0});
      return json(headers,{trades:data??[]});
    }
    await record(admin,auth.user.id,actionId,action||"unknown","rejected","unknown_action",{});
    return json(headers,{error:"Unbekannte Aktion."},400);
  } catch (error) {
    console.error("cursor-clicker-security",action,error instanceof Error?error.message:"unknown");
    await record(admin,auth.user.id,actionId,action||"unknown","failed","server_error",{});
    return json(headers,{error:"Aktion konnte nicht verarbeitet werden."},500);
  }
});

async function record(admin:ReturnType<typeof createClient>,userId:string,actionId:string,action:string,status:"accepted"|"rejected"|"failed",reason:string|null,result:unknown) {
  await admin.from("cc_security_actions").insert({
    user_id:userId, client_action_id:actionId, action_type:(action||"unknown").slice(0,64),
    status, reason_code:reason, result_summary:result&&typeof result==="object"?result:{},
  });
}
