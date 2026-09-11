import { createClient } from "npm:@supabase/supabase-js@2.111.0";

const allowedOrigins = new Set([
  "https://crm-suministros-amber.vercel.app",
  "https://crm-suministros-jeptacs-projects.vercel.app",
  "https://crm-suministros-git-main-jeptacs-projects.vercel.app",
  "http://127.0.0.1:4173",
  "http://localhost:4173"
]);

const AUDITORIA_URL = Deno.env.get("AUDITORIA_ERP_URL") || "https://hurxdjoiafkjoyrmyhbd.supabase.co";
// Clave pública anon del propio frontend AuditoriaERP. Nunca se usa Service Role del sistema externo.
const AUDITORIA_ANON_KEY = Deno.env.get("AUDITORIA_ERP_ANON_KEY") || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnhkam9pYWZram95cm15aGJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MzgxMTMsImV4cCI6MjA5NTMxNDExM30.Z6fRiWft3eSEVNZbWflmcvVcHAJTAEA37tPdp4LRnTg";

const clean = (value: unknown) => String(value ?? "").trim();
const origin = (req: Request) => clean(req.headers.get("Origin"));
const isAllowedOrigin = (req: Request) => !origin(req) || allowedOrigins.has(origin(req));
const corsHeaders = (req: Request) => ({
  ...(origin(req) && allowedOrigins.has(origin(req)) ? { "Access-Control-Allow-Origin": origin(req) } : {}),
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "600",
  "Vary": "Origin"
});
const json = (req: Request, body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders(req), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }
});

const noveltyLabels: Record<string,string> = {
  SHORTAGE: "Faltante",
  EXCESS: "Sobrante",
  DAMAGED: "Avería",
  WRONG_ITEM: "Material incorrecto",
  DOCUMENT: "Documento / factura",
  QUALITY: "Calidad",
  OTHER: "Otra"
};
const severityLabels: Record<string,string> = { LOW:"Baja", MEDIUM:"Media", HIGH:"Alta", CRITICAL:"Crítica" };

function auditPayload(source: any) {
  const noveltyType = clean(source.noveltyType).toUpperCase();
  const severity = clean(source.noveltySeverity).toUpperCase();
  const noveltyLabel = noveltyLabels[noveltyType] || noveltyType || "No conformidad de recepción";
  const severityLabel = severityLabels[severity] || severity || "Sin clasificar";
  const date = clean(source.receivedAt).slice(0,10) || new Date().toISOString().slice(0,10);
  const name = `[CRM] Novedad recepción ${clean(source.receiptNumber)}`;
  const notes = [
    `Novedad generada automáticamente desde CRM Suministros.`,
    `Tipo: ${noveltyLabel}. Severidad: ${severityLabel}.`,
    clean(source.noveltyNote),
    source.totalRejected ? `Cantidad rechazada registrada: ${source.totalRejected}.` : "",
    clean(source.verificationNote) ? `Verificación: ${clean(source.verificationNote)}` : "",
    clean(source.generalNote) ? `Observación general: ${clean(source.generalNote)}` : ""
  ].filter(Boolean).join("\n");

  const specific = {
    "Origen": "CRM Suministros",
    "Clave de integración": clean(source.eventKey),
    "ID recepción CRM": clean(source.receiptId),
    "Número de recepción": clean(source.receiptNumber),
    "Tipo de novedad": noveltyLabel,
    "Severidad": severityLabel,
    "Estado de recepción": clean(source.status),
    "Proveedor": clean(source.supplierName) || "—",
    "Orden de compra": clean(source.purchaseOrderNumber) || "—",
    "Factura": clean(source.invoiceNumber) || "—",
    "Bodega": clean(source.warehouseCode) || clean(source.defaultLocation) || "—",
    "PVE enlazado": clean(source.linkedPveNumber) || "No aplica",
    "Líneas recibidas": Number(source.lineCount || 0),
    "Cantidad recibida": Number(source.totalReceived || 0),
    "Cantidad aceptada": Number(source.totalAccepted || 0),
    "Cantidad rechazada": Number(source.totalRejected || 0),
    "Información levantada": clean(source.informationCaptured) || "—"
  };

  const base = {
    tipo: "Logística",
    nombre: name,
    responsable: clean(source.receivedBy) || "Recepción CRM",
    fecha: date,
    proceso: "Recepción de mercancía · CRM Suministros",
    estado: "Pendiente",
    observaciones: notes,
    pdf_url: "[]",
    usuario: "Integración CRM"
  };
  return { full: { ...base, categoria: "Logística", datos_especificos: specific }, base, name };
}

