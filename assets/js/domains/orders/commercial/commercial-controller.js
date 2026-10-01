import { enhanceOrders } from "./order-experience.js";
import { refreshOrderResultMeta } from "./order-search.js";
import { enhanceCredit, refreshCreditResultMeta } from "../../finance/credit/credit-experience.js";
import { enhanceCommercialWizards } from "./wizard-experience.js";

export function moduleHint(){
  const hash=String(location.hash||"").toLowerCase();
  if(hash.includes("credit"))return "credit";
  if(hash.includes("sales"))return "sales";
  if(hash.includes("orders"))return "orders";
  return "";
}

export function enhanceCommercialExperience(){
  const root=document.querySelector("#page-content");
  if(!root)return;
  const isOrders=Boolean(root.querySelector("#orders-result"));
  const isCredit=Boolean(root.querySelector("#credit-result"));
  root.classList.toggle("commercial-v1187",isOrders||isCredit);
  root.classList.remove("commercial-orders-v1187","commercial-sales-v1187","commercial-credit-v1187");

  if(isOrders){
    const mode=moduleHint()==="sales"||root.querySelector(".page-head h2")?.textContent?.includes("comercial")?"sales":"orders";
    root.classList.add(mode==="sales"?"commercial-sales-v1187":"commercial-orders-v1187");
    enhanceOrders(root,mode);
    refreshOrderResultMeta(root);
  }else if(isCredit){
    root.classList.add("commercial-credit-v1187");
    enhanceCredit(root);
    refreshCreditResultMeta(root);
  }
  enhanceCommercialWizards();
}
