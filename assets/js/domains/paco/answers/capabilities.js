import { api } from "../../../services/api.js";
import { fmt } from "../../../core/format.js";
import { isManager, allowed, todayIso } from "../context/profile-context.js";
import { message } from "../ui/messages.js";

export function capabilitiesMessage(){
  return message({
    text:"Puedo consultar la operación y ayudarte a ejecutar acciones permitidas por tu sesión: ubicación y etapa de pedidos, demoras, pedidos sin responsable, novedades, despachos, jornada, actividades terminadas, estado del equipo, alertas desde 20 minutos sin actividad, fletes fuera de rango, entregas en riesgo, ahorro logístico, resúmenes automáticos cada 30 minutos y registro guiado de actividades.",
    actions:[
      {label:"Registrar actividad",action:"activity-begin",kind:"primary",icon:"▶"},
      {label:"Resumen operativo",action:"operation",icon:"↗"},
      {label:"Probar voz",action:"test-voice",icon:"🔊"},
      {label:"Pedidos demorados",action:"delayed",icon:"!"}
    ]
  });
}

export async function freightIntelligenceMessage(){
  if(!isManager()&&!allowed("shipping"))return message({text:"La inteligencia de fletes está disponible para usuarios autorizados de Despachos y liderazgo."});
  const to=todayIso(),from=new Date(Date.now()-89*864e5).toISOString().slice(0,10);
  try{
    const data=await api.freightIntelligence(from,to),summary=data?.summary||{},budget=data?.budget||{},alerts=data?.alerts||[];
    const cop=value=>new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(Number(value||0));
    return message({
      text:alerts.length?`Veo ${alerts.length} alerta${alerts.length===1?"":"s"} logística${alerts.length===1?"":"s"} en el rango reciente.`:"La operación logística no presenta alertas de flete o fecha en el rango reciente.",
      card:[
        ["Costo real",cop(summary.actualCarrierCost||0)],
        ["Ahorro potencial",cop(summary.potentialSavings||0)],
        ["Error mediano",summary.medianAbsErrorPct==null?"Sin evaluación":`${fmt.number(summary.medianAbsErrorPct,1)}%`],
        ["Presupuesto pendiente",cop(budget.expectedMid||0)]
      ],
      actions:[{label:"Abrir inteligencia logística",action:"navigate",module:"dashboard",icon:"↗"},...(alerts[0]?.orderId?[{label:`Revisar ${alerts[0].orderNumber||"pedido"}`,action:"open-order",orderId:alerts[0].orderId,module:"orders",icon:"!"}]:[])]
    });
  }catch(error){return message({text:"No pude consultar la inteligencia logística con los permisos actuales.",alert:{title:"Fletes",text:error.message||"Consulta no disponible",tone:"warning"}})}
}
