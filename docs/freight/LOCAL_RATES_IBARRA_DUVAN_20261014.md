# Transporte local · Tarifas internas suministradas (14/10/2026)

## Fuente y personas
- Archivo importado: `data/freight/local/ibarra-routes.csv`, 54 registros.
- Original de usuario: `tarifas_rutas_luis_ibarra_CRM.csv`, SHA-256: `7be632a885a842222e97f86ae4f6c5af2b1b696aac43bbf43fc4d1169ff97f5d`.
- El CSV incluye el nombre Luis Ibarra como referencia del archivo, **no identifica al conductor**. El enrutamiento establecido de `LOCAL_DISPATCH` pertenece al perfil de coordinación Duván Díaz, pero no se asigna su nombre como conductor del vehículo sin registro documental.
- Tabla original de 60 rutas queda disponible para trayectos históricos que ya existían; los 54 precios CSV son la nueva matriz de selección y la referencia SQL por `source_version`.

## Modelo exacto
- Base para un peso hasta 1.000 kg.
- Desde 1.001 a 2.500 kg inclusive: `flete = base + ceil(max(0,peso_kg - 1000)) × valor_kg_adicional`.
- Sobre 2.500 kg: no se extrapola y requiere gestión de precio especial.
- Recargos de descargue/auxiliar y desvío/subruta urgente se suman *aparte*, con motivo obligatorio.
- No se aplica un margen arbitrario o IPC sin fuente; el cotizador presenta **precio de la matriz interna**, no precio vigente verificado de una transportadora externa.
- Números en COP, fuente/version reproducible y jamás mezclados con guías TCC/ENVÍA.

## Dominio operativo
El usuario de Despacho local utiliza el flujo existente de factura/peso/destino/placa/conductor;
la vista se recalcula inmediatamente al editar los campos. La función del servidor mantiene
el control sobre el valor definitivo y guarda versión de matriz en metadatos de la entrega.
Tras despachar, el módulo de Gestión de costos conserva auditoría, justificación,
conceptos `AYUDANTE`, `PARADA_ADICIONAL`, `DESCARGUE`, `DESVIO`, etc.,
y hasta 3 revisiones según su contrato vigente; no se aumenta ese límite silenciosamente.

## Cotizador
La opción `LOCAL` usa un selector independiente por tres categorías, exclusivamente
desde Tuluá. El peso es obligatorio, no se simulan conversiones volumétricas ni se
muestran opciones TCC/ENVÍA con rutas que no tengan documentación comparable.
Guarda `LOCAL` en `erp_supply.freight_quotes`; el historial sólo muestra
un costo real local cuando corresponde a `VEHÍCULO LOCAL`.

## Secuencia de despliegue
1. Revisar/aprobar la fuente CSV y su relación comercial con el conductor.
2. Validar SQL con pruebas y autorización: aplicar las migraciones
   `20261014215409_local_freight_ibarra_54_routes_20261014.sql` y
   `20261014215415_local_dispatch_quoted_weights_20261014.sql` a Supabase.
3. Ejecutar smoke SQL y controles de permisos; recién después fusionar
   la UI a `main` y publicar GitHub Pages.
4. Ensayar manualmente un pedido local real con Duván y comprobar el total
   de retorno frente a la liquidación sin duplicar sobrecostos.
