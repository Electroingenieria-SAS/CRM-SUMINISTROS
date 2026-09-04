from pathlib import Path


def must_replace(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"No se encontró contrato esperado: {label}")
    return text.replace(old, new, 1)


# Histórico: ocultar importación cuando el rol no puede crear y entregar plantilla real.
p = Path("assets/js/modules/imports.js")
s = p.read_text()
s = must_replace(s, 'import {workspaceIntro,summaryItem} from "../core/guided.js";', 'import {workspaceIntro,summaryItem} from "../core/guided.js";\nimport {can} from "../core/state.js";', "imports state helper")
s = must_replace(s, 'export async function renderImports(root){\n  root.innerHTML=`', 'export async function renderImports(root){\n  const canCreate=can("imports","canCreate");\n  root.innerHTML=`', "imports canCreate")
s = must_replace(s, 'cards:actionCards([{id:"start-import",title:"Importar archivo histórico",description:"Selecciona el CSV y revisa los registros antes de cargarlos.",icon:"⇩",tone:"accent"},{id:"download-template",title:"Descargar plantilla",description:"Obtén el formato oficial con encabezados en español.",icon:"▤",tone:"primary"},{id:"check-columns",title:"Revisar columnas",description:"Consulta qué información debe contener el archivo.",icon:"?",tone:"warning"}])', 'cards:actionCards([...(canCreate?[{id:"start-import",title:"Importar archivo histórico",description:"Selecciona el CSV y revisa los registros antes de cargarlos.",icon:"⇩",tone:"accent"}]:[]),{id:"download-template",title:"Descargar plantilla",description:"Obtén el formato oficial con encabezados en español.",icon:"▤",tone:"primary"},{id:"check-columns",title:"Revisar columnas",description:"Consulta qué información debe contener el archivo.",icon:"?",tone:"warning"}])', "imports cards")
s = must_replace(s, 'root.querySelector("#start-import").onclick=startWizard;', 'root.querySelector("#start-import")?.addEventListener("click",startWizard);', "imports handler")
p.write_text(s)

# Crédito: no mostrar Radicar a perfiles de solo lectura.
p = Path("assets/js/modules/credit.js")
s = p.read_text()
s = must_replace(s, 'import {workspaceIntro,summaryItem,choice} from "../core/guided.js";', 'import {workspaceIntro,summaryItem,choice} from "../core/guided.js";\nimport {can} from "../core/state.js";', "credit state helper")
s = must_replace(s, 'export async function renderCredit(root){\n  let status="";', 'export async function renderCredit(root){\n  let status="";\n  const canCreate=can("credit","canCreate");', "credit canCreate")
s = must_replace(s, 'cards:actionCards([{id:"new-credit",title:"Radicar nueva solicitud",description:"Registra cliente, valor y plazo en un asistente de tres pasos.",icon:"＋",tone:"accent"},{id:"submitted-credit",title:"Solicitudes radicadas",description:"Consulta solicitudes nuevas que deben ser tomadas por Cartera.",icon:"1",tone:"primary"},{id:"review-credit",title:"Solicitudes en estudio",description:"Revisa solicitudes asignadas y registra la decisión.",icon:"2",tone:"warning"},{id:"all-credit",title:"Historial de crédito",description:"Consulta solicitudes aprobadas, rechazadas y pendientes.",icon:"▦",tone:"success"}])', 'cards:actionCards([...(canCreate?[{id:"new-credit",title:"Radicar nueva solicitud",description:"Registra cliente, valor y plazo en un asistente de tres pasos.",icon:"＋",tone:"accent"}]:[]),{id:"submitted-credit",title:"Solicitudes radicadas",description:"Consulta solicitudes nuevas que deben ser tomadas por Cartera.",icon:"1",tone:"primary"},{id:"review-credit",title:"Solicitudes en estudio",description:"Revisa solicitudes asignadas y registra la decisión.",icon:"2",tone:"warning"},{id:"all-credit",title:"Historial de crédito",description:"Consulta solicitudes aprobadas, rechazadas y pendientes.",icon:"▦",tone:"success"}])', "credit cards")
s = must_replace(s, 'root.querySelector("#new-credit").onclick=()=>createWizard(load);', 'root.querySelector("#new-credit")?.addEventListener("click",()=>createWizard(load));', "credit handler")
p.write_text(s)

# Recepción: no ofrecer alta de mercancía a roles de solo lectura.
p = Path("assets/js/modules/receiving-hub-v115.js")
s = p.read_text()
s = must_replace(s, 'import {state} from "../core/state.js";', 'import {state,can} from "../core/state.js";', "receiving state helper")
s = must_replace(s, 'async function renderGoodsReceiving(host){\n  host.innerHTML=`', 'async function renderGoodsReceiving(host){\n  const canCreateGoods=can("receiving","canCreate")||can("receiving","canUpdate");\n  host.innerHTML=`', "receiving create capability")
s = must_replace(s, '<div class="v115-goods-actions"><button type="button" class="btn btn-create btn-large" data-v115-new-goods>+ Nueva recepción de mercancía</button><small>PVE opcional · inventario obligatorio</small></div>', '<div class="v115-goods-actions">${canCreateGoods?\'<button type="button" class="btn btn-create btn-large" data-v115-new-goods>+ Nueva recepción de mercancía</button>\':\'\'}<small>PVE opcional · inventario obligatorio</small></div>', "receiving create button")
s = must_replace(s, 'host.querySelector("[data-v115-new-goods]").addEventListener("click",openGoodsReceiptOrigin);', 'host.querySelector("[data-v115-new-goods]")?.addEventListener("click",openGoodsReceiptOrigin);', "receiving handler")
p.write_text(s)

