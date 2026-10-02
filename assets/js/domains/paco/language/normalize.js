

export const TOKEN_REWRITES=Object.freeze({
  q:"que",qe:"que",ke:"que",k:"que",
  qn:"quien",qien:"quien",kien:"quien",kién:"quien",
  d:"de",dnde:"donde",dond:"donde",onde:"donde",
  ai:"hay",
  xq:"porque",pq:"porque",porq:"porque",
  sta:"esta",estan:"estan",stoy:"estoy",
  tngo:"tengo",tienee:"tiene",
  peddo:"pedido",pedio:"pedido",peido:"pedido",pedidoo:"pedido",peddio:"pedido",
  pedios:"pedidos",peddos:"pedidos",pediods:"pedidos",pedidso:"pedidos",
  actvidad:"actividad",activdad:"actividad",actvdad:"actividad",atividad:"actividad",actviidad:"actividad",actiidad:"actividad",
  activdades:"actividades",actvidades:"actividades",
  asiendo:"haciendo",asiendo:"haciendo",hasiendo:"haciendo",
  ase:"hace",acer:"hacer",ago:"hago",asen:"hacen",asia:"hacia",
  eqipo:"equipo",equpo:"equipo",ekipo:"equipo",
  desocpado:"desocupado",desocupdo:"desocupado",desocpados:"desocupados",
  auxliar:"auxiliar",auxilar:"auxiliar",auxliares:"auxiliares",
  responzable:"responsable",responsble:"responsable",repsonsable:"responsable",respnosable:"responsable",resposable:"responsable",
  asiganr:"asignar",asignr:"asignar",encagado:"encargado",
  tienpo:"tiempo",tiemppo:"tiempo",disponble:"disponible",
  demroado:"demorado",demrado:"demorado",demoraro:"demorado",
  demroados:"demorados",demrados:"demorados",demoradoss:"demorados",
  atrasdo:"atrasado",atrzado:"atrasado",atrasdos:"atrasados",
  resumn:"resumen",resumne:"resumen",resuemn:"resumen",
  operacionn:"operacion",operacoin:"operacion",
  inbentario:"inventario",inventrio:"inventario",invntario:"inventario",
  recepccion:"recepcion",resepcion:"recepcion",recpcion:"recepcion",recpecion:"recepcion",
  alistamineto:"alistamiento",alistamieto:"alistamiento",preaprar:"preparar",
  factuacion:"facturacion",facturacoin:"facturacion",
  despcaho:"despacho",despaho:"despacho",despcho:"despacho",
  despachads:"despachados",despachdos:"despachados",ultmos:"ultimos",
  aprbaciones:"aprobaciones",aprovaciones:"aprobaciones",
  exepciones:"excepciones",excepcione:"excepciones",
  audtoria:"auditoria",auditoriaa:"auditoria",
  adminstracion:"administracion",admnistracion:"administracion",
  cronogama:"cronograma",crongrama:"cronograma",
  usarios:"usuarios",usuairos:"usuarios",
  cmpra:"compra",comprs:"compras",copmrar:"comprar",
  credtio:"credito",creidto:"credito",
  cartra:"cartera",
  repotes:"reportes",reprotes:"reportes",
  historcio:"historico",historiall:"historico",
  novedadess:"novedades",novedaes:"novedades",
  operatibo:"operativo",prolongda:"prolongada",funcioens:"funciones",ubicacoin:"ubicacion",
  jornad:"jornada",jornanda:"jornada",jonrada:"jornada",
  blokqueo:"bloqueo",bloqeo:"bloqueo",bloqeos:"bloqueos",
  cortte:"corte",cortee:"corte"
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
