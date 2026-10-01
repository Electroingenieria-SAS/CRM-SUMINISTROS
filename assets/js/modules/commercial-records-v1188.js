import { enhanceCommercialRecords } from "../domains/orders/commercial/record-experience.js";

function install(){
  const root=document.querySelector("#page-content");
  if(!root)return;
  enhanceCommercialRecords(root);
}

if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install,{once:true});else install();
