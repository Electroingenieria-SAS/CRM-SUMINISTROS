import { fmt } from "../../../core/format.js";

export const ACTIVE_STATUSES=new Set(["QUEUED","ASSIGNED","IN_PROGRESS","WAITING","BLOCKED"]);

export const PRIORITY_WEIGHT={CRITICAL:1,URGENT:2,HIGH:3,MEDIUM:4,LOW:5};

export const STEP_MODULE={
  CARTERA:"cartera",CAJA:"caja",CAJA_FACTURACION:"caja",COMPRAS:"purchasing",
  RECEPCION_MERCANCIA:"receiving",RECEPCION_PEDIDO:"receiving",ALISTAMIENTO:"picking",
  CORTE:"cutting",FACTURACION:"billing",CLIENT_POINT:"shipping",CLIENT_PICKUP:"shipping",
  LOCAL_DISPATCH:"shipping",NATIONAL_DISPATCH:"shipping",CLOSURE:"shipping"
};

export function moduleForStep(step){return STEP_MODULE[String(step||"").toUpperCase()]||"orders"}

export function parallelWorkFooter(step){
  return `<footer class="modal-foot parallel-work-footer">
    <div class="parallel-work-note"><span aria-hidden="true">⇄</span><div><strong>Trabajo en paralelo habilitado</strong><small>Los pedidos tomados permanecen asignados. Puedes cerrar esta ventana y atender otro sin perder el avance.</small></div></div>
    <div class="parallel-work-actions"><button class="btn btn-ghost" data-close>Cerrar</button><button class="btn btn-primary" data-take-another="${fmt.escape(String(step||""))}">Cerrar y tomar otro</button></div>
  </footer>`;
}
