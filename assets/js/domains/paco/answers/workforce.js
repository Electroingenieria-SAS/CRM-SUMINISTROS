import { api } from "../../../services/api.js";
import { normalizePacoText as norm } from "../language/index.js";
import { paco } from "../paco-state.js";
import { isManager, profileId, timeLabel, duration } from "../context/profile-context.js";
import { message } from "../ui/messages.js";
import { snapshotExecutions, snapshotTeam, idleAuxiliaries, longActivities } from "../alerts/signals.js";
import { loadSnapshot } from "../context/snapshot.js";

export async function idleMessage(){
  if(!isManager())return message({text:"La disponibilidad del equipo solo se muestra a liderazgo y coordinación autorizados."});
  const snapshot=paco.previous||await loadSnapshot();
  const rows=idleAuxiliaries(snapshot).slice(0,8);
  if(!rows.length)return message({text:"No veo auxiliares de logística o corte con inactividad superior a 20 minutos laborales."});
  return message({text:`Hay ${rows.length} auxiliar${rows.length===1?"":"es"} con tiempo disponible.`,card:rows.map(row=>[row.name,duration(row.idleSeconds)]),actions:[{label:"Abrir cronograma",action:"navigate",module:"workforce",icon:"◷"}]});
}

export async function teamActivityMessage(input=""){
  if(!isManager())return myDayMessage();
  const snapshot=paco.previous||await loadSnapshot();
  const rows=snapshotTeam(snapshot);
  if(!rows.length)return message({text:"No veo auxiliares de logística o corte en tu ámbito actual."});
  const query=norm(input).replace(/que|esta|haciendo|quien|trabajando|estado|del|equipo|actividad/g," ").replace(/\s+/g," ").trim();
  const filtered=query?rows.filter(row=>norm(row.name).includes(query)||query.split(" ").some(word=>word.length>2&&norm(row.name).includes(word))):rows;
  if(query&&!filtered.length)return message({text:`No encontré un auxiliar visible que coincida con “${input}”.`,actions:[{label:"Ver equipo",action:"navigate",module:"workforce",icon:"◷"}]});
  return message({
    text:query?"Esto es lo que veo de esa persona.":"Así está el equipo auxiliar en este momento.",
    card:filtered.slice(0,10).map(row=>[
      row.name||"Auxiliar",
      row.specialTreatment
        ? "Tratamiento especial"
        : row.activeTitle
          ? `${row.activeTitle} · ${duration(Number(row.activeBusinessSeconds||0))}`
          : `Disponible · ${duration(Number(row.idleBusinessSeconds||0))}`
    ]),
    actions:[{label:"Abrir cronograma",action:"navigate",module:"workforce",icon:"◷"}]
  });
}

export async function longWorkMessage(){
  if(!isManager())return message({text:"El seguimiento de actividades prolongadas está disponible para liderazgo y coordinación autorizados."});
  const snapshot=paco.previous||await loadSnapshot();
  const rows=longActivities(snapshot).slice(0,8);
  if(!rows.length)return message({text:"No veo actividades auxiliares que superen 90 minutos laborales en este momento."});
  return message({
    text:`Hay ${rows.length} actividad${rows.length===1?"":"es"} prolongada${rows.length===1?"":"s"} para revisar.`,
    card:rows.map(row=>[row.name||"Auxiliar",`${row.activeTitle||"Actividad"} · ${duration(row.activeSeconds)}`]),
    actions:[{label:"Abrir cronograma",action:"navigate",module:"workforce",icon:"◷"}]
  });
}

export async function recentWorkMessage(){
  const snapshot=paco.previous||await loadSnapshot();
  const rows=snapshotExecutions(snapshot).filter(x=>x.endedAt).sort((a,b)=>new Date(b.endedAt)-new Date(a.endedAt)).slice(0,8);
  if(!rows.length)return message({text:"No veo actividades finalizadas hoy en tu ámbito visible."});
  return message({text:"Estas son las últimas actividades terminadas que puedo ver.",card:rows.map(row=>[`${row.profileName||"Usuario"} · ${timeLabel(row.endedAt)}`,row.title||"Actividad"])});
}

export async function myDayMessage(){
  const snapshot=paco.previous||await loadSnapshot();
  paco.previous=snapshot;
  const activeOrderWork=snapshotExecutions(snapshot)
    .filter(row=>String(row.profileId)===String(profileId())&&!row.endedAt)
    .sort((a,b)=>new Date(b.startedAt||0)-new Date(a.startedAt||0))[0]||null;

  if(activeOrderWork){
    const automatic=["ORDER_TASK","CUT_EXECUTION"].includes(String(activeOrderWork.source||"").toUpperCase());
    return message({
      text:automatic
        ? `Ahora estás ocupado en “${activeOrderWork.title||"un proceso de pedido"}”. El CRM registró esta ocupación automáticamente.`
        : `Ahora tienes activa “${activeOrderWork.title||"Actividad"}”.`,
      card:[
        ["Inicio",timeLabel(activeOrderWork.startedAt)],
        ["Estado",activeOrderWork.status||"En curso"],
        ...(automatic?[["Origen","Proceso automático del pedido"]]:[])
      ],
      actions:[{label:"Abrir Mi jornada",action:"navigate",module:"workforce",icon:"◷"}]
    });
  }

  const data=await api.workMyDay();
  if(data?.active){
    const active=data.active;
    return message({text:`Ahora tienes activa “${active.title||active.catalogName||"Actividad"}”.`,card:[["Inicio",timeLabel(active.startedAt||active.started_at)],["Estado",active.status||"En curso"]],actions:[{label:"Abrir Mi jornada",action:"navigate",module:"workforce",icon:"◷"}]});
  }
  return message({text:"No tienes una actividad o proceso de pedido activo en este momento.",actions:[{label:"Registrar actividad",action:"activity-begin",kind:"primary",icon:"▶"}]});
}