async function auditoriaRequest(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("apikey", AUDITORIA_ANON_KEY);
  headers.set("Authorization", `Bearer ${AUDITORIA_ANON_KEY}`);
  headers.set("Content-Type", "application/json");
  const response = await fetch(`${AUDITORIA_URL}/rest/v1/${path}`, { ...init, headers });
  const text = await response.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { response, body, text };
}

async function findExisting(name: string) {
  const params = new URLSearchParams({ select:"id,nombre", nombre:`eq.${name}`, usuario:"eq.Integración CRM", limit:"1" });
  const { response, body, text } = await auditoriaRequest(`auditorias?${params.toString()}`, { method:"GET" });
  if (!response.ok) throw new Error(`AuditoriaERP no permitió consultar idempotencia (${response.status}): ${text.slice(0,300)}`);
  return Array.isArray(body) && body.length ? body[0] : null;
}

async function persistAudit(existing: any, variants: {full:any;base:any}) {
  const method = existing?.id ? "PATCH" : "POST";
  const suffix = existing?.id ? `?id=eq.${encodeURIComponent(existing.id)}` : "";
  for (const payload of [variants.full, variants.base]) {
    const { response, body, text } = await auditoriaRequest(`auditorias${suffix}`, {
      method,
      headers: { "Prefer":"return=representation" },
      body: JSON.stringify(payload)
    });
    if (response.ok) {
      const row = Array.isArray(body) ? body[0] : body;
      return row || existing || {};
    }
    const schemaDrift = /categoria|datos_especificos|column|schema cache|PGRST204/i.test(text);
    if (!schemaDrift || payload === variants.base) throw new Error(`AuditoriaERP rechazó la sincronización (${response.status}): ${text.slice(0,500)}`);
  }
  throw new Error("No fue posible persistir la auditoría espejo.");
}

Deno.serve(async (req: Request) => {
  if (!isAllowedOrigin(req)) return json(req,{error:"Origen no autorizado"},403);
  if (req.method === "OPTIONS") return new Response(null,{status:204,headers:corsHeaders(req)});
  if (req.method !== "POST") return json(req,{error:"Método no permitido"},405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !serviceKey) return json(req,{error:"Configuración del servidor incompleta"},500);

  const token = clean(req.headers.get("Authorization")).replace(/^Bearer\s+/i,"");
  if (!token) return json(req,{error:"Sesión requerida"},401);
  const admin = createClient(supabaseUrl,serviceKey,{auth:{autoRefreshToken:false,persistSession:false}});
  const { data:userData,error:userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) return json(req,{error:"Sesión inválida o vencida"},401);

  let body: any = {};
  try { body = await req.json(); } catch { return json(req,{error:"JSON inválido"},400); }
  const receiptId = clean(body?.receiptId);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(receiptId)) return json(req,{error:"receiptId inválido"},400);

  let eventKey = `CRM_WAREHOUSE_RECEIPT:${receiptId}`;
  try {
    const { data:source,error:payloadError } = await admin.rpc("erp_x_auditoria_erp_payload",{p_receipt_id:receiptId});
    if (payloadError) throw payloadError;
    if (!source) return json(req,{success:true,skipped:true,reason:"Recepción no encontrada"},200);
    eventKey = clean(source.eventKey) || eventKey;
    const hasNovelty = Boolean(clean(source.noveltyType) || clean(source.noveltyNote) || ["PARTIAL","NONCONFORMING"].includes(clean(source.status).toUpperCase()));
    if (!hasNovelty) return json(req,{success:true,skipped:true,reason:"Recepción sin novedad"},200);

    const mapped = auditPayload(source);
    const existing = await findExisting(mapped.name);
    const saved = await persistAudit(existing,mapped);
    const targetId = clean(saved?.id || existing?.id) || null;
    await admin.rpc("erp_x_auditoria_erp_mark",{p_event_key:eventKey,p_status:"SYNCED",p_error:null,p_target_audit_id:targetId});
    return json(req,{success:true,synced:true,idempotent:Boolean(existing),targetAuditId:targetId,receiptNumber:source.receiptNumber});
  } catch (error: any) {
    const message = clean(error?.message || error) || "Error de sincronización";
    await admin.rpc("erp_x_auditoria_erp_mark",{p_event_key:eventKey,p_status:"FAILED",p_error:message,p_target_audit_id:null}).catch(()=>undefined);
    console.error("[AUDITORIA ERP BRIDGE]",message);
    return json(req,{success:false,error:"La recepción quedó guardada, pero la auditoría automática está pendiente de sincronización."},502);
  }
});
