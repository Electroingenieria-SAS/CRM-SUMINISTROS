import { fmt } from "../../../core/format.js";

export function activeTask(data){return (data.tasks||[]).find(task=>["QUEUED","ASSIGNED","IN_PROGRESS","WAITING","BLOCKED"].includes(task.status))||null}

export function actionCodes(data){return new Set((data.actions?.actions||[]).map(action=>action.code))}

export function currentAssignee(data){const task=activeTask(data);if(["CLOSED","CANCELLED"].includes(String(data.order?.status||"").toUpperCase()))return "—";return data.order?.currentResponsibleName||task?.assignedName||task?.assigned_name||(task?.assigned_profile_id?fmt.role(task.assigned_role_code||data.order.current_role_code):"En cola")}

export function recommendedAction(data,requirement){
  const actions=actionCodes(data),task=activeTask(data);
  if(!task)return {title:"Pedido sin tarea activa",detail:"Consulta a la jefatura logística para revisar el flujo.",tone:"warning"};
  if(actions.has("CLAIM")||actions.has("START"))return {title:"Iniciar la gestión",detail:"Toma el pedido y comienza a trabajar. No debes llenar ningún formulario para iniciar.",button:"WORKING",buttonLabel:"Iniciar gestión",tone:"primary"};
  if(actions.has("RESUME"))return {title:"Retomar la gestión",detail:"El pedido estaba en espera. Retómalo para continuar donde quedó.",button:"WORKING",buttonLabel:"Retomar",tone:"primary"};
  if(task.status==="IN_PROGRESS"&&requirement)return {title:requirement.title,detail:requirement.detail,button:"RESOLVE",buttonLabel:requirement.buttonLabel,tone:"warning"};
  if(actions.has("COMPLETE"))return {title:"La etapa puede finalizar",detail:"Si ya terminaste el trabajo, marca el pedido como gestionado.",button:"DONE",buttonLabel:"Marcar gestionado",tone:"success"};
  return {title:"Pedido actualizado",detail:"No hay una acción pendiente para tu rol en este momento.",tone:"neutral"};
}

export function stageRequirement(data){
  const order=data.order,step=order.current_step_code;
  const task=activeTask(data);
  const required=(data.checklist||[]).filter(item=>item.task_id===task?.id&&item.required&&!item.completed);
  const hasApproved=(data.financialValidations||[]).some(row=>row.validation_type===step&&row.decision==="APPROVED");
  const validPo=(data.purchaseOrders||[]).some(row=>["ISSUED","CONFIRMED","PARTIAL","RECEIVED"].includes(row.status));
  const validReceipt=(data.receipts||[]).some(row=>["CONFORMING","CLOSED"].includes(row.status));
  const validInvoice=(data.invoices||[]).some(row=>row.status==="REGISTERED");
  const delivered=(data.deliveries||[]).some(row=>row.status==="DELIVERED");
  const domain=(data.actions?.domainActions||[]).map(item=>item.code);
  if(["CARTERA","CAJA"].includes(step)&&!hasApproved&&domain.includes("FINANCIAL"))return {code:"FINANCIAL",title:`Resolver validación de ${fmt.step(step)}`,detail:"Registra la decisión. Si queda aprobada, el ERP finalizará la etapa.",buttonLabel:"Resolver validación"};
  if(step==="COMPRAS"&&!validPo&&domain.includes("PURCHASE"))return {code:"PURCHASE",title:"Registrar la orden de compra",detail:"Solo se solicitará número de orden, proveedor y estado.",buttonLabel:"Registrar orden"};
  if(step==="RECEPCION_MERCANCIA"&&!validReceipt&&domain.includes("RECEIPT"))return {code:"RECEIPT",title:"Confirmar la mercancía recibida",detail:"Verifica cantidades, ubicación y resultado de calidad.",buttonLabel:"Registrar recepción"};
  if(step==="FACTURACION"&&!validInvoice&&domain.includes("INVOICE"))return {code:"INVOICE",title:"Registrar la factura",detail:"Ingresa número, fecha y valor. El pedido continuará automáticamente.",buttonLabel:"Registrar factura"};
  if(["CLIENT_POINT","CLIENT_PICKUP","LOCAL_DISPATCH","NATIONAL_DISPATCH"].includes(step)&&!delivered&&domain.includes("DELIVERY"))return {code:"DELIVERY",title:"Confirmar el despacho o la entrega",detail:"Marca si fue entregado o si debe reprogramarse.",buttonLabel:"Registrar resultado"};
  if(step==="CLOSURE"&&(!validInvoice||!delivered))return {code:"EXTERNAL",title:"Faltan soportes previos",detail:`${!validInvoice?"No hay factura registrada. ":""}${!delivered?"No hay entrega confirmada.":""}`.trim(),buttonLabel:"Revisar"};
  if(required.length)return {code:"CHECKLIST",title:"Confirmar controles de la etapa",detail:`Quedan ${required.length} verificación(es) obligatoria(s). Confírmalas en una sola ventana.`,buttonLabel:"Confirmar controles"};
  return null;
}
