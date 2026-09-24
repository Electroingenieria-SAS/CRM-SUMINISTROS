// PACO V11.37.3 · motor de lenguaje tolerante a errores.
// Módulo puro: puede ejecutarse en navegador y en CI/Node sin DOM.

const TOKEN_REWRITES=Object.freeze({
  q:"que",qe:"que",ke:"que",k:"que",
  qn:"quien",kien:"quien",kién:"quien",
  dnde:"donde",dond:"donde",onde:"donde",
  xq:"porque",pq:"porque",porq:"porque",
  sta:"esta",estan:"estan",stoy:"estoy",
  tngo:"tengo",tienee:"tiene",
  peddo:"pedido",pedio:"pedido",peido:"pedido",pedidoo:"pedido",peddio:"pedido",
  actvidad:"actividad",activdad:"actividad",actvdad:"actividad",atividad:"actividad",
  asiendo:"haciendo",asiendo:"haciendo",hasiendo:"haciendo",
  desocpado:"desocupado",desocupdo:"desocupado",
  demroado:"demorado",demrado:"demorado",demoraro:"demorado",
  atrasdo:"atrasado",atrzado:"atrasado",
  resumn:"resumen",resumne:"resumen",resuemn:"resumen",
  operacionn:"operacion",operacoin:"operacion",
  inbentario:"inventario",inventrio:"inventario",invntario:"inventario",
  recepccion:"recepcion",resepcion:"recepcion",recpcion:"recepcion",
  alistamineto:"alistamiento",alistamieto:"alistamiento",
  factuacion:"facturacion",facturacoin:"facturacion",
  despcaho:"despacho",despaho:"despacho",
  aprbaciones:"aprobaciones",aprovaciones:"aprobaciones",
  exepciones:"excepciones",excepcione:"excepciones",
  audtoria:"auditoria",auditoriaa:"auditoria",
  adminstracion:"administracion",admnistracion:"administracion",
  cronogama:"cronograma",crongrama:"cronograma",
  usarios:"usuarios",usuairos:"usuarios",
  cmpra:"compra",comprs:"compras",
  credtio:"credito",creidto:"credito",
  cartra:"cartera",
  repotes:"reportes",reprotes:"reportes",
  historcio:"historico",historiall:"historico",
  novedadess:"novedades",
  blokqueo:"bloqueo",bloqeos:"bloqueos"
});

