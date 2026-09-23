// NICHT DEPLOYT. Siehe README.md in diesem Ordner.
//
// Unterschied zur laufenden Fassung v7: die Owner-Freigabe schickt den Hash
// der Vorschau mit, die sie angezeigt bekommen hat (vorschauHash). Die
// Datenbank lehnt ab, wenn sich die Vorschau seitdem geaendert hat.
//
// Tor zum Trading.
//
// Das Tor ist NICHT mehr der Tester-Rang, sondern die Freigabe durch den
// Owner (cc_ist_freigegeben). Der Tester-Rang oeffnet den ganzen Testbereich;
// wer nur handeln koennen soll, braucht das nicht.
//
// Zwei Aktionen bleiben fuer alle Angemeldeten offen - sonst koennte niemand
// je einen Antrag stellen und damit nie freigegeben werden:
//   status, prepare_trading, request_legacy_migration
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ORIGINS = new Set([
  "https://ddmeer321.github.io",
  "http://127.0.0.1:8899", "http://localhost:8899",
  "http://127.0.0.1:8915", "http://localhost:8915",
  "http://127.0.0.1:8916", "http://localhost:8916",
]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MUTATING = new Set(["prepare_trading", "request_legacy_migration", "activate_trading", "create_trade", "set_offer", "send_offer", "confirm_trade", "close_trade", "owner_review_migration"]);
// Vor der Freigabe erreichbar. Kurz halten: Jede Zeile hier ist eine Tuer,
// die fuer jeden Angemeldeten offen steht.
const OHNE_FREIGABE = new Set(["status", "prepare_trading", "request_legacy_migration"]);

function cors(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ORIGINS.has(origin) ? origin : "https://ddmeer321.github.io",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS", "Cache-Control": "no-store", "Vary": "Origin",
  };
}
function json(headers: Record<string,string>, body: unknown, status=200) {
  return new Response(JSON.stringify(body), { status, headers: {...headers, "Content-Type":"application/json; charset=utf-8"} });
}
function knownError(message: string) {
  const map: Record<string,string> = {
    owner_approval_required: "Dein Inventar muss zuerst vom Owner freigegeben werden.",
    save_changed_after_review: "Der Spielstand hat sich nach der Prüfung geändert. Bitte einen neuen Import beantragen.",
    target_not_active: "Dieser Spieler ist noch nicht fürs Trading freigegeben.",
    trading_not_active: "Du bist noch nicht fürs Trading freigegeben.",
    both_sides_need_items: "Beide Spieler müssen mindestens einen Cursor anbieten.",
    invalid_or_locked_item: "Mindestens ein Cursor ist nicht verfügbar oder bereits gesperrt.",
    trade_changed_or_expired: "Das Angebot wurde geändert oder ist abgelaufen. Bitte neu laden.",
    trade_not_editable: "Dieses Angebot kann nicht mehr geändert werden.",
    trade_not_sendable: "Dieses Angebot kann gerade nicht gesendet werden.",
    cursor_save_missing: "Für diesen Spieler wurde kein Cursor-Clicker-Spielstand gefunden.",
    pending_request_not_found: "Kein offener Importantrag gefunden.",
    legacy_save_not_found: "Noch kein synchronisierter Cursor-Clicker-Spielstand gefunden.",
    vorschau_veraltet: "Die Vorschau hat sich geändert, seit du sie geladen hast. Bitte die Liste neu laden und noch einmal ansehen.",
  };
  return map[message] || "Aktion konnte nicht verarbeitet werden.";
}

