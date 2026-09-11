import { createClient } from "npm:@supabase/supabase-js@2.111.0";

const allowedOrigins = new Set([
  "https://crm-suministros-amber.vercel.app",
  "https://crm-suministros-jeptacs-projects.vercel.app",
  "https://crm-suministros-git-main-jeptacs-projects.vercel.app",
  "http://127.0.0.1:4173",
  "http://localhost:4173"
]);

const clean = (value: unknown) => String(value ?? "").trim();
const number = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
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

let targetConfigPromise: Promise<{url:string;key:string}> | null = null;
async function getTargetConfig(admin: any) {
  const envUrl = clean(Deno.env.get("AUDITORIA_ERP_URL"));
  const envKey = clean(Deno.env.get("AUDITORIA_ERP_ANON_KEY"));
  if (envUrl && envKey) return { url: envUrl.replace(/\/$/, ""), key: envKey };
  if (targetConfigPromise) return targetConfigPromise;
  targetConfigPromise = (async () => {
    const { data, error } = await admin.rpc("erp_x_auditoria_erp_target_config");
    if (error) throw new Error(`No fue posible leer la configuración privada de AuditoriaERP: ${error.message}`);
    const url = clean(data?.url).replace(/\/$/, "");
    const key = clean(data?.key);
    if (!/^https:\/\/[a-z0-9.-]+\.supabase\.co$/i.test(url) || !key) throw new Error("La configuración privada de AuditoriaERP está incompleta.");
    return { url, key };
  })().catch(error => { targetConfigPromise = null; throw error; });
  return targetConfigPromise;
}

const noveltyLabels: Record<string,string> = {
  SHORTAGE: "Faltante",
  EXCESS: "Sobrante",
  DAMAGED: "Dañado",
  WRONG_ITEM: "Material incorrecto",
  DOCUMENT: "Documento / factura",
  QUALITY: "Calidad",
  OTHER: "Otra"
};
const severityLabels: Record<string,string> = {
  LOW: "Baja",
  MEDIUM: "Media",
  HIGH: "Alta",
  CRITICAL: "Crítica"
};

function inferPackaging(lines: any[]) {
  const text = lines.map(line => `${clean(line?.unit)} ${clean(line?.description)}`).join(" ").toUpperCase();
  if (/CARRETE|CARRETO/.test(text)) return "Carretos";
  if (/ROLLO/.test(text)) return "Rollos";
  if (/\bM\b|METRO/.test(text)) return "Cable Metro";
  if (/CAJA/.test(text)) return "Cajas";
  return "Unidades";
}

function materialSummary(lines: any[]) {
  const items = lines.map(line => {
    const reference = clean(line?.reference);
    const description = clean(line?.description);
    return [reference, description].filter(Boolean).join(" · ");
  }).filter(Boolean);
  if (!items.length) return "Material registrado en CRM Suministros";
  if (items.length <= 3) return items.join(" | ");
  return `${items.slice(0, 3).join(" | ")} · +${items.length - 3} referencia(s)`;
}

