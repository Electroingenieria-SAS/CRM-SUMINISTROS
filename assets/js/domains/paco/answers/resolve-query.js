import { normalizePacoText as norm, matchesAny, detectPacoIntent, matchCrmModule, isCancelText, isRestartText } from "../language/index.js";
import { paco } from "../paco-state.js";
import { allowed } from "../context/profile-context.js";
import { orderTerm } from "../context/order-context.js";
import { message } from "../ui/messages.js";
import { setFlow, cancelFlowMessage } from "../actions/conversation-flow.js";
import { beginActivityFlow, startActivity } from "../actions/activity-selection.js";
import { delayedMessage, unassignedOrdersMessage, shippedMessage, noveltyMessage, operationMessage, diagnoseOrder } from "./orders.js";
import { idleMessage, teamActivityMessage, longWorkMessage, recentWorkMessage, myDayMessage } from "./workforce.js";
import { capabilitiesMessage, freightIntelligenceMessage } from "./capabilities.js";

export async function resolveQuery(input){
  const text=norm(input);
  if(!text)return message({text:"Dime qué necesitas. Puedo revisar pedidos, jornada, novedades o registrar una actividad."});

  if(isRestartText(text)){
    setFlow(null);
    return message({text:"Reinicié el contexto de la consulta. Empecemos de nuevo.",actions:[{label:"Ver opciones",action:"capabilities",kind:"primary",icon:"↗"},{label:"Escribir consulta",action:"focus-input",icon:"⌕"}]});
  }
  if(isCancelText(text))return cancelFlowMessage();

  if(paco.flow?.type==="activity"){
    if(paco.flow.step==="confirm"){
      if(matchesAny(text,["si","sí","dale","iniciar","empieza","comenzar","hagale","hágale"]))return startActivity(paco.flow.catalogId);
      if(matchesAny(text,["no","otra","cambiar","elegir otra","me equivoque","me equivoqué"]))return beginActivityFlow();
    }
    if(paco.flow.step==="search")return beginActivityFlow(input);
  }

  if(matchesAny(text,["hola","buenas","paco","ayuda","hey paco","oe paco"]))return message({
    text:"Aquí estoy. Estoy pendiente del CRM y también puedo ayudarte a ejecutar tareas.",
    actions:[{label:"Registrar actividad",action:"activity-begin",kind:"primary",icon:"▶"},{label:"Estado operativo",action:"operation",icon:"↗"}]
  });

  if(matchesAny(text,["flete","fletes","transportadora","transportadoras","prediccion de flete","predicción de flete","costo de envio","costo de envío","ahorro logistico","ahorro logístico"]))return freightIntelligenceMessage();

    const intent=detectPacoIntent(input);
  if(intent==="activity"){
    const cleaned=text.replace(/registrar|registar|rejistrar|crear|iniciar|anotar|hacer|actividad|actvidad|nueva|agregar|meter|poner/g," ").replace(/\s+/g," ").trim();
    return beginActivityFlow(cleaned);
  }
  if(intent==="capabilities")return capabilitiesMessage();
  if(intent==="delayed")return delayedMessage();
  if(intent==="unassigned")return unassignedOrdersMessage();
  if(intent==="idle")return idleMessage();
  if(intent==="longWork")return longWorkMessage();
  if(intent==="team")return teamActivityMessage(input);
  if(intent==="recentWork")return recentWorkMessage();
  if(intent==="shipped")return shippedMessage();
  if(intent==="novelties")return noveltyMessage();
  if(intent==="operation")return operationMessage();
  if(intent==="myDay")return myDayMessage();

  const term=orderTerm(input);
  if(term||intent==="order")return diagnoseOrder(term);

  const moduleHit=matchCrmModule(text);
  if(moduleHit&&allowed(moduleHit.id)){
    return message({
      text:`${moduleHit.label}: ${moduleHit.summary}`,
      actions:[
        {label:`Abrir ${moduleHit.label}`,action:"navigate",module:moduleHit.id,kind:"primary",icon:"→"},
        {label:"Nueva consulta",action:"focus-input",icon:"⌕"},
        {label:"Cancelar consulta",action:"cancel-flow",icon:"×"},
        {label:"Reiniciar PACO",action:"restart",icon:"↻"}
      ]
    });
  }

  return message({
    text:"No encontré una acción exacta. Puedes escribir como hablas normalmente, incluso con errores: pedidos, inventario, compras, recepción, alistamiento, corte, facturación, despachos, jornada, excepciones, reportes, auditoría, usuarios y demás módulos del CRM.",
    actions:[
      {label:"¿Qué puede hacer PACO?",action:"capabilities",icon:"↗"},
      {label:"Registrar actividad",action:"activity-begin",icon:"▶"},
      {label:"Resumen operativo",action:"operation",icon:"◎"},
      {label:"Cancelar consulta",action:"cancel-flow",icon:"×"},
      {label:"Reiniciar",action:"restart",icon:"↻"}
    ]
  });
}