Deno.serve(async req => {
  const headers = cors(req);
  if (req.method === "OPTIONS") return new Response("ok", {headers});
  if (req.method !== "POST") return json(headers,{error:"Methode nicht erlaubt."},405);
  if (Number(req.headers.get("content-length")||0)>16384) return json(headers,{error:"Anfrage zu groß."},413);
  const token = req.headers.get("Authorization") ?? "";
  if (!token.startsWith("Bearer ")) return json(headers,{error:"Nicht angemeldet."},401);
  const jwt = token.slice("Bearer ".length).trim();
  const admin=createClient(URL,SERVICE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:auth,error:authError}=await admin.auth.getUser(jwt);
  if (authError||!auth.user) return json(headers,{error:"Nicht angemeldet."},401);
  const {data:profile}=await admin.from("profiles").select("role,banned").eq("id",auth.user.id).maybeSingle();
  if (!profile||profile.banned) return json(headers,{error:"Kein Zugriff."},403);

  let body:Record<string,unknown>;
  try { body=await req.json(); } catch { return json(headers,{error:"Ungültige Anfrage."},400); }
  const action=typeof body.action==="string"?body.action:"";
  const actionId=typeof body.clientActionId==="string"?body.clientActionId:"";

  // Das Tor. Die Freigabe erteilt ausschliesslich der Owner in admin/.
  if (!OHNE_FREIGABE.has(action)) {
    const {data:frei}=await admin.rpc("cc_ist_freigegeben",{p_user_id:auth.user.id});
    if (!frei) return json(headers,{error:"Du bist noch nicht fürs Trading freigegeben. Beantrage den Import — der Owner schaltet dich frei."},403);
  }

  if (MUTATING.has(action)) {
    if (!UUID.test(actionId)) return json(headers,{error:"Ungültige Aktions-ID."},400);
    const since=new Date(Date.now()-60000).toISOString();
    const {count}=await admin.from("cc_security_actions").select("*",{count:"exact",head:true}).eq("user_id",auth.user.id).gte("created_at",since);
    if ((count??0)>=30) return json(headers,{error:"Zu viele Anfragen. Bitte kurz warten."},429);
    const {data:replay}=await admin.from("cc_security_actions").select("status,result_summary,reason_code").eq("user_id",auth.user.id).eq("client_action_id",actionId).maybeSingle();
    if (replay) return json(headers,{replay:true,...replay});
  }
  try {
    let data:unknown;
    if (action==="status") data=await rpc(admin,"cc_security_status",{p_user_id:auth.user.id});
    else if (action==="prepare_trading") data=await rpc(admin,"cc_prepare_trading",{p_user_id:auth.user.id});
    else if (action==="request_legacy_migration") data=await rpc(admin,"cc_request_legacy_migration",{p_user_id:auth.user.id});
    else if (action==="activate_trading") data=await rpc(admin,"cc_bootstrap_trading",{p_user_id:auth.user.id});
    else if (action==="search_players") data=await rpc(admin,"cc_search_players",{p_user_id:auth.user.id,p_query:typeof body.query==="string"?body.query.slice(0,32):""});
    else if (action==="trading_snapshot") data=await rpc(admin,"cc_trading_snapshot",{p_user_id:auth.user.id});
    else if (action==="create_trade") {
      const targetId=String(body.targetId||""); if (!UUID.test(targetId)) return json(headers,{error:"Ungültiger Spieler."},400);
      data=await rpc(admin,"cc_create_trade",{p_user_id:auth.user.id,p_target_id:targetId,p_action_id:actionId});
    } else if (action==="set_offer") {
      const tradeId=String(body.tradeId||""); const itemIds=Array.isArray(body.itemIds)?body.itemIds.map(String):[];
      if (!UUID.test(tradeId)||itemIds.some(id=>!UUID.test(id))) return json(headers,{error:"Ungültiges Angebot."},400);
      data=await rpc(admin,"cc_set_trade_offer",{p_user_id:auth.user.id,p_trade_id:tradeId,p_item_ids:itemIds});
    } else if (action==="send_offer") data=await tradeRpc(admin,"cc_send_trade_offer",auth.user.id,body);
    else if (action==="confirm_trade") {
      const tradeId=String(body.tradeId||""); const revision=Number(body.revision);
      if (!UUID.test(tradeId)||!Number.isInteger(revision)) return json(headers,{error:"Ungültige Bestätigung."},400);
      data=await rpc(admin,"cc_confirm_trade",{p_user_id:auth.user.id,p_trade_id:tradeId,p_revision:revision});
    } else if (action==="close_trade") {
      const tradeId=String(body.tradeId||""); const mode=body.mode==="decline"?"decline":"cancel";
      if (!UUID.test(tradeId)) return json(headers,{error:"Ungültiger Trade."},400);
      data=await rpc(admin,"cc_close_trade",{p_user_id:auth.user.id,p_trade_id:tradeId,p_mode:mode});
    } else if (action==="owner_trade_history") {
      if (profile.role!=="owner") return json(headers,{error:"Keine Berechtigung."},403);
      const trades=await rpc(admin,"cc_owner_trade_history",{p_owner_id:auth.user.id,p_limit:Number.isInteger(body.limit)?Math.min(Math.max(Number(body.limit),1),100):50,p_before:typeof body.before==="string"?body.before:null});
      return json(headers,{trades:trades??[]});
    } else if (action==="owner_migration_queue") {
      if (profile.role!=="owner") return json(headers,{error:"Keine Berechtigung."},403);
      data=await rpc(admin,"cc_owner_migration_queue",{p_owner_id:auth.user.id});
    } else if (action==="owner_review_migration") {
      if (profile.role!=="owner") return json(headers,{error:"Keine Berechtigung."},403);
      const targetId=String(body.targetId||""); if (!UUID.test(targetId)) return json(headers,{error:"Ungültiger Spieler."},400);
      // Der Hash kommt aus der Warteschlange, die der Owner angesehen hat.
      // Fehlt er, lehnt die Datenbank eine Freigabe ab -- absichtlich.
      data=await rpc(admin,"cc_owner_review_migration",{p_owner_id:auth.user.id,p_user_id:targetId,p_decision:body.decision==="approved"?"approved":"rejected",p_note:String(body.note||"").slice(0,500),p_vorschau_hash:typeof body.vorschauHash==="string"?body.vorschauHash:null});
    } else return json(headers,{error:"Unbekannte Aktion."},400);
    if (MUTATING.has(action)) await record(admin,auth.user.id,actionId,action,"accepted",null,data);
    return json(headers,data??{});
  } catch (error) {
    const message=error instanceof Error?error.message:"unknown";
    console.error("cursor-clicker-security",action,message);
    if (MUTATING.has(action)) await record(admin,auth.user.id,actionId,action,"failed",message.slice(0,64),{});
    return json(headers,{error:knownError(message)},message.includes("required")?403:409);
  }
});

async function rpc(admin:ReturnType<typeof createClient>,name:string,args:Record<string,unknown>) {
  const {data,error}=await admin.rpc(name,args); if (error) throw new Error(error.message); return data;
}
async function tradeRpc(admin:ReturnType<typeof createClient>,name:string,userId:string,body:Record<string,unknown>) {
  const tradeId=String(body.tradeId||""); if (!UUID.test(tradeId)) throw new Error("trade_not_found");
  return rpc(admin,name,{p_user_id:userId,p_trade_id:tradeId});
}
async function record(admin:ReturnType<typeof createClient>,userId:string,actionId:string,action:string,status:"accepted"|"rejected"|"failed",reason:string|null,result:unknown) {
  await admin.from("cc_security_actions").insert({user_id:userId,client_action_id:actionId,action_type:(action||"unknown").slice(0,64),status,reason_code:reason,result_summary:result&&typeof result==="object"?result:{}});
}