function receptionPayload(source: any) {
  const noveltyType = clean(source.noveltyType).toUpperCase();
  const severity = clean(source.noveltySeverity).toUpperCase();
  const noveltyLabel = noveltyLabels[noveltyType] || clean(source.noveltyType) || "Novedad de recepción";
  const severityLabel = severityLabels[severity] || clean(source.noveltySeverity) || "Sin clasificar";
  const lines = Array.isArray(source.lines) ? source.lines : [];
  const totalReceived = number(source.totalReceived);
  const totalAccepted = number(source.totalAccepted);
  const totalRejected = number(source.totalRejected);
  const discrepancyQty = Math.max(totalRejected, 1);
  const eventKey = clean(source.eventKey);
  const receiptNumber = clean(source.receiptNumber);
  const receivedBy = clean(source.receivedBy) || "Recepción CRM";
  const receivedAt = clean(source.receivedAt) || new Date().toISOString();
  const timestamp = new Date(receivedAt).toLocaleString("es-CO", { timeZone: "America/Bogota" });

  const observation = [
    `Recepción CRM: ${receiptNumber}`,
    `Novedad: ${noveltyLabel} · Severidad: ${severityLabel}`,
    clean(source.noveltyNote),
    clean(source.purchaseOrderNumber) ? `Orden de compra: ${clean(source.purchaseOrderNumber)}` : "",
    clean(source.invoiceNumber) ? `Factura: ${clean(source.invoiceNumber)}` : "",
    clean(source.warehouseCode) ? `Bodega: ${clean(source.warehouseCode)}` : "",
    `Cantidades CRM — recibida: ${totalReceived}; aceptada: ${totalAccepted}; rechazada: ${totalRejected}`,
    clean(source.informationCaptured) ? `Información levantada: ${clean(source.informationCaptured)}` : "",
    clean(source.verificationNote) ? `Verificación: ${clean(source.verificationNote)}` : "",
    clean(source.generalNote) ? `Observación general: ${clean(source.generalNote)}` : "",
    `[CRM_SYNC:${eventKey}]`
  ].filter(Boolean).join("\n");

  const seguimiento = [
    "",
    "━━━━━━━━━━━━━━━━━━",
    `📅 ${timestamp}`,
    "👤 Integración CRM Suministros",
    "🏷️ Estado: Pendiente",
    `📝 Recepción ${receiptNumber} sincronizada automáticamente. Novedad: ${noveltyLabel} (${severityLabel}).`,
    `[CRM_SYNC:${eventKey}]`,
    ""
  ].join("\n");

  const create = {
    proveedor: clean(source.supplierName) || clean(source.supplierDocument) || "Proveedor no informado",
    material: materialSummary(lines),
    tipo_recepcion: inferPackaging(lines),
    unidad_medida: clean(lines[0]?.unit) || null,
    cantidad: Math.max(totalReceived, 1),
    revisadas: totalReceived,
    novedades: discrepancyQty,
    faltantes: noveltyType === "SHORTAGE" ? discrepancyQty : 0,
    porcentaje_revisado: totalReceived > 0 ? 100 : 0,
    observacion: observation,
    comentario_validacion: "",
    seguimiento,
    estado: "Pendiente",
    novedad_original: noveltyLabel,
    pdf_url: "[]",
    usuario_recepcion: `CRM · ${receivedBy}`,
    created_at: receivedAt
  };

  const update = {
    proveedor: create.proveedor,
    material: create.material,
    tipo_recepcion: create.tipo_recepcion,
    unidad_medida: create.unidad_medida,
    cantidad: create.cantidad,
    revisadas: create.revisadas,
    novedades: create.novedades,
    faltantes: create.faltantes,
    porcentaje_revisado: create.porcentaje_revisado,
    observacion: create.observacion,
    novedad_original: create.novedad_original
  };

  return { create, update, eventKey, receiptNumber };
}

