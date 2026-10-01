import { api } from "../../../services/api.js";
import { fmt } from "../../../core/format.js";
import { moneyCop, customerSegmentLabel, customerConfidenceLabel } from "../shared/order-formatters.js";

export function bindCustomerIntelligence(assistant){
const clientNameControl=assistant.root.querySelector('[name="clientName"]');
const clientDocumentControl=assistant.root.querySelector('[name="clientDocument"]');
let intelligenceTimer=null;
let intelligenceRequest=0;
const refreshCustomerIntelligence=async()=>{
    const clientName=clientNameControl?.value.trim()||"";
    const clientDocument=clientDocumentControl?.value.trim()||"";
    const card=assistant.root.querySelector("[data-customer-intelligence]");
    if(!card||(!clientName&&!clientDocument))return;
    const request=++intelligenceRequest;
    try{
      const data=await api.customerIntelligence(clientDocument||null,clientName||null);
      if(request!==intelligenceRequest)return;
      const segment=customerSegmentLabel(data?.segment);
      const status=data?.learningActive?segment:`${segment} · aprendiendo`;
      const orders=Number(data?.orderCount||0);
      const score=Number(data?.score||0);
      const rankingValue=moneyCop(data?.rankingValue??data?.paidAmount??0);
      const confirmedPaid=moneyCop(data?.paidAmount||0);
      const source=String(data?.valueSource||"NONE").toUpperCase();
      const valueDetail=source==="PAYMENT_AMOUNT"
        ? `${confirmedPaid} pagado confirmado`
        : source==="PAYMENT_WITH_INVOICE_FALLBACK"
          ? `${rankingValue} reconocido · ${confirmedPaid} con pago confirmado`
          : source==="INVOICE_AMOUNT_FALLBACK"
            ? `${rankingValue} respaldado provisionalmente por factura`
            : "sin valor económico confirmado todavía";
      card.dataset.segment=String(data?.segment||"NORMAL");
      card.querySelector("[data-customer-segment]").textContent=status;
      card.querySelector("[data-customer-intelligence-copy]").textContent=data?.learningActive
        ? `${orders} pedido${orders===1?"":"s"} · ${valueDetail} · puntaje ${fmt.number(score,1)}/100. La prioridad del pedido se asignará automáticamente.`
        : `${orders} pedido${orders===1?"":"s"} registrado${orders===1?"":"s"} · ${valueDetail}. El CRM mantiene condición Normal hasta reunir una muestra confiable.`;
      card.querySelector("[data-customer-confidence]").textContent=`Confianza: ${customerConfidenceLabel(data?.confidence)} · 50% frecuencia · 50% valor`;
      assistant.root.dataset.customerSegmentLabel=status;
    }catch(error){
      if(request!==intelligenceRequest)return;
      card.querySelector("[data-customer-segment]").textContent="Normal · aprendiendo";
      card.querySelector("[data-customer-intelligence-copy]").textContent="No fue posible consultar el ranking ahora. El pedido seguirá con prioridad automática neutral.";
      card.querySelector("[data-customer-confidence]").textContent="Aprendizaje disponible al crear";
      assistant.root.dataset.customerSegmentLabel="Normal · aprendiendo";
    }
  };
const scheduleCustomerIntelligence=()=>{
    clearTimeout(intelligenceTimer);
    intelligenceTimer=setTimeout(refreshCustomerIntelligence,350);
  };
clientNameControl?.addEventListener("input",scheduleCustomerIntelligence);
clientNameControl?.addEventListener("blur",refreshCustomerIntelligence);
clientDocumentControl?.addEventListener("input",scheduleCustomerIntelligence);
clientDocumentControl?.addEventListener("blur",refreshCustomerIntelligence);
refreshCustomerIntelligence();
}