export function normalizePacoText(value){
  const raw=String(value||"")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"")
    .toLowerCase()
    .replace(/[^a-z0-9\s#._/-]/g," ")
    .replace(/\s+/g," ")
    .trim();
  if(!raw)return "";
  return raw.split(" ").map(token=>TOKEN_REWRITES[token]||token).join(" ");
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

export function fuzzyWord(word,target){
  const a=normalizePacoText(word),b=normalizePacoText(target);
  if(!a||!b)return false;
  if(a===b||a.includes(b)||b.includes(a))return true;
  const min=Math.min(a.length,b.length),max=Math.max(a.length,b.length);
  if(min<=3)return false;
  const distance=editDistance(a,b);
  if(min===4)return distance<=1;
  return distance<=Math.max(1,Math.floor(max*.30));
}

export function fuzzyPhrase(text,phrase){
  const a=normalizePacoText(text),b=normalizePacoText(phrase);
  if(!a||!b)return false;
  if(a.includes(b))return true;
  const words=a.split(" ").filter(Boolean);
  const targets=b.split(" ").filter(Boolean);
  return targets.every(target=>words.some(word=>fuzzyWord(word,target)));
}

export function matchesAny(text,aliases=[]){
  return aliases.some(alias=>fuzzyPhrase(text,alias));
}

export const INTENT_ALIASES=Object.freeze({
  activity:[
    "registrar actividad","registar actividad","registrar actvidad","crear actividad","iniciar actividad",
    "anotar actividad","hacer actividad","actividad nueva","agregar actividad","meter actividad",
    "poner actividad","empezar tarea","iniciar tarea","registrar lo que hago","anotar lo que hago",
    "voy a hacer","voy hacer","quiero registrar una actividad"
  ],
  delayed:[
    "pedidos demorados","pedido demorado","pedidos atrasados","pedido atrasado","mucho en cola",
    "cola larga","que esta demorado","cuales estan demorados","cual esta atrasado","pedidos pegados",
    "pedidos lentos","cual lleva mas tiempo","que lleva mucho tiempo","demoras de pedidos"
  ],
  idle:[
    "quien esta desocupado","auxiliar desocupado","tiempo muerto","ociosos","sin actividad",
    "quien esta libre","quien no esta haciendo nada","auxiliar sin actividad","quien esta quieto",
    "quien lleva rato sin hacer nada","personal disponible","auxiliares disponibles"
  ],
  recentWork:[
    "quien termino","actividades terminadas","actividad finalizada","que terminaron","quien ya termino",
    "que acabaron","actividades acabadas","terminados hoy","quien finalizo actividad"
  ],
  shipped:[
    "que se despacho","pedidos despachados","despachos recientes","que salio","que se envio",
    "que entregaron","pedidos enviados","pedidos en despacho","ultimos despachos","que salio hoy"
  ],
  novelties:[
    "novedades","que novedades hay","excepciones","bloqueos","problemas abiertos","incidencias",
    "que esta bloqueado","que problemas hay","pedidos bloqueados","novedades abiertas"
  ],
  operation:[
    "estado de la operacion","estado operacion","como va la operacion","resumen operativo","resumen ahora",
    "dame resumen","dame un resumen","dame un parte","parte operativo","estado general",
    "como va todo","que esta pasando","resumen de la operacion","situacion de la operacion"
  ],
  myDay:[
    "mi jornada","que estoy haciendo","mi actividad","que tengo activo","mi trabajo actual",
    "que actividad tengo","que estoy haciendo ahora","mi tarea actual","estado de mi jornada"
  ],
  team:[
    "que esta haciendo","quien esta trabajando","equipo trabajando","estado del equipo","actividad del equipo",
    "que hace","en que anda","que esta haciendo juan","actividad de juan","que hace el auxiliar",
    "que estan haciendo","que esta haciendo el equipo"
  ],
  unassigned:[
    "pedidos sin responsable","pedido sin responsable","sin asignar","pedidos sin asignar","cola sin responsable",
    "pedidos sin encargado","nadie tiene el pedido","pedido sin dueño","que pedidos no tienen responsable"
  ],
  longWork:[
    "actividades largas","actividad larga","actividad prolongada","quien lleva mucho tiempo",
    "mucho tiempo en actividad","quien lleva mas de una hora","actividad demorada","tarea muy larga",
    "quien lleva rato en la misma actividad"
  ],
  capabilities:[
    "que puedes hacer","como me ayudas","funciones paco","ayuda paco","que sabes hacer",
    "para que sirves","que consultas puedes hacer","que puedes consultar","como funciona paco"
  ],
  order:[
    "buscar pedido","consultar pedido","ver pedido","estado pedido","en que parte va","donde va el pedido",
    "ubicacion pedido","quien tiene el pedido","por donde va el pedido","en que proceso va",
    "donde esta el pedido","rastrear pedido","seguimiento pedido"
  ]
});

export const CRM_MODULE_KNOWLEDGE=Object.freeze({
  dashboard:{
    label:"Centro de operaciones",
    aliases:["inicio","dashboard","dashbord","tablero","centro de operaciones","operacion general"],
    summary:"Vista general del CRM: operación, alertas, pendientes y accesos rápidos."
  },
  orders:{
    label:"Pedidos",
    aliases:["pedidos","pedido","ordenes","orden","gestionar pedido","crear pedido"],
    summary:"Consulta, creación, seguimiento y acciones del ciclo completo de pedidos."
  },
  sales:{
    label:"Ventas",
    aliases:["ventas","venta","comercial","vendedor","gestion comercial"],
    summary:"Gestión comercial y datos asociados al origen de los pedidos."
  },
  credit:{
    label:"Crédito",
    aliases:["credito","creditos","solicitud de credito","cupos","credito cliente"],
    summary:"Solicitudes y decisiones relacionadas con crédito."
  },
  cartera:{
    label:"Cartera",
    aliases:["cartera","cobro","cobros","cuentas por cobrar","validacion cartera"],
    summary:"Validaciones financieras y control de cartera del pedido."
  },
  caja:{
    label:"Caja",
    aliases:["caja","recaudo","pago","pagos","caja facturacion"],
    summary:"Validación y registro de la etapa de caja y pagos."
  },
  purchasing:{
    label:"Compras",
    aliases:["compras","compra","orden de compra","proveedor","proveedores","comprar material"],
    summary:"Gestión de compras, órdenes y abastecimiento requerido por los pedidos."
  },
  receiving:{
    label:"Recepción",
    aliases:["recepcion","recibir mercancia","entrada de mercancia","mercancia recibida","recepcion pedido"],
    summary:"Recepción física y documental de mercancía, novedades y confirmaciones."
  },
  picking:{
    label:"Alistamiento",
    aliases:["alistamiento","alistar","picking","preparar pedido","alistando"],
    summary:"Preparación del pedido, disponibilidad, origen de material y rondas de alistamiento."
  },
  cutting:{
    label:"Centro de corte",
    aliases:["corte","cortar","centro de corte","cables corte","requerimientos de corte"],
    summary:"Planeación, ejecución, pausas, evidencia y cierre de trabajos de corte."
  },
  billing:{
    label:"Facturación",
    aliases:["facturacion","facturar","factura","facturas","generar factura"],
    summary:"Registro y seguimiento de facturación del pedido."
  },
  shipping:{
    label:"Despachos y entregas",
    aliases:["despacho","despachos","entrega","entregas","envio","guia","transportadora","cierre"],
    summary:"Guías, ubicación, evidencias, despacho, entrega, satisfacción y cierre."
  },
  inventory:{
    label:"Inventario",
    aliases:["inventario","stock","existencias","lotes","lote","material","materiales","bodega"],
    summary:"Existencias, lotes, movimientos, conteos y trazabilidad de inventario."
  },
  workforce:{
    label:"Jornada y actividades",
    aliases:["jornada","actividades","actividad","cronograma","personal","equipo","productividad","mi jornada"],
    summary:"Actividades, cronograma, tiempos, equipo, evidencias y analítica de jornada."
  },
  approvals:{
    label:"Excepciones y aprobaciones",
    aliases:["excepciones","aprobaciones","novedades","bloqueos","pendientes de aprobar","aprobar"],
    summary:"Excepciones operativas, novedades y solicitudes que requieren revisión."
  },
  vsm:{
    label:"Flujo y tiempos",
    aliases:["flujo","tiempos","vsm","tiempo de proceso","cuello de botella"],
    summary:"Análisis del flujo, tiempos y comportamiento del proceso."
  },
  reports:{
    label:"Analítica y reportes",
    aliases:["reportes","reporte","analitica","indicadores","informes","metricas"],
    summary:"Indicadores, analítica y reportes del CRM."
  },
  imports:{
    label:"Histórico",
    aliases:["historico","historial","importaciones","importar","datos historicos"],
    summary:"Consulta e importación controlada de información histórica."
  },
  audit:{
    label:"Auditoría",
    aliases:["auditoria","trazabilidad","log","logs","quien hizo","registro de cambios"],
    summary:"Trazabilidad de eventos, acciones y cambios del sistema."
  },
  admin:{
    label:"Administración",
    aliases:["administracion","admin","usuarios","roles","permisos","crear usuario","gestionar usuarios"],
    summary:"Usuarios, roles, permisos y configuración administrativa del CRM."
  }
});

export function matchCrmModule(text){
  const normalized=normalizePacoText(text);
  let best=null;
  let bestScore=0;
  for(const [id,info] of Object.entries(CRM_MODULE_KNOWLEDGE)){
    for(const alias of info.aliases){
      const a=normalizePacoText(alias);
      let score=0;
      if(normalized===a)score=100;
      else if(normalized.includes(a))score=80+Math.min(15,a.length/3);
      else if(fuzzyPhrase(normalized,a))score=60+Math.min(15,a.length/4);
      if(score>bestScore){best={id,...info};bestScore=score}
    }
  }
  return bestScore>=60?{...best,score:bestScore}:null;
}

function intentAliasScore(text,alias){
  const normalized=normalizePacoText(text),candidate=normalizePacoText(alias);
  if(!normalized||!candidate)return 0;
  if(normalized===candidate)return 1000+candidate.length;
  if(normalized.includes(candidate))return 900+candidate.length;
  if(candidate.includes(normalized)&&normalized.length>=5)return 780+normalized.length;
  if(!fuzzyPhrase(normalized,candidate))return 0;
  const words=normalized.split(" ").filter(Boolean);
  const targets=candidate.split(" ").filter(Boolean);
  let exact=0;
  let similarity=0;
  for(const target of targets){
    let best=0;
    for(const word of words){
      if(word===target){best=1;break}
      const max=Math.max(word.length,target.length);
      if(max)best=Math.max(best,1-editDistance(word,target)/max);
    }
    if(best===1)exact++;
    similarity+=Math.max(0,best);
  }
  const average=targets.length?similarity/targets.length:0;
  return 500+exact*35+Math.round(average*100)+candidate.length/10;
}

export function detectPacoIntent(text){
  const normalized=normalizePacoText(text);
  if(!normalized)return null;
  let bestIntent=null,bestScore=0;
  for(const [intent,aliases] of Object.entries(INTENT_ALIASES)){
    for(const alias of aliases){
      const score=intentAliasScore(normalized,alias);
      if(score>bestScore){bestIntent=intent;bestScore=score}
    }
  }
  return bestScore>=500?bestIntent:null;
}

export function isCancelText(text){
  return matchesAny(normalizePacoText(text),[
    "cancelar","cancelar consulta","cancelar esto","salir","olvidalo","dejar asi","parar consulta","abortar","me equivoque","no era eso"
  ]);
}

export function isRestartText(text){
  return matchesAny(normalizePacoText(text),[
    "reiniciar","reiniciar paco","reinicar paco","empezar de nuevo","volver a empezar","nueva consulta","borrar consulta","comenzar otra vez","borra y empieza otra vez"
  ]);
}