async function targetRequest(admin: any, path: string, init: RequestInit = {}) {
  const config = await getTargetConfig(admin);
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

async function findExistingReception(admin: any, eventKey: string) {
  const marker = `[CRM_SYNC:${eventKey}]`;
  const params = new URLSearchParams({
    select: "id,estado,seguimiento,observacion,novedad_original",
    observacion: `like.*${marker}*`,
    limit: "1"
  });
  const { response, body, text } = await targetRequest(admin, `recepciones?${params.toString()}`, { method: "GET" });
  if (!response.ok) throw new Error(`AuditoriaERP no permitió consultar Recepción (${response.status}): ${text.slice(0, 400)}`);
  return Array.isArray(body) && body.length ? body[0] : null;
}

async function persistReception(admin: any, existing: any, mapped: ReturnType<typeof receptionPayload>) {
  if (existing?.id) {
    const { response, body, text } = await targetRequest(admin, `recepciones?id=eq.${encodeURIComponent(existing.id)}`, {
      method: "PATCH",
      headers: { "Prefer": "return=representation" },
      body: JSON.stringify(mapped.update)
    });
    if (!response.ok) throw new Error(`AuditoriaERP rechazó la actualización de Recepción (${response.status}): ${text.slice(0, 500)}`);
    const row = Array.isArray(body) ? body[0] : body;
    return row || existing;
  }

  const { response, body, text } = await targetRequest(admin, "recepciones", {
    method: "POST",
    headers: { "Prefer": "return=representation" },
    body: JSON.stringify(mapped.create)
  });
  if (!response.ok) throw new Error(`AuditoriaERP rechazó la creación en Recepción (${response.status}): ${text.slice(0, 500)}`);
  const row = Array.isArray(body) ? body[0] : body;
  return row || {};
}

async function mark(admin: any, eventKey: string, status: "SYNCED" | "FAILED", error: string | null, targetReceptionId: string | null) {
  const { error: markError } = await admin.rpc("erp_x_auditoria_erp_mark_reception", {
    p_event_key: eventKey,
    p_status: status,
    p_error: error,
    p_target_reception_id: targetReceptionId
  });
  if (markError) throw new Error(`No fue posible actualizar la outbox: ${markError.message}`);
}

async function handle(req: Request) {
  if (!isAllowedOrigin(req)) return json(req, { error: "Origen no autorizado" }, 403);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "Método no permitido" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const clientKey = Deno.env.get("SUPABASE_ANON_KEY") || serviceKey;
  if (!supabaseUrl || !serviceKey) return json(req, { error: "Configuración del servidor incompleta" }, 500);

  const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  let body: any = {};
  try { body = await req.json(); } catch { return json(req, { error: "JSON inválido" }, 400); }

  const databaseDispatch = body?.source === "database";
  let receiptId = clean(body?.receiptId);
  let eventKey = clean(body?.eventKey) || `CRM_WAREHOUSE_RECEIPT:${receiptId}`;

  try {
    if (databaseDispatch) {
      const deliveryToken = clean(body?.deliveryToken);
      if (!eventKey.startsWith("CRM_WAREHOUSE_RECEIPT:") || !UUID_RE.test(deliveryToken)) return json(req, { error: "Evento server-to-server inválido" }, 400);
      const { data: claim, error: claimError } = await admin.rpc("erp_x_auditoria_erp_claim_webhook_v2", {
        p_event_key: eventKey,
        p_delivery_token: deliveryToken
      });
      if (claimError) throw new Error(`Claim webhook: ${claimError.message}`);
      if (claim?.claimed !== true) return json(req, { success: true, skipped: true, reason: "Evento expirado, procesado o ya reclamado" }, 202);
      receiptId = clean(claim?.receiptId);
      if (!UUID_RE.test(receiptId)) throw new Error("Claim webhook sin receiptId válido");
    } else {
      if (!UUID_RE.test(receiptId)) return json(req, { error: "receiptId inválido" }, 400);
      const token = clean(req.headers.get("Authorization")).replace(/^Bearer\s+/i, "");
      if (!token) return json(req, { error: "Sesión requerida" }, 401);
      const { data: userData, error: userError } = await admin.auth.getUser(token);
      if (userError || !userData.user) return json(req, { error: "Sesión inválida o vencida" }, 401);
      const userClient = createClient(supabaseUrl, clientKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
      });
      const { data: authorized, error: authzError } = await userClient.rpc("erp_x_auditoria_erp_authorize", { p_receipt_id: receiptId });
      if (authzError || authorized !== true) return json(req, { error: "No autorizado para sincronizar esta recepción" }, 403);
      const { data: claimed, error: claimError } = await admin.rpc("erp_x_auditoria_erp_claim_receipt", { p_receipt_id: receiptId });
      if (claimError) throw new Error(`Claim recepción: ${claimError.message}`);
      if (claimed !== true) return json(req, { success: true, skipped: true, reason: "Evento procesado o ya reclamado" }, 202);
    }

    const { data: source, error: payloadError } = await admin.rpc("erp_x_auditoria_erp_payload", { p_receipt_id: receiptId });
    if (payloadError) throw payloadError;
    if (!source) {
      await mark(admin, eventKey, "SYNCED", null, null);
      return json(req, { success: true, skipped: true, reason: "Recepción CRM no encontrada" }, 200);
    }

    eventKey = clean(source.eventKey) || eventKey;
    const hasNovelty = Boolean(
      clean(source.noveltyType) || clean(source.noveltyNote) || ["PARTIAL", "NONCONFORMING"].includes(clean(source.status).toUpperCase())
    );
    if (!hasNovelty) {
      await mark(admin, eventKey, "SYNCED", null, null);
      return json(req, { success: true, skipped: true, reason: "Recepción sin novedad" }, 200);
    }

    const mapped = receptionPayload(source);
    const existing = await findExistingReception(admin, mapped.eventKey);
    const saved = await persistReception(admin, existing, mapped);
    const targetReceptionId = clean(saved?.id || existing?.id) || null;
    await mark(admin, eventKey, "SYNCED", null, targetReceptionId);

    return json(req, {
      success: true,
      synced: true,
      target: "recepciones",
      idempotent: Boolean(existing),
      targetReceptionId,
      receiptNumber: source.receiptNumber
    });
  } catch (error: any) {
    const message = clean(error?.message || error) || "Error de sincronización";
    if (eventKey) {
      await admin.rpc("erp_x_auditoria_erp_mark_reception", {
        p_event_key: eventKey,
        p_status: "FAILED",
        p_error: message,
        p_target_reception_id: null
      }).catch(() => undefined);
    }
    console.error("[AUDITORIA ERP RECEPCION BRIDGE]", message);
    return json(req, { success: false, error: "La recepción quedó guardada en CRM, pero su novedad está pendiente de sincronización con Recepción." }, 502);
  }
}

Deno.serve(async (req: Request) => {
  try { return await handle(req); }
  catch (error: any) {
    console.error("[AUDITORIA ERP RECEPCION BRIDGE RUNTIME]", error?.message || error);
    return json(req, { error: "Fallo interno del puente de Recepción" }, 500);
  }
});
