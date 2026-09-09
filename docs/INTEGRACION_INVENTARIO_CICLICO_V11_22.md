# Integración Inventario Cíclico → CRM Suministros

**Objetivo de rama:** `feature/inventario-ciclico-inteligente-v11-22`  
**Base auditada:** CRM Suministros V11.21.1 build 2026-09-08.12  
**Aplicativo fuente:** `Electroingenieria-SAS/inventario-ciclico`

## Decisión arquitectónica

Inventario Cíclico no se integra como una segunda aplicación ni como un iframe. Se extrae su núcleo útil y se monta sobre el dominio canónico del CRM.

La fuente de verdad continúa siendo:

- `erp_supply.material_master`: identidad oficial Siesa.
- `erp_supply.inventory_items`: material operativo CRM.
- `erp_supply.inventory_lots`: saldos, ubicaciones y lotes.
- `erp_supply.inventory_movements`: ledger único de movimientos y conteos.
- `erp_supply.orders` + `order_items` + `material_reservations`: señal de demanda real.
- `erp_x_vsm`: contexto de presión operativa del CRM.
- `erp_supply.roles` + `role_module_permissions`: autorización única.

No se crean tablas espejo para tareas, conteos, casos ni memoria de referencias.

## Auditoría funcional: conservar / adaptar / retirar

| Función del aplicativo fuente | Decisión | Implementación CRM |
| --- | --- | --- |
| Pareto ponderado anual | **Conservar y mejorar** | Motor híbrido: ABC costo/rotación Siesa + costo + consumo + movimientos + pedidos + reservas + diferencias + antigüedad. |
| Selección aleatoria sin repetición | **Conservar** | Semilla determinística por fecha/referencia; no se puede “recargar” hasta obtener una muestra más fácil. |
| Meta diaria hasta cerrar año | **Conservar** | Meta automática según pendientes y días laborables configurados en el CRM, con tope de 30. |
| Conteo ciego | **Conservar** | Captura sin saldo esperado y cubriendo todos los lotes/ubicaciones activas de la referencia. |
| Reconteo por diferencia | **Conservar y simplificar** | Una diferencia marca el último batch como `recountRequired`; la referencia vuelve con prioridad máxima. |
| `referenceMemoryV2` | **Retirar** | El ledger `inventory_movements` es la memoria: fecha, actor, exactitud, delta, batch y resultado. |
| `countTasks` | **Retirar** | El plan diario es calculado por el motor, reproducible y derivado del ledger; no se mantiene una cola paralela. |
| colección `counts` | **Retirar** | Exactos y diferencias se registran en `inventory_movements`. |
| colección `cases` | **Retirar en esta integración** | El reconteo se deriva del último batch. Escalamientos complejos podrán usar el centro de Excepciones del CRM, no una colección propia. |
| Firebase Auth / Firestore | **Retirar** | Supabase Auth + perfiles/roles del CRM. |
| Gestión de usuarios propia | **Retirar** | Administración canónica del CRM. |
| PWA/service worker propio | **Retirar** | PWA canónica del CRM. |
| Router/menú propios | **Retirar** | Subvistas dentro del módulo Inventario. |
| CSS/UI propios | **Retirar** | Se reutilizan las cuatro familias CSS canónicas del CRM; no se crea una quinta hoja. |
| Carga Excel/Drive propia | **Retirar** | Se usa `material_sync` Siesa ya existente. |
| Catálogo de materiales propio | **Retirar** | `material_master` oficial Siesa. |
| QR/etiquetas propias | **Retirar** | Scanner/etiquetado ya existente en Inventario. |
| Offline queue propia | **No migrar** | Se evita un segundo mecanismo de consistencia. La operación crítica queda transaccional en Supabase. |
| Metraje de cables cada ~15 días | **Posponer como política especializada** | El CRM ya identifica `CUTTABLE`; primero se integra el motor general. Si se requiere, se añadirá una política de muestreo específica sin otro módulo. |
| Dashboard gerencial | **Conservar y ampliar** | Contabilización restringida a `super_admin` y `gerencia`: valor, Pareto, estrellas, brechas, cobertura, exactitud y VSM. |
| Indicadores de exactitud/productividad | **Conservar parcialmente** | Exactitud y cobertura quedan en V11.22; productividad por persona se integrará con People Analytics si se requiere, evitando duplicar métricas. |
| Fotos/soportes por diferencia | **No duplicar** | No se crea otro Drive. La evolución correcta es enlazar evidencia al sistema documental/Excepciones del CRM. |

