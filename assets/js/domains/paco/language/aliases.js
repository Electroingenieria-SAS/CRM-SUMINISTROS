

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

export const INTENT_ANCHORS=Object.freeze({
  activity:[/\bregistr/,/\bactividad nueva\b/,/\biniciar actividad\b/,/\bempezar tarea\b/,/\banotar/],
  delayed:[/\bdemor/,/\batras/,/\bretras/,/\bcola\b/,/\blent/,/\btard/,/\blleva\b.*\btiempo\b/],
  unassigned:[/sin\s+(responsable|asignar|encargado|dueno)/,/nadie\s+tiene/],
  idle:[/\bdesocup/,/\bdisponible/,/\blibre\b/,/sin\s+actividad/,/no\s+esta\s+haciendo/,/no\s+tiene\s+nada\s+asignado/],
  longWork:[/\bprolong/,/actividad\s+(muy\s+)?larga/,/mas\s+de\s+(una\s+hora|90)/,/mucho\s+tiempo\s+en\s+actividad/],
  recentWork:[/\btermin/,/\bfinaliz/,/\bacab/],
  shipped:[/\bdespach/,/\benviad/,/\benvio\b/,/\bsalio\b/,/\bsalieron\b/,/\bsalen\b/,/\bentreg/],
  novelties:[/\bnoved/,/\bbloque/,/\bexcep/,/\bproblema/,/\bincidenc/],
  operation:[/\bresumen\b/,/\bparte operativo\b/,/estado\s+(general|de la operacion)/,/como\s+va\s+(todo|la operacion)/],
  myDay:[/\bmi jornada\b/,/\bmi actividad\b/,/\bmi tarea\b/,/que\s+estoy\s+haciendo/],
  team:[/que\s+esta\s+haciendo/,/quien\s+esta\s+trabajando/,/estado\s+del\s+equipo/,/en\s+que\s+anda/],
  capabilities:[/puedes\s+hacer/,/\bfunciones\b/,/para\s+que\s+sirves/,/como\s+me\s+ayudas/],
  order:[/donde\s+.*pedido/,/pedido\s+.*donde/,/por\s+donde\s+va\s+((el|la)\s+)?(pedido|orden)/,/\brastrear\b/,/\bseguimiento\b/,/quien\s+tiene\s+.*pedido/,/en\s+que\s+(parte|proceso)\s+va/]
});

export const INTENT_ANCHOR_WEIGHTS=Object.freeze({
  delayed:970,
  activity:985,
  idle:985,
  team:985,
  recentWork:985,
  operation:985,
  myDay:985,
  capabilities:985,
  unassigned:995,
  longWork:995,
  shipped:995,
  novelties:995,
  order:995
});

export function anchorScore(intent,normalized){
  return (INTENT_ANCHORS[intent]||[]).some(pattern=>pattern.test(normalized))?(INTENT_ANCHOR_WEIGHTS[intent]||980):0;
}
