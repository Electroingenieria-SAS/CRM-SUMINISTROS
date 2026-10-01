import { api } from "../../../services/api.js";
import { fmt } from "../../../core/format.js";
import { modal, toast } from "../../../core/ui.js";
import { uploadOrderFile } from "../../../services/drive.js";
import { openOrder } from "./order-detail.js";
import { activeTask } from "./order-stage.js";
import { dialogData } from "../shared/form-values.js";
import { refreshLists } from "../shared/refresh-orders.js";
import { printStickers } from "./print-stickers.js";

export function runSecondary(data,code){
  if(code==="COMMENT")return quickComment(data);
  if(code==="ASSIGN")return quickAssign(data);
  if(code==="REQUEST_APPROVAL")return quickApproval(data);
  if(code==="FILE")return quickFile(data);
  if(code==="STICKERS")return printStickers(data.order.id);
}

export function quickComment(data){modal({title:"Agregar nota",confirmLabel:"Guardar nota",body:`<div class="field"><label>Nota *</label><textarea class="control" name="body" required autofocus placeholder="Escribe una observación breve"></textarea></div>`,onConfirm:async dialog=>{const body=dialog.querySelector('[name="body"]').value.trim();await api.executeAction(data.order.id,"COMMENT",{body,commentType:"COMMENT",visibility:"INTERNAL"},data.order.version);toast("Nota guardada.","success");refreshLists()}})}

export async function quickAssign(data){const pool=await api.assignmentPool(data.order.current_step_code);if(!pool.length)return toast("No hay responsables habilitados.","error");modal({title:"Asignar responsable",confirmLabel:"Asignar",body:`<div class="field"><label>Responsable *</label><select class="control" name="profileId" required>${pool.map(person=>`<option value="${person.id}">${fmt.escape(person.name)} · ${fmt.escape((person.roles||[]).map(role=>fmt.role(role)).join(" / "))}</option>`).join("")}</select></div>`,onConfirm:async dialog=>{const id=dialog.querySelector('[name="profileId"]').value;await api.executeAction(data.order.id,"ASSIGN",{profileId:id},data.order.version);toast("Responsable asignado.","success");refreshLists();setTimeout(()=>openOrder(data.order.id),100)}})}

export function quickApproval(data){modal({title:"Solicitar aprobación",confirmLabel:"Enviar solicitud",body:`<div class="field"><label>Tipo *</label><select class="control" name="requestType"><option value="PRIORITY">Cambio de prioridad</option><option value="ROUTE_CHANGE">Cambio de ruta</option><option value="STOCK_EXCEPTION">Excepción de inventario</option><option value="FLOW_EXCEPTION">Excepción del flujo</option><option value="PAYMENT_EXCEPTION">Excepción financiera</option><option value="DATA_CORRECTION">Corrección de datos</option></select></div><div class="field"><label>Motivo *</label><textarea class="control" name="reason" required></textarea></div>`,onConfirm:async dialog=>{const f=dialogData(dialog);const payload={requestType:f.requestType,reason:f.reason};if(f.requestType==="PRIORITY")payload.priority="HIGH";if(f.requestType==="ROUTE_CHANGE")payload.route=data.order.delivery_route_code;await api.executeAction(data.order.id,"REQUEST_APPROVAL",payload,data.order.version);toast("Solicitud enviada.","success");refreshLists()}})}

export function quickFile(data){modal({title:"Adjuntar soporte",confirmLabel:"Subir archivo",body:`<div class="field"><label>Tipo de documento</label><select class="control" name="category"><option value="EVIDENCE">Evidencia</option><option value="PAYMENT">Soporte de pago</option><option value="PURCHASE_ORDER">Orden de compra</option><option value="INVOICE">Factura</option><option value="DELIVERY">Entrega</option><option value="QUALITY">Calidad</option></select></div><div class="field"><label>Archivo *</label><input class="control" name="file" type="file" required></div>`,onConfirm:async dialog=>{const file=dialog.querySelector('[name="file"]').files[0];const category=dialog.querySelector('[name="category"]').value;await uploadOrderFile(data.order.id,file,category,activeTask(data)?.id,data.order.order_number);toast("Archivo cargado.","success")}})}
