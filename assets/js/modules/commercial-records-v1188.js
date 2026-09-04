import {icon} from "../core/icons.js";

let scheduled=false;
let observer=null;

function schedule(){
  if(scheduled)return;
  scheduled=true;
  requestAnimationFrame(()=>{
    scheduled=false;
    enhance();
  });
}

function enhance(){
  const root=document.querySelector("#page-content");
  if(!root?.classList.contains("commercial-v1187"))return;

  root.querySelectorAll(".commercial-action-card").forEach(card=>card.classList.add("ops-action-card-v1188"));

  root.querySelectorAll("#orders-result .orders-master-row").forEach(row=>{
    row.classList.add("compact-record-v1188","compact-order-record-v1188");
    if(!row.querySelector(".record-figure-v1188")){
      const figure=document.createElement("span");
      figure.className="record-figure-v1188 record-figure-order-v1188";
      figure.setAttribute("aria-hidden","true");
      figure.innerHTML=icon("orders","record-icon-v1188");
      row.prepend(figure);
    }
  });

  root.querySelectorAll("#credit-result .credit-card").forEach(card=>{
    card.classList.add("compact-record-v1188","compact-credit-record-v1188");
    const header=card.querySelector("header");
    if(header&&!header.querySelector(".record-figure-v1188")){
      const figure=document.createElement("span");
      figure.className="record-figure-v1188 record-figure-credit-v1188";
      figure.setAttribute("aria-hidden","true");
      figure.innerHTML=icon("credit","record-icon-v1188");
      header.prepend(figure);
    }
  });
}

function install(){
  const root=document.querySelector("#page-content");
  if(!root){setTimeout(install,80);return;}
  if(!observer){
    observer=new MutationObserver(schedule);
    observer.observe(root,{childList:true,subtree:true});
    window.addEventListener("hashchange",schedule);
  }
  schedule();
}

if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install,{once:true});else install();
