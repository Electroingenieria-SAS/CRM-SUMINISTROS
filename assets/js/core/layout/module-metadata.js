const MODULE_METADATA={
  dashboard:["Centro de operaciones","Indicadores, cargas y prioridades de la operación"],
  orders:["Pedidos","Consulta, trazabilidad y gestión integral"],
  sales:["Ventas y pedidos","Creación y seguimiento comercial"],
  credit:["Crédito","Radicación, estudio y decisión"],
  cartera:["Cartera","Validación financiera y liberación"],
  caja:["Caja","Retenidos y facturación de pedidos PVN"],
  purchasing:["Compras","Abastecimiento y órdenes PVE"],
  receiving:["Recepción","Recepción de mercancía para bodega y Recepción de pedido como procesos separados"],
  picking:["Alistamiento","Preparación, controles y novedades"],
  cutting:["Centro de corte","Referencias agrupadas, carretos y entrega a Alistamiento"],
  billing:["Facturación","Factura, soporte y liberación"],
  shipping:["Despachos y entregas","Rutas, recogidas, evidencias y cierre"],
  inventory:["Inventario","Existencias, lotes, ubicaciones y movimientos"],
  workforce:["Jornada y actividades","Planeación, cronograma, evidencias y capacidad"],
  approvals:["Excepciones y aprobaciones","Novedades, reportes, decisiones y SLA"],
  vsm:["Flujo y tiempos","Tiempo total, trabajo productivo, espera y productividad"],
  reports:["Analítica y reportes","Indicadores, causas y exportaciones"],
  imports:["Histórico de pedidos","Archivo histórico, expedientes, importaciones y trazabilidad"],
  audit:["Auditoría","Registro de decisiones y movimientos"],
  admin:["Administración de CRM Suministros","Usuarios, roles, calendarios y configuración"]
};

export function getModuleMetadata(moduleId){
  return MODULE_METADATA[moduleId]||["CRM Suministros",""];
}
