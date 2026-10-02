import { normalizePacoText } from "./normalize.js";
import { fuzzyPhrase } from "./fuzzy-match.js";

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
