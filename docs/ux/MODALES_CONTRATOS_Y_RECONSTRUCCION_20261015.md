# Modales del CRM · Inventario y reconstrucción controlada

Fecha de corte: 15/10/2026 · Repositorio `CRM-SUMINISTROS` · Rama `refactor/modal-flow-contracts-audit-20261015`

## Objetivo y límites

Cada ventana debe permitir completar la tarea con los menores datos posibles, conservar los valores conocidos y exponer siempre la acción legítima para **guardar, continuar, volver, cancelar o cerrar**, sin decidir por el usuario ni saltarse validaciones del servidor. No se reescribe el CRM de una vez ni se borran módulos, datos, permisos, migraciones o bitácoras.

## Inventario reproducible

Ejecutar `node scripts/architecture/audit-dialog-flows.mjs --json`. Recorre los módulos y dominios JavaScript buscando constructores de diálogo, asistentes, paneles de tarea, diálogos nativos y ventanas operativas. Su salida enumera propietarios y señala candidatos a revisión cuando no se detectan acciones/controles de cierre en **ese archivo**. Estas señales no prueban que falten botones: la acción puede provenir de un shell compartido.

## Matriz de familias y contrato de navegación

| Familia | Componente propietario / punto de revisión | Acciones que no deben desaparecer |
|---|---|---|
| Diálogo transversal | `core/ui/dialog.js` | Confirmar, cancelar, cerrar y reintentar si el servidor rechaza |
| Asistente multipaso | `core/ui/wizard-*.js` | Anterior, continuar, guardar al final y cancelar |
| Acción lateral | `core/ui/task-panel.js` | Confirmar, cancelar, cerrar y regreso al proceso principal |
| Creación comercial | `domains/orders/create/` | Registrar pedido, avanzar materiales, validar cantidades, cancelar |
| Datos complementarios | `domains/orders/create/client-extra-dialog.js` | Omitir datos opcionales, agregar y continuar, volver |
| Cartera / Caja | `domains/finance/ui/status-dialog.js` | Guardar estado, exigir pago solo al cerrar Caja, cancelar |
| Compras y Recepción | `modules/queue.js`, `domains/receiving/` | Tomar/continuar tarea, registrar novedad o recepción |
| Alistamiento y Corte | `domains/picking/`, `modules/cutting-flow.js` | Tomar, registrar resultado, guardar y continuar |
| Facturación | `domains/billing/` | Cargar/guardar documento, continuar, resolver rechazo |
| Despachos local/nacional | `domains/logistics/shipping/`, `domains/logistics/local-dispatch/` | Cargue, liquidación, continuar a cierre o tomar otro |
| Fletes | `domains/freight-quotes/quote-dialogs.js` | Cotizar, duplicar, vincular a pedido, cancelar vínculo |
| Inventario | `modules/inventory-dialogs-v11260.js` y dominio inventario | Registrar movimiento, validar y cancelar |
| Jornada y actividades | `domains/workforce/` | Registrar, confirmar, volver, cancelar |
| Administración | `modules/admin-center-v11160.js` | Guardar cambios, confirmar acciones críticas, cerrar |

Las carpetas representan **grupos de flujos**, no una certificación visual individual de todas sus ventanas.

## Defectos confirmados de la base compartida y solución aplicada

1. Un `modal()` cerraba tras `onConfirm()` aunque retornara `false`. Ahora permanece abierto y reactiva el botón.
2. Un `wizard()` cerraba tras `onFinish()` que retornara `false`. Ahora retiene el último paso, su contenido y el botón para reintentar.
3. El `taskPanel()` podía mantener Confirmar deshabilitado cuando `onConfirm()` devolvía `false`. Ahora lo rehabilita.
4. El mejorador visual global enviaba Enter directamente a Confirmar en diálogos sin contrato para hacerlo. Ahora requiere permiso explícito `data-enter-confirms="true"`; los formularios nativos conservan su funcionamiento.
5. El validador construía HTML con etiquetas de campos; ahora crea nodos con `textContent`.
6. La mejora global cambiaba valores al salir del campo mediante un `trim()` silencioso, sin disparar eventos; ese comportamiento se retiró.
7. Los asistentes ya describen cada paso: no inyectarles otro bloque genérico de ayuda ni eliminar automáticamente explicaciones creadas por su propio dominio.

## Pruebas y gates mínimos

- `scripts/tests/modal-flow-contracts.test.mjs`: conserva CTA semánticas y guardas estáticas.
- `tests/modal-flow-regression.spec.js`: navegador real: `false` no cierra, reintento habilitado, Enter no confirma accidentalmente, texto de validación no interpreta HTML.
- Gates existentes: seguridad/XSS, arquitectura de dominios, PWA, responsive, navegador público y E2E autenticado.
- Integrar solo si todas las pruebas aplicables terminan en verde; preservar rollback vía PR y squash.

## Siguientes lotes (NO implementados aún)

**Lote A — Flujos de pedidos y Finanzas:** medir formularios, eliminar campos duplicados solo después de verificar datos maestros y validaciones server-side; CTA `continuar` siempre localizable.

**Lote B — Compras, Recepción, Picking, Corte, Facturación:** rutas de error, carga de evidencias, controles de espera/bloqueo, botones visibles en móvil, prevención de dobles guardados.

**Lote C — Despachos, fletes, Inventario, Jornada, Administración:** pruebas de pasos integrados, inputs condicionales, drawers/cotizadores y regreso al flujo, permisos por rol.

**Lote D — Acabado visual:** jerarquía de la información, cuadrícula coherente, etiquetas cortas, acceso teclado, medición de INP y tamaños de pantalla; solo después de certificar contratos funcionales.

No hacer `reset`, `force-push` ni borrar archivos por criterios de nombre. En particular no tocar migraciones Supabase o registros de auditoría por este rediseño de UI.
