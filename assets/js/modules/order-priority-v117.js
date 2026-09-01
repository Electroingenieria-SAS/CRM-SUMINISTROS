const OPTIONS=[
  {value:"LOW",label:"Baja"},
  {value:"MEDIUM",label:"Media"},
  {value:"URGENT",label:"Urgente"}
];

let installed=false;
let timer=null;

export function installOrderPriorityV117(){
  if(installed)return;
  installed=true;
  const root=document.querySelector("#modal-root");
  if(!root)return;
  const observer=new MutationObserver(()=>schedule(root));
  observer.observe(root,{childList:true,subtree:true});
  schedule(root);
}

function schedule(root){
  clearTimeout(timer);
  timer=setTimeout(()=>enhance(root),20);
}

function enhance(root){
  root.querySelectorAll('select[name="priority"]').forEach(select=>{
    if(select.dataset.v117Priority==="ready")return;
    const previous=normalize(select.value)||"MEDIUM";
    select.innerHTML=OPTIONS.map(item=>`<option value="${item.value}" ${item.value===previous?"selected":""}>${item.label}</option>`).join("");
    select.dataset.v117Priority="ready";
    const field=select.closest(".field");
    if(field&&!field.querySelector("[data-v117-priority-help]")){
      const help=document.createElement("small");
      help.className="field-help";
      help.dataset.v117PriorityHelp="1";
      help.textContent="Urgente requiere aprobación de Liderazgo Logístico, Jefatura Logística o Gerencia.";
      field.appendChild(help);
    }
  });
}

function normalize(value){
  const v=String(value||"").trim().toUpperCase();
  if(["LOW","BAJA","BAJO"].includes(v))return "LOW";
  if(["MEDIUM","MEDIA","MEDIO","NORMAL"].includes(v))return "MEDIUM";
  if(["URGENT","URGENTE","HIGH","ALTA","ALTO","CRITICAL","CRITICA","CRÍTICA","CRITICO","CRÍTICO"].includes(v))return "URGENT";
  return null;
}

installOrderPriorityV117();