## Motor de priorización V11.22

El aplicativo fuente dependía de un score propio y de memoria Firestore. La integración toma la idea pero usa señales que ya existen en Siesa y CRM.

### Baseline Siesa

- ABC por rotación (`abcTurns`).
- ABC por costo (`abcCost`).
- valor de inventario (`lastCostTotal` / `averageCostTotal`).
- consumo promedio (`averageConsumption`).
- última salida y último consumo.

### Aprendizaje CRM

- movimientos del ledger en 365 días.
- salidas y variabilidad.
- demanda proveniente de pedidos.
- reservas activas.
- diferencias de conteos anteriores.
- antigüedad desde el último conteo.

### Selección

La selección diaria mezcla criticidad y aleatoriedad determinística. El objetivo es evitar dos extremos: contar siempre las mismas referencias de alto valor o hacer una muestra puramente aleatoria sin impacto económico.

Las bandas adaptativas son: **A+ / A / B / C / D / E**. Los reconteos abiertos reciben prioridad superior al Pareto normal.

## VSM

No se replica el motor VSM. Para `super_admin` y `gerencia`, el control de Inventario lee el `erp_x_vsm` existente y presenta WIP, espera/bloqueo, vencimientos, eficiencia de flujo y cumplimiento SLA como contexto de la jornada.

## Seguridad

- `erp_x_inventory_cycle_control`: `SECURITY DEFINER`, `search_path=''`, acceso por módulo Inventario; datos ejecutivos solo para `super_admin` o `gerencia`.
- `erp_x_inventory_cycle_count`: requiere `inventory.update`.
- No hay acceso directo `.from(...)` desde navegador.
- No se expone `service_role`.
- Los lotes del plan ciego se devuelven sin cantidades.
- Un conteo debe cubrir todos los lotes activos de la referencia.
- La operación se ejecuta con bloqueo de filas y registra un `countBatchId` único.

## Trazabilidad de un conteo

Cada lote genera una entrada en `inventory_movements`:

- exacto: `COUNT_EXACT`, cantidad `0`;
- diferencia positiva: `ADJUSTMENT_IN`;
- diferencia negativa: `ADJUSTMENT_OUT`.

Metadata mínima:

- `source = CYCLIC_COUNT`
- `engineVersion`
- `countBatchId`
- `scheduledDate`
- `blindCount`
- `previousOperationalPhysical`
- `countedPhysical`
- `previousAvailable`
- `targetAvailable`
- `delta`
- `result`
- `batchHasDifference`
- `recountRequired`

Esto permite reconstruir exactitud, cobertura y reconteos sin tablas auxiliares.

## Hallazgos de auditoría de datos al iniciar la integración

- 1.959 materiales activos.
- 2.962 lotes activos.
- El ledger CRM aún tiene poco histórico propio de movimientos, por lo que el motor inicia en etapa de aprendizaje CRM.
- Siesa ya aporta ABC costo/rotación, costos, consumo promedio y fechas de salida/consumo; por ello el baseline inicial es considerablemente más rico que una muestra aleatoria pura.
- Se detecta que `physicalExistence` de la fotografía Siesa puede diferir del saldo operacional del CRM después de picking/movimientos. La vista gerencial muestra esta brecha como **conciliación**, no como error automático.

## UX

Inventario queda organizado en tres vistas dentro del mismo módulo:

1. **Existencias** — funcionalidad V11.21 existente, sin reescritura.
2. **Conteo cíclico** — plan diario y captura ciega para perfiles con `inventory.update`; perfiles ejecutivos pueden consultar el plan.
3. **Contabilización** — solo `super_admin` y `gerencia`, sin capacidad de escritura para Gerencia.

La integración reutiliza el motor visual vigente y no agrega nuevas familias CSS.
