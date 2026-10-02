import { renderReleaseManagement } from "./ui/release-management.js";
import { renderLogisticsBilling } from "../billing/ui/logistics-billing.js";
import { renderCashInvoice } from "../billing/ui/cash-invoice.js";

export const RELEASE_STEPS=new Set(["CARTERA","CAJA"]);

export const BILLING_STEPS=new Set(["FACTURACION","CAJA_FACTURACION"]);

export function isFinancialFlowStep(data){
  const step=data?.order?.current_step_code;
  return RELEASE_STEPS.has(step)||BILLING_STEPS.has(step);
}

export function renderFinancialFlow(host,data,{reload,refreshLists}){
  if(data.order.current_step_code==="CAJA_FACTURACION")return renderCashInvoice(host,data,{reload,refreshLists});
  if(data.order.current_step_code==="FACTURACION")return renderLogisticsBilling(host,data,{reload,refreshLists});
  return renderReleaseManagement(host,data,{reload,refreshLists});
}
