// PACO V11.37.3 · Motor puro de intención y tolerancia ortográfica.
// Sin dependencias de DOM: se ejecuta igual en navegador y en CI.

export function normalizePacoText(value=""){
  return String(value||"")
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .toLowerCase()
    .replace(/[^a-z0-9\s#._/-]/g," ")
    .replace(/\s+/g," ")
    .trim();
}

export function editDistance(a,b){
  const x=normalizePacoText(a),y=normalizePacoText(b);
  if(x===y)return 0;
  if(!x)return y.length;
  if(!y)return x.length;
  const row=Array.from({length:y.length+1},(_,i)=>i);
  for(let i=1;i<=x.length;i++){
    let prev=row[0];
    row[0]=i;
    for(let j=1;j<=y.length;j++){
      const old=row[j];
      row[j]=Math.min(row[j]+1,row[j-1]+1,prev+(x[i-1]===y[j-1]?0:1));
      prev=old;
    }
  }
  return row[y.length];
}

function compact(word=""){return normalizePacoText(word).replace(/[^a-z0-9]/g,"")}
function wordSimilarity(a,b){
  const x=compact(a),y=compact(b);
  if(!x||!y)return 0;
  if(x===y)return 1;
  if(x.includes(y)||y.includes(x))return Math.min(x.length,y.length)/Math.max(x.length,y.length)+.14;
  if(Math.min(x.length,y.length)<=2)return 0;
  const distance=editDistance(x,y);
  return Math.max(0,1-distance/Math.max(x.length,y.length));
}
function phraseScore(input,alias){
  const text=normalizePacoText(input),phrase=normalizePacoText(alias);
  if(!text||!phrase)return 0;
  if(text===phrase)return 1.5;
  if(text.includes(phrase))return 1.35;
  const words=text.split(" ").filter(Boolean),targets=phrase.split(" ").filter(Boolean);
  if(!targets.length)return 0;
  let total=0,matched=0;
  for(const target of targets){
    let best=0;
    for(const word of words)best=Math.max(best,wordSimilarity(word,target));
    total+=best;
    if(best>=.62)matched++;
  }
  const coverage=matched/targets.length;
  const mean=total/targets.length;
  return coverage*.65+mean*.35;
}

export const PACO_INTENT_ALIASES=Object.freeze({
  cancel:[
    "cancelar","cancelar consulta","cancela consulta","cancelar esto","salir","parar consulta","detener consulta",
    "olvidalo","dejalo asi","dejemos eso","me equivoque","me ekivoque","me ekiboque","no era eso"
  ],
  restart:[
    "reiniciar paco","reiniciar chat","reinicia paco","reiniciar consulta","empezar de nuevo","comenzar de nuevo",
    "volver a empezar","borra consulta","limpiar chat","reset paco","resetea paco"
  ],
  activity:[
    "registrar actividad","registrar actvidad","registar actividad","rejistrar actividad","registrr actividad",
    "crear actividad","iniciar actividad","anotar actividad","hacer actividad","actividad nueva","meter actividad",
    "registrame actividad","quiero registrar una actividad","qiero registrar actividad","quiero registar actividad",
    "voy a hacer una actividad","voy hacer actividad","comensar actividad","empezar actvidad"
  ],
  delayed:[
    "pedidos demorados","pedido demorado","pedidos atrasados","pedido atrasado","pedidos retrasados","pedido retrasado",
    "mucho en cola","cola larga","que esta demorado","que esta tardando","cuales estan demorados","cuales van atrasados",
    "pedio demorado","peddo demorado","pedidos demroados","pediods demorados","q pedidos estan demorados",
    "que pedido lleva mucho","cual pedido lleva mas tiempo","los mas demorados","los pedidos mas lentos"
  ],
  idle:[
    "quien esta desocupado","quien esta libre","auxiliar desocupado","auxiliares desocupados","tiempo muerto","ociosos",
    "sin actividad","quien no tiene actividad","quien no esta haciendo nada","quien esta disponible",
    "qien esta desocupado","kien esta desocupado","quien sta desocupado","quien esta sin actvidad",
    "auxiliar libre","personal sin actividad","quien lleva 20 minutos sin actividad"
  ],
  recentWork:[
    "quien termino","quien termino actividad","actividades terminadas","actividad finalizada","que terminaron",
    "que se termino","quienes terminaron","qien termino","quien termnio","actividades finalisadas","que actividad termino"
  ],
  shipped:[
    "que se despacho","pedidos despachados","despachos recientes","que salio","que pedidos salieron","pedidos enviados",
    "q se despacho","que se despcho","pedidos despachads","que salio hoy","que mandaron","que ya se envio"
  ],
  novelties:[
    "novedades","que novedades hay","excepciones","bloqueos","problemas abiertos","incidencias","que esta bloqueado",
    "q novedades hay","que novedaes hay","novedaes","bloqeuos","hay algun problema","que problemas hay"
  ],
  operation:[
    "estado de la operacion","estado operacion","como va la operacion","resumen operativo","resumen ahora","resumen",
    "dame un resumen","como vamos","como va todo","estado general","situacion operativa","parte operativo",
    "resuemn operativo","resuemn","resumne","como va la opracion","q tal va la operacion","mostrame el resumen"
  ],
  myDay:[
    "mi jornada","que estoy haciendo","mi actividad","actividad actual","que tengo activo","que estoy trabajando",
    "q estoy haciendo","que estoi haciendo","mi jornanda","mi joranda","que actividad tengo","en que estoy"
  ],
  team:[
    "que esta haciendo","quien esta trabajando","equipo trabajando","estado del equipo","actividad del equipo",
    "que hace el equipo","que hace juan","que esta haciendo juan","q esta asiendo juan","q ase juan",
    "que esta asiendo","kien esta trabajando","qien esta trabajando","estado equipo","ver equipo"
  ],
  unassigned:[
    "pedidos sin responsable","pedido sin responsable","sin asignar","pedidos sin asignar","cola sin responsable",
    "pedidos sin dueño","quien no tiene asignado","pedios sin asignar","pedidos sin asiganr","sin repsonsable",
    "que pedidos estan solos","pedidos sin persona"
  ],
  longWork:[
    "actividades largas","actividad larga","actividad prolongada","quien lleva mucho tiempo","mucho tiempo en actividad",
    "quien lleva mas de 90 minutos","actividad demorada","qien lleva mucho tiempo","actividad prologada",
    "quien lleva mucho trabajando","actividad muy larga"
  ],
  capabilities:[
    "que puedes hacer","como me ayudas","funciones paco","ayuda paco","que sabes hacer","para que sirves",
    "q puedes hacer","que pudes hacer","como me puede ayudar","ayda paco","funciones del bot","que entiende paco"
  ],
  voice:[
    "probar voz","prueba de voz","habla paco","quiero oir paco","quiero escuchar paco","activar voz",
    "prbar voz","provar voz","prueba voz","voz paco"
  ],
  order:[
    "buscar pedido","consultar pedido","ver pedido","estado pedido","en que parte va","donde va el pedido","pedido",
    "donde esta el pedido","quien tiene el pedido","en que etapa esta","como va el pedido","ubicar pedido",
    "dnde va el peddo","donde va el pedio","en q parte va","dnd esta pedido","qien tiene pedido","ver peddo"
  ]
});

export const PACO_MODULE_ALIASES=Object.freeze({
  dashboard:["centro de operaciones","inicio","dashboard","panel principal","centro operaciones"],
  orders:["pedidos","ordenes","orden","gestion de pedidos","lista de pedidos"],
  sales:["ventas","comercial","vendedor","venta"],
  credit:["credito","creditos","solicitudes de credito"],
  cartera:["cartera","cobranza","cuentas por cobrar"],
  caja:["caja","tesoreria","pagos caja"],
  purchasing:["compras","compra","orden de compra","proveedores"],
  receiving:["recepcion","recibir mercancia","entrada de mercancia","recepcion mercancia"],
  picking:["alistamiento","picking","alistar","alistando","preparacion de pedido"],
  cutting:["corte","centro de corte","cortar","cable","cortes"],
  billing:["facturacion","facturar","factura","facturas"],
  shipping:["despachos","despacho","entregas","envios","envio","transportadora"],
  inventory:["inventario","stock","existencias","lotes","materiales"],
  workforce:["jornada","actividades","cronograma","personal","equipo","mi jornada"],
  approvals:["excepciones","aprobaciones","novedades","bloqueos"],
  vsm:["flujo y tiempos","vsm","tiempos de proceso","flujo"],
  reports:["analitica","reportes","informes","indicadores","estadisticas"],
  imports:["historico","importaciones","historial importado"],
  audit:["auditoria","trazabilidad","logs","registro de auditoria"],
  admin:["administracion","usuarios","roles","permisos","configuracion"]
});

const INTENT_PRIORITY=[
  "cancel","restart","activity","delayed","idle","recentWork","shipped","novelties","operation",
  "myDay","team","unassigned","longWork","capabilities","voice","order"
];

function bestAliasScore(input,aliases=[]){
  let best=0;
  for(const alias of aliases)best=Math.max(best,phraseScore(input,alias));
  return best;
}

export function extractOrderTerm(input=""){
  const raw=String(input||"");
  const explicit=raw.match(/(?:pedido|pedio|peddo|orden)\s*(?:#|numero|nro|no\.?|:)?\s*([A-Za-z0-9][A-Za-z0-9._/-]{2,})/i)?.[1];
  if(explicit&&!/^(demorado|atrasado|bloqueado|que|como|donde|esta)$/i.test(explicit))return explicit;
  return raw.match(/\b[A-Za-z]{1,8}[-_]\d{2,}[A-Za-z0-9-]*\b/)?.[0]
    ||raw.match(/\b\d{4,}\b/)?.[0]
    ||"";
}

export function classifyPacoInput(input=""){
  const text=normalizePacoText(input);
  if(!text)return {intent:"empty",score:1,module:null,term:""};
  let winner={intent:"unknown",score:0,module:null,term:""};
  for(const intent of INTENT_PRIORITY){
    const score=bestAliasScore(text,PACO_INTENT_ALIASES[intent]);
    if(score>winner.score)winner={intent,score,module:null,term:""};
  }

  let moduleWinner={module:null,score:0};
  for(const [module,aliases] of Object.entries(PACO_MODULE_ALIASES)){
    const score=bestAliasScore(text,aliases);
    if(score>moduleWinner.score)moduleWinner={module,score};
  }

  const explicitNavigation=/\b(ir|abrir|abre|mostrar|muestra|ver|llevar|llevame|entrar|entra|quiero|necesito)\b/.test(text);
  if(moduleWinner.module&&moduleWinner.score>=.78&&(explicitNavigation||winner.score<.80)){
    return {intent:"module",score:moduleWinner.score,module:moduleWinner.module,term:""};
  }

  const term=extractOrderTerm(input);
  if(term&&winner.intent!=="activity"&&winner.intent!=="cancel"&&winner.intent!=="restart"){
    return {intent:"order",score:Math.max(winner.score,1.05),module:null,term};
  }

  if(winner.score>=.74)return {...winner,term:winner.intent==="order"?term:""};
  if(moduleWinner.module&&moduleWinner.score>=.84)return {intent:"module",score:moduleWinner.score,module:moduleWinner.module,term:""};
  return {intent:"unknown",score:winner.score,module:null,term};
}
