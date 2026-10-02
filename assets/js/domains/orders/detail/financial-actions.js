import { api } from "../../../services/api.js";
import { fmt } from "../../../core/format.js";
import { modal, toast } from "../../../core/ui.js";
import { choice } from "../../../core/guided.js";
import { openOrder } from "./order-detail.js";
import { actionCodes } from "./order-stage.js";
import { checklistConfirmation, finalizeAfterDomain } from "./checklist.js";
import { dialogData } from "../shared/form-values.js";
import { refreshLists } from "../shared/refresh-orders.js";

export function quickFinancial(data){
  const step=data.order.current_step_code;
  modal({title:`Gestión de ${fmt.step(step)}`,confirmLabel:"Guardar resultado",size:"wide",body:`<div class="simple-choice-row">${choice("decision","APPROVED","Aprobado","Puede continuar al siguiente proceso.",true)}${choice("decision","PENDING","Pendiente","Falta información o confirmación.")}${choice("decision","REJECTED","Con novedad","No puede continuar hasta resolverla.")}</div><div class="form-grid"><div class="field"><label>Referencia o comprobante</label><input class="control" name="reference"></div><div class="field"><label>Valor</label><input class="control" name="amount" type="number" step="any"></div><div class="field full"><label>Observación *</label><textarea class="control" name="notes" required placeholder="Ejemplo: cupo aprobado, pago confirmado o documento pendiente"></textarea></div></div>${checklistConfirmation(data)}`,onConfirm:async dialog=>{
    const form=dialogData(dialog);const payload={validationType:step,decision:form.decision,reference:form.reference,notes:form.notes};if(form.amount)payload.amount=form.amount;
    await api.saveFinancialValidation(data.order.id,payload);
    if(form.decision==="APPROVED")return finalizeAfterDomain(data.order.id,`${fmt.step(step)} gestionada`);
    const latest=await api.getOrder(data.order.id);
    if(form.decision==="PENDING"&&actionCodes(latest).has("WAIT"))await api.executeAction(data.order.id,"WAIT",{reason:form.notes},latest.order.version);
    if(form.decision==="REJECTED"){
      let current=latest;if(actionCodes(current).has("COMMENT")){await api.executeAction(data.order.id,"COMMENT",{body:form.notes,commentType:"NOVELTY",visibility:"INTERNAL"},current.order.version);current=await api.getOrder(data.order.id)}
      if(actionCodes(current).has("WAIT"))await api.executeAction(data.order.id,"WAIT",{reason:form.notes},current.order.version);
    }
    toast("Resultado guardado. El pedido queda visible para continuar después.","success");refreshLists();setTimeout(()=>openOrder(data.order.id),100);
  }});
}

export function quickPurchase(data){
  modal({title:"Registrar orden de compra",confirmLabel:"Guardar y continuar",body:`<div class="form-grid"><div class="field"><label>Número de orden *</label><input class="control" name="poNumber" required autofocus></div><div class="field"><label>Proveedor *</label><input class="control" name="supplierName" required></div><div class="field"><label>Estado *</label><select class="control" name="status"><option value="ISSUED">Emitida</option><option value="CONFIRMED" selected>Confirmada</option><option value="PARTIAL">Recepción parcial</option></select></div><div class="field"><label>Fecha esperada</label><input class="control" name="expectedAt" type="datetime-local"></div><div class="field"><label>Valor total</label><input class="control" name="totalAmount" type="number" step="any"></div></div>${checklistConfirmation(data)}`,onConfirm:async dialog=>{const f=dialogData(dialog);const payload={poNumber:f.poNumber,supplierName:f.supplierName,status:f.status,currency:"COP"};if(f.expectedAt)payload.expectedAt=new Date(f.expectedAt).toISOString();if(f.totalAmount)payload.totalAmount=f.totalAmount;await api.savePurchaseOrder(data.order.id,payload);await finalizeAfterDomain(data.order.id,"Compra gestionada y pedido liberado")}});
}

export function quickInvoice(data){
  modal({title:"Registrar factura",confirmLabel:"Guardar factura y continuar",body:`<div class="form-grid"><div class="field"><label>Número de factura *</label><input class="control" name="invoiceNumber" required autofocus></div><div class="field"><label>Fecha *</label><input class="control" name="invoiceDate" type="date" value="${new Date().toISOString().slice(0,10)}" required></div><div class="field"><label>Valor</label><input class="control" name="amount" type="number" step="any"></div></div>${checklistConfirmation(data)}`,onConfirm:async dialog=>{const f=dialogData(dialog);const payload={invoiceNumber:f.invoiceNumber,invoiceDate:f.invoiceDate,currency:"COP"};if(f.amount)payload.amount=f.amount;await api.saveInvoice(data.order.id,payload);await finalizeAfterDomain(data.order.id,"Factura registrada y pedido liberado")}});
}
