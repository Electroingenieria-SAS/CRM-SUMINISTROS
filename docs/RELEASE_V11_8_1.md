# CRM Suministros V11.8.1

Release de remediación posterior a auditoría V11.8.

## Alcance validado

- Coherencia UI/permisos en Histórico, Crédito y Recepción.
- Protección de rutas frente a módulos sin permiso de lectura.
- Contrato de `NO_DELIVERY` alineado entre UI y backend.
- Prioridades operativas canónicas: Baja, Media y Urgente.
- Plantilla histórica CSV incorporada al deployment y Service Worker.
- Eliminación de residuos frontend V11.4 y servicios Drive sin consumidores.
- Retiro de API V8/V9 sustituida por `erp_x_*`.
- Endurecimiento de `search_path` y grants de RPC.
- Índices relacionales selectivos sobre tablas operativas de crecimiento.
- CI permanente de sintaxis, dependencias estáticas y contrato de release.
- Artefacto desplegable conservado por GitHub Actions durante 90 días.

Las tablas históricas V8 se conservan como evidencia/datos legacy; no forman parte del runtime de V11.8.1 y no se eliminan para evitar pérdida de información.
