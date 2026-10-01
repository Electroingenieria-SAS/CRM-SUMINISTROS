import { paco } from "../paco-state.js";
import { isManager, displayName } from "../context/profile-context.js";
import { message, renderMessages, add } from "../ui/messages.js";
import { setQuickMenuOpen, renderQuick, clearBadge } from "../ui/panel.js";

export function setFlow(next){
  paco.flow=next||null;
  renderQuick();
}

export function choiceControls(){
  return [
    {label:"Cancelar consulta",sub:"Salir de esta selección",icon:"×",action:"cancel-flow"},
    {label:"Reiniciar PACO",sub:"Empezar una consulta nueva",icon:"↻",action:"restart"}
  ];
}

export function cancelFlowMessage(){
  const hadFlow=Boolean(paco.flow);
  setFlow(null);
  return message({
    text:hadFlow?"Cancelé la consulta actual. Puedes empezar otra cuando quieras.":"No había una consulta guiada activa. Puedes escribir una nueva.",
    actions:[{label:"Nueva consulta",action:"focus-input",kind:"primary",icon:"⌕"},{label:"Ver opciones",action:"capabilities",icon:"↗"}]
  });
}

export function restartPaco(){
  setFlow(null);
  paco.previous=null;
  paco.messages=[];
  clearBadge();
  setQuickMenuOpen(false);
  ensureWelcome();
  renderMessages();
  renderQuick();
  const input=paco.root?.querySelector("[data-paco-input]");
  if(input){input.value="";setTimeout(()=>input.focus(),50)}
}

export function ensureWelcome(){
  if(paco.messages.length)return;
  add(message({
    text:`${displayName()?`Hola, ${displayName()}. `:""}Soy PACO. Estoy pendiente de la operación y también puedo ayudarte a trabajar dentro del CRM.`,
    actions:[
      {label:"Registrar actividad",sub:"Te guío desde aquí",icon:"◷",kind:"primary",action:"activity-begin"},
      {label:"Pedidos demorados",sub:"Revisar cola y SLA",icon:"!",action:"delayed"},
      ...(isManager()?[{label:"Equipo disponible",sub:"Auxiliares sin actividad",icon:"◎",action:"idle"}]:[]),
      {label:"Resumen operativo",sub:"Etapas, demoras y responsables",icon:"↗",action:"operation"},
      {label:"Probar voz",sub:"Escuchar PACO en español latino",icon:"🔊",action:"test-voice"}
    ]
  }));
}
