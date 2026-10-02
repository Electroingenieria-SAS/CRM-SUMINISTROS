import { modal, toast } from "../../../core/ui.js";
import { refresh } from "../shared/flow-callbacks.js";
import { applyState } from "../actions/apply-financial-status.js";

export function openStateDialog(data,{reload,refreshLists}){
  const cashStep=String(data?.order?.current_step_code||"").toUpperCase()==="CAJA";
  modal({
    title:"Actualizar estado",
    confirmLabel:"Guardar estado",
    size:"wide",
    body:`<div class="financial-status-choices">
      ${stateChoice("IN_PROGRESS","En gestión","La revisión continúa activa.",true)}
      ${stateChoice("WAITING","En espera","Falta información o una respuesta.")}
      ${stateChoice("NOVELTY","Con novedad","Existe una situación que impide continuar.")}
      ${stateChoice("CLOSED","Cerrado","La gestión terminó y el pedido puede liberarse.")}
    </div>
    ${cashStep?`<section class="financial-payment-confirmation">
      <div class="wizard-confirm-box"><strong>Confirmación de pago</strong><p>Estos datos solo son obligatorios cuando selecciones “Cerrado”. Alimentan el ranking real del cliente y no sustituyen la factura.</p></div>
      <div class="form-grid">
        <div class="field"><label>Valor pagado confirmado *</label><input class="control" name="paymentAmount" type="number" min="0.01" step="0.01" inputmode="decimal" placeholder="Ejemplo: 1250000"></div>
        <div class="field"><label>Referencia o comprobante *</label><input class="control" name="paymentReference" autocomplete="off" placeholder="Número de comprobante, recibo o referencia"></div>
      </div>
    </section>`:""}
    <div class="field"><label>Observación</label><textarea class="control" name="notes" placeholder="Describe brevemente la actualización"></textarea></div>`,
    onConfirm:async dialog=>{
      const state=dialog.querySelector('[name="financialState"]:checked')?.value;
      const notes=dialog.querySelector('[name="notes"]').value.trim();
      if(!state)throw new Error("Selecciona un estado.");
      if(["WAITING","NOVELTY"].includes(state)&&!notes)throw new Error("Escribe el motivo de la espera o novedad.");
      let payment=null;
      if(cashStep&&state==="CLOSED"){
        const amount=Number(dialog.querySelector('[name="paymentAmount"]')?.value||0);
        const reference=dialog.querySelector('[name="paymentReference"]')?.value.trim()||"";
        if(!(amount>0))throw new Error("Registra el valor pagado confirmado antes de cerrar Caja.");
        if(!reference)throw new Error("Registra la referencia o comprobante del pago.");
        payment={amount,reference};
      }
      await applyState(data,state,notes,payment);
      toast(state==="CLOSED"?(cashStep?"Pago confirmado y gestión cerrada. Ya puedes liberar el pedido.":"Gestión cerrada. Ya puedes liberar el pedido."):"Estado actualizado.","success");
      refresh(refreshLists);setTimeout(()=>reload(),80);
    }
  });
}

export function stateChoice(value,title,detail,checked=false){
  return `<label class="financial-state-choice"><input type="radio" name="financialState" value="${value}" ${checked?"checked":""}><span><strong>${title}</strong><small>${detail}</small></span></label>`;
}
