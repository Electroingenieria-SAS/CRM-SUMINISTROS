import { createClient } from "npm:@supabase/supabase-js@2.111.0";

const allowedOrigins = new Set([
  "https://crm-suministros-amber.vercel.app",
  "https://crm-suministros-jeptacs-projects.vercel.app",
  "https://crm-suministros-git-main-jeptacs-projects.vercel.app",
  "http://127.0.0.1:4173",
  "http://localhost:4173"
]);

const AUDITORIA_CONFIG_URL = Deno.env.get("AUDITORIA_ERP_CONFIG_URL") || "https://raw.githubusercontent.com/Electroingenieria-SAS/AuditoriaERP/main/js/config.js";
let auditoriaConfigPromise: Promise<{url:string;key:string}> | null = null;

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

async function getAuditoriaConfig(){
  const envUrl=clean(Deno.env.get("AUDITORIA_ERP_URL"));
  const envKey=clean(Deno.env.get("AUDITORIA_ERP_ANON_KEY"));
  if(envUrl&&envKey)return {url:envUrl.replace(/\/$/,""),key:envKey};
  if(auditoriaConfigPromise)return auditoriaConfigPromise;
  auditoriaConfigPromise=(async()=>{
    const response=await fetch(AUDITORIA_CONFIG_URL,{headers:{Accept:"text/plain"},redirect:"follow"});
    if(!response.ok)throw new Error(`No fue posible cargar la configuración pública de AuditoriaERP (${response.status}).`);
    const text=await response.text();
    const urlMatch=text.match(/https:\/\/[a-z0-9]+\.supabase\.co/i);
    const keyMatch=text.match(/(?:eyJ[A-Za-z0-9._-]{80,}|sb_publishable_[A-Za-z0-9_-]{20,})/);
    if(!urlMatch||!keyMatch)throw new Error("La configuración pública de AuditoriaERP no contiene los parámetros esperados.");
    return {url:urlMatch[0].replace(/\/$/,""),key:keyMatch[0]};
  })().catch(error=>{auditoriaConfigPromise=null;throw error});
  return auditoriaConfigPromise;
}

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
    "Novedad generada automáticamente desde CRM Suministros.",
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
  const config=await getAuditoriaConfig();
  const headers = new Headers(init.headers || {});
  headers.set("apikey", config.key);
  headers.set("Authorization", `Bearer ${config.key}`);
  headers.set("Content-Type", "application/json");
  const response = await fetch(`${config.url}/rest/v1/${path}`, { ...init, headers });
  const text = await response.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { response, body, text };
}

async function findExisting(name: string) {
  const params = new URLSearchParams({ select:"id,nombre,estado,responsable", nombre:`eq.${name}`, usuario:"eq.Integración CRM", limit:"1" });
  const { response, body, text } = await auditoriaRequest(`auditorias?${params.toString()}`, { method:"GET" });
  if (!response.ok) throw new Error(`AuditoriaERP no permitió consultar idempotencia (${response.status}): ${text.slice(0,300)}`);
  return Array.isArray(body) && body.length ? body[0] : null;
}

async function persistAudit(existing: any, variants: {full:any;base:any}) {
  if (existing?.id) {
    const fullUpdate = {
      tipo: variants.full.tipo,
      categoria: variants.full.categoria,
      observaciones: variants.full.observaciones,
      datos_especificos: variants.full.datos_especificos,
      usuario: variants.full.usuario
    };
    const baseUpdate = {
      tipo: variants.base.tipo,
      observaciones: variants.base.observaciones,
      usuario: variants.base.usuario
    };
    for (const payload of [fullUpdate, baseUpdate]) {
      const { response, body, text } = await auditoriaRequest(`auditorias?id=eq.${encodeURIComponent(existing.id)}`, {
        method:"PATCH",
        headers:{"Prefer":"return=representation"},
        body:JSON.stringify(payload)
      });
      if (response.ok) {
        const row=Array.isArray(body)?body[0]:body;
        return row||existing;
      }
      const schemaDrift=/categoria|datos_especificos|column|schema cache|PGRST204/i.test(text);
      if (!schemaDrift || payload===baseUpdate) throw new Error(`AuditoriaERP rechazó la actualización (${response.status}): ${text.slice(0,500)}`);
    }
  }

  for (const payload of [variants.full, variants.base]) {
    const { response, body, text } = await auditoriaRequest("auditorias", {
      method:"POST",
      headers:{"Prefer":"return=representation"},
      body:JSON.stringify(payload)
    });
    if (response.ok) {
      const row=Array.isArray(body)?body[0]:body;
      return row||{};
    }
    const schemaDrift=/categoria|datos_especificos|column|schema cache|PGRST204/i.test(text);
    if (!schemaDrift || payload===variants.base) throw new Error(`AuditoriaERP rechazó la sincronización (${response.status}): ${text.slice(0,500)}`);
  }
  throw new Error("No fue posible persistir la auditoría espejo.");
}

Deno.serve(async (req: Request) => {
  if (!isAllowedOrigin(req)) return json(req,{error:"Origen no autorizado"},403);
  if (req.method === "OPTIONS") return new Response(null,{status:204,headers:corsHeaders(req)});
  if (req.method !== "POST") return json(req,{error:"Método no permitido"},405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const clientKey = Deno.env.get("SUPABASE_ANON_KEY") || serviceKey;
  if (!supabaseUrl || !serviceKey) return json(req,{error:"Configuración del servidor incompleta"},500);

  const token = clean(req.headers.get("Authorization")).replace(/^Bearer\s+/i,"");
  if (!token) return json(req,{error:"Sesión requerida"},401);
  const admin = createClient(supabaseUrl,serviceKey,{auth:{autoRefreshToken:false,persistSession:false}});
  const userClient = createClient(supabaseUrl,clientKey,{
    global:{headers:{Authorization:`Bearer ${token}`}},
    auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false}
  });
  const { data:userData,error:userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) return json(req,{error:"Sesión inválida o vencida"},401);

  let body: any = {};
  try { body = await req.json(); } catch { return json(req,{error:"JSON inválido"},400); }
  const receiptId = clean(body?.receiptId);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(receiptId)) return json(req,{error:"receiptId inválido"},400);

  const {data:authorized,error:authzError}=await userClient.rpc("erp_x_auditoria_erp_authorize",{p_receipt_id:receiptId});
  if(authzError||authorized!==true)return json(req,{error:"No autorizado para sincronizar esta recepción"},403);

  let eventKey = `CRM_WAREHOUSE_RECEIPT:${receiptId}`;
  try {
    const { data:source,error:payloadError } = await admin.rpc("erp_x_auditoria_erp_payload",{p_receipt_id:receiptId});
    if (payloadError) throw payloadError;
    if (!source) return json(req,{success:true,skipped:true,reason:"Recepción no encontrada"},200);
    eventKey = clean(source.eventKey) || eventKey;
    const hasNovelty = Boolean(clean(source.noveltyType) || clean(source.noveltyNote) || ["PARTIAL","NONCONFORMING"].includes(clean(source.status).toUpperCase()));
    if (!hasNovelty) return json(req,{success:true,skipped:true,reason:"Recepción sin novedad"},200);

    const {data:claimed,error:claimError}=await admin.rpc("erp_x_auditoria_erp_mark",{p_event_key:eventKey,p_status:"SYNCING",p_error:null,p_target_audit_id:null});
    if(claimError)throw claimError;
    if(claimed!==true)return json(req,{success:true,skipped:true,reason:"Sincronización ya procesada o en curso"},200);

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
