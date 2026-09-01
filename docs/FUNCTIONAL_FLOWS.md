# Flujos funcionales ERP EI

## Pedido

El pedido nace en Ventas con tipo, condición de pago, ruta, cliente, dirección, ítems y flags operativos. El backend calcula la ruta efectiva; el navegador no decide una transición libre.

## Financiero

- **PVC / crédito con validación:** Cartera valida según reglas de negocio.
- **PVN / retenido por Caja:** Caja interviene antes de continuar.
- Las decisiones quedan registradas como validaciones/eventos, no como edición silenciosa de estados.

## Compras

Cuando el pedido requiere compra, el flujo crea la etapa correspondiente y controla llegada/OC. Una orden que no requiere compra no debe quedar detenida artificialmente en Compras.

## Recepción

- Recepción de mercancía registra soportes y cantidades.
- Recepción del pedido permite prechecks y control documental.
- Inconsistencias generan issue/novedad en lugar de alterar directamente estados finales.

## Alistamiento

Consulta disponibilidad, precheck, reservas/asignaciones, material parcial y pendientes. Material que requiere Corte se deriva al centro de corte sin simular disponibilidad terminada.

## Corte

La ejecución se agrupa por referencia. Estados críticos: inicio, ejecución/pausa, final físico, `WAITING_EVIDENCE`, evidencia final y liberación. La evidencia final es parte del cierre operacional y no una decoración del frontend.

## Facturación

Registra factura/validaciones y respeta ownership de la tarea. Los casos que deben retornar a Caja lo hacen mediante RPC de enrutamiento, no alterando el step desde JavaScript.

## Despacho y entrega

Modalidades: entrega en punto, cliente recoge, local y nacional. Se registran guía, ubicación y evidencia según corresponda. El cierre solo ocurre cuando se cumplen los requisitos del backend.

## Aprobaciones/excepciones

Solicitudes de cancelación, prioridad, cambio de ruta y otras excepciones se modelan como solicitudes con permisos `canDecide`. Auditoría es solo lectura y no debe convertirse en ejecutor de una decisión operacional.

## Workforce

Catálogo de actividades, propuestas/asignaciones, aprobación, inicio, pausa, reanudación, evidencia, finalización y revisión. El objetivo es medir trabajo sin permitir editar arbitrariamente el ledger de tiempo.

## Auditoría

Consulta de eventos y trazabilidad. Los roles de auditoría no deben poseer mutaciones operativas. Cualquier hallazgo que exija corrección debe generar el flujo de excepción/autorización correspondiente.
