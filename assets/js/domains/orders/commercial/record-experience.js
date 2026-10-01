import { icon } from "../../../core/icons.js";

function ensureFigure(target,{figureClass,iconName}){
  if(!target||target.querySelector(".record-figure-v1188"))return;
  const figure=document.createElement("span");
  figure.className=`record-figure-v1188 ${figureClass}`;
  figure.setAttribute("aria-hidden","true");
  figure.innerHTML=icon(iconName,"record-icon-v1188");
  target.prepend(figure);
}

export function enhanceCommercialRecords(root){
  if(!root?.classList?.contains("commercial-v1187"))return;

  root.querySelectorAll(".commercial-action-card").forEach(card=>{
    card.classList.add("ops-action-card-v1188");
  });

  root.querySelectorAll("#orders-result .orders-master-row").forEach(row=>{
    row.classList.add("compact-record-v1188","compact-order-record-v1188");
    ensureFigure(row,{
      figureClass:"record-figure-order-v1188",
      iconName:"orders"
    });
  });

  root.querySelectorAll("#credit-result .credit-card").forEach(card=>{
    card.classList.add("compact-record-v1188","compact-credit-record-v1188");
    ensureFigure(card.querySelector("header"),{
      figureClass:"record-figure-credit-v1188",
      iconName:"credit"
    });
  });
}
