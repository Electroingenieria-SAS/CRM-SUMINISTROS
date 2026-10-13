# Evidencia de integración TCC y cotizador

Repositorio: Electroingenieria-SAS/CRM-SUMINISTROS. PR #116.
Base: f6335ef8405f6438dd053d29f9d228e362dd7d1d.
Proyecto comprobado por configuración y consulta SQL: hezjxcxxcjlpmyalftam.

## Datos efectivos en Supabase

| Verificación | Resultado SQL |
|---|---:|
| Registros | 30107 |
| Tarifas PAQ numéricas | 30086 |
| Tarifas NULL | 21 |
| MSJ conservados | 30107 |
| IDs únicos | 30107 |
| Orígenes | 23 |
| Segunda importación mediante el mismo importador | 30107, sin duplicados |
| Cali → Tuluá, tarifa/kg | 953 |

San Pablo, Bolívar, origen Cali: TCC_1029_06 / BUCA / 3614; TCC_1030_06 / CART / 2778. Ambos permanecen seleccionables por posición y C.O.
Checksum CSV sin modificar BOM ni CRLF: 4478d37ecde4f01a41dfaff2b460a5b0fa6fa35b4c1f9d416456173a06d53715.
Git blob CSV: 30b970dedc49c851ea9f84e726cb32154c7603d1.

## Pruebas ejecutadas

- npm run validate: 212 pruebas de dominio, 0 fallos, contratos históricos, arquitectura, seguridad, ledger y PWA verdes.
- bash scripts/ci/check-javascript-syntax.sh: verde.
- package-frontend.sh, con GITHUB_SHA del commit publicado: artefacto generado. CSV y scripts de importación no se incluyen en el frontend.
- supabase/tests/freight-quotes-verification.sql: PASS, fixture 22872 COP, umbrales, NULL, cotización sin pedido, duplicación, permisos anónimos/importador/pedido externo. Todas las escrituras de prueba se revierten.
- supabase/tests/freight-quote-incomplete-weights.sql: reprodujo predicción indebida antes de corregir; PASS después. No se calcula con pesos incompletos ni cantidades inválidas.
- supabase/tests/freight-quote-order-visibility.sql: PASS con vendedor real y pedido no visible; no permite vincular ni filtrar datos reales de guía.
- RLS activo en las cuatro tablas nuevas. anon no ejecuta calculate; authenticated no ejecuta import. Cotizaciones ficticias persistentes al finalizar pruebas: 0.
- Revisión independiente: tres hallazgos importantes resueltos (eventos de departamento, permisos de pedido y pesos incompletos).

## Comportamiento

Crear pedido conserva dirección y operación comercial, sin cotización, consultas ni nuevos metadatos predictivos. Las guías siguen guardando costo observado por su RPC original. La evaluación existente toma un snapshot de cotización vinculada sólo si el cálculo y vínculo anteceden al despacho, conservando snapshots antiguos como respaldo. No se modifican parámetros de EI_FREIGHT_RIDGE_WEIGHT ni se entrenan tarifas como costos observados.

Cotización de fletes permite usar referencias históricas por ruta literal, confirmar bultos/materiales, guardar/duplicar y vincular a pedido visible. Desde gestión de pedido se pueden precargar materiales/destino, exigiendo desambiguar homónimos. La precarga no vincula ni modifica el pedido.

## Despliegue y segunda fase

E2E tests/freight-quotes.spec.js agregado al workflow existente para Chromium, móvil, iPhone y tableta. Validación local del cotizador en Chromium 153 completada: calcular, invalidar al editar, guardar, duplicar y cero escrituras de pedidos. Anchos 375/768/1024/1440 sin desbordamiento horizontal. Capturas en evidence/. La ejecución efectiva y resultado de CI se consultan en el PR.

ENVÍA pendiente del prompt de Claude, no aportado. carrierAdapters está preparado para otra estrategia sin reutilizar la fórmula TCC por suposición.

Prueba adicional SQL: order-without-freight.sql ejecutó el RPC real de creación con material Siesa válido, sin campos de flete ni cotización. PASS y ROLLBACK, sin pedido ficticio persistente.

Regresión local adicional: siete pruebas Playwright de pedidos, Drive, jornada, recepción, alistamiento y límites/foco de formularios: 7/7 PASS. El cotizador tiene etiquetas accesibles estables para selects, verificadas mediante interacción por nombre accesible. Las capturas usan un material y API sintéticos de prueba; el cálculo y persistencia reales se verificaron por separado en SQL.