# Navegación: si el hash apunta a un módulo no permitido, ir al primer módulo legible.
p = Path("assets/js/main.js")
s = p.read_text()
s = must_replace(s, 'const SESSION_PROFILE_ERROR=/usuario sin perfil operativo activo|perfil operativo activo|jwt expired|token.*expired/i;\n', 'const SESSION_PROFILE_ERROR=/usuario sin perfil operativo activo|perfil operativo activo|jwt expired|token.*expired/i;\n\nfunction moduleReadable(code){return Boolean(state.modules?.find(module=>module.code===code)?.canRead)}\nfunction firstReadableModule(){return state.modules?.find(module=>module.canRead)?.code||"dashboard"}\n', "router helpers")
old = '''      initRouter(async route=>{\n        if(route.segments[0]==="order"&&route.segments[1]){navigate("orders");setTimeout(()=>openOrder(route.segments[1]),0);return}\n        const moduleId=route.module;'''
new = '''      initRouter(async route=>{\n        const requestedModule=route.segments[0]==="order"?"orders":route.module;\n        if(!moduleReadable(requestedModule)){\n          const fallback=firstReadableModule();\n          if(fallback!==route.module){navigate(fallback);return}\n        }\n        if(route.segments[0]==="order"&&route.segments[1]){navigate("orders");setTimeout(()=>openOrder(route.segments[1]),0);return}\n        const moduleId=route.module;'''
s = must_replace(s, old, new, "router fallback")
p.write_text(s)

# Versión/caché.
p = Path("assets/js/config.js")
s = must_replace(p.read_text(), 'version: "11.8.0"', 'version: "11.8.1"', "config version")
s = must_replace(s, 'build: "2026-09-04.1"', 'build: "2026-09-04.2"', "config build")
p.write_text(s)
p = Path("index.html")
p.write_text(p.read_text().replace("v=11.8.0", "v=11.8.1"))
p = Path("service-worker.js")
s = must_replace(p.read_text(), 'crm-suministros-v11-8-0-20260904', 'crm-suministros-v11-8-1-20260904', "service worker cache")
s = must_replace(s, '"./","./index.html","./manifest.webmanifest",', '"./","./index.html","./manifest.webmanifest","./templates/historical_orders.csv",', "service worker template")
p.write_text(s)

Path("templates").mkdir(exist_ok=True)
Path("templates/historical_orders.csv").write_text(
    "pedido,referencia_externa,tipo_pedido,condicion_pago,ruta,prioridad,requiere_corte,requiere_compra,cliente,documento,ciudad,estado,fecha_creacion,fecha_actualizacion,fecha_cierre\n"
    "PED-0001,REF-001,PVC,CREDITO,DESPACHO LOCAL,MEDIA,no,no,Cliente ejemplo,900000000,Cali,CERRADO,2026-01-15,2026-01-16,2026-01-16\n"
)

migration = r'''-- CRM Suministros V11.8.1 · remediación de auditoría
-- NO_DELIVERY solo se ofrece a Ventas/Super Admin, prioridades canónicas y grants anon mínimos.

do $$
declare
  v_def text;
  v_old text;
  v_new text;
begin
  select pg_get_functiondef('public.erp_x_get_actions(uuid)'::regprocedure) into v_def;
  v_old := 'and erp_supply.actor_can(v_actor,v_order.current_step_code,''WAIT'',v_order.current_assignee_id) then v_actions:=v_actions||jsonb_build_array(jsonb_build_object(''code'',''NO_DELIVERY''';
  v_new := 'and (erp_supply.has_role(''ventas'') or erp_supply.has_role(''super_admin'')) and erp_supply.actor_can(v_actor,v_order.current_step_code,''WAIT'',v_order.current_assignee_id) then v_actions:=v_actions||jsonb_build_array(jsonb_build_object(''code'',''NO_DELIVERY''';
  if position(v_old in v_def)=0 then raise exception 'Contrato NO_DELIVERY inesperado; migración detenida'; end if;
  execute replace(v_def,v_old,v_new);

  select pg_get_functiondef('public.erp_x_session()'::regprocedure) into v_def;
  v_old := '''priorities'',jsonb_build_array(''LOW'',''MEDIUM'',''HIGH'',''URGENT'',''CRITICAL'')';
  v_new := '''priorities'',jsonb_build_array(''LOW'',''MEDIUM'',''URGENT'')';
  if position(v_old in v_def)=0 then raise exception 'Catálogo de prioridades inesperado; migración detenida'; end if;
  execute replace(v_def,v_old,v_new);
end $$;

revoke execute on function public.erp_x_goods_receipt_labels(text) from anon;
revoke execute on function public.erp_x_inventory_scan_resolve(text) from anon;
'''
Path("supabase/migrations/075_audit_contract_hardening_v11_8_1.sql").write_text(migration)
