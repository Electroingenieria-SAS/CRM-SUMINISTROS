# Arquitectura CRM Suministros

## Visión general

CRM Suministros es una SPA institucional para el ciclo comercial y logístico de Electroingeniería S.A.S. El frontend utiliza HTML/CSS y JavaScript ES Modules sin framework de build. Supabase/PostgreSQL concentra Auth, autorización y reglas de negocio; Vercel sirve el frontend; Google Apps Script actúa como bridge de Drive institucional.

```text
Browser SPA
  ├─ Supabase Auth (publishable key)
  ├─ public.erp_x_* RPC ───────────────> PostgreSQL / erp_supply
  ├─ Edge erp-admin-users ─────────────> Auth Admin API
  ├─ Edge erp-admin-impersonate ───────> sesión temporal trazable
  ├─ Edge erp-auditoria-metrics ───────> métricas autenticadas/org-scoped
  ├─ Edge erp-auditoria-bridge ────────> integración CRM → AuditoriaERP
  └─ Apps Script Drive Bridge ─────────> Google Drive institucional
```

## Composition root y frontend

- `index.html`: documento único de entrada.
- `assets/js/app-entry.js`: composition root único.
- `assets/js/main.js`: sesión, router y montaje de módulos.
- `assets/js/core/`: estado, layout, router, UI, formateo y componentes transversales.
- `assets/js/modules/`: pantallas y dominios funcionales.
- `assets/js/services/`: Supabase, RPC, Drive, inventario, materiales y lectura documental.
- `service-worker.js`: PWA network-first y cache por release.

`scripts/link-check.mjs` enlaza todos los ES Modules desde `app-entry.js` y falla ante imports rotos o archivos JS huérfanos.

## CSS canónico

Solo existen cuatro familias CSS en `assets/css/`:

- `core-shell.css`;
- `operations.css`;
- `analytics.css`;
- `experience.css`.

Los fragmentos CSS dinámicos externalizados viven en `assets/runtime-css/`. No se agregan nuevas familias canónicas sin modificar el contrato CI.

## Frontera de datos

El navegador no usa `.from()` para tablas operativas. `services/api.js` y servicios de dominio llaman RPC `public.erp_x_*`.

Las mutaciones sensibles deben validar en PostgreSQL:

- identidad/perfil activo;
- organización;
- rol o permiso de módulo;
- ownership cuando aplique;
- versión/idempotencia;
- invariantes del proceso.

El esquema `erp_supply` no concede DML directo a `anon` ni `authenticated` en la línea auditada.

## Seguridad de UI

El browser se considera no confiable.

V11.32.0 añade `sanitizeHtml()` como frontera común en `core/ui.js` para primitivas reutilizables que reciben HTML estructurado. El escape contextual continúa siendo responsabilidad de los módulos, pero tags ejecutables, handlers de evento y URLs/estilos activos se filtran nuevamente antes de insertar contenido en los componentes centrales.

CSP, HSTS, anti-frame y demás headers se configuran en `vercel.json`.

## Administración

`assets/js/modules/admin.js` es el compositor de Administración.

La lógica histórica restante continúa temporalmente en `admin-center-v11160.js`, pero V11.32.0 inicia separación controlada:

- `admin-user-verification-v11320.js`: verificación/impersonación;
- `admin-view-helpers-v11320.js`: primitivas visuales;
- futuras extracciones deben conservar comportamiento y pasar CI antes de retirar código del centro.

Las operaciones Auth privilegiadas pasan por `erp-admin-users`; `service_role` nunca entra al navegador.

## Impersonación

`erp-admin-impersonate` valida Super Admin y genera un acceso temporal para el perfil objetivo.

V11.32.0 añade `erp_supply.admin_impersonation_sessions`. El contexto se propaga con `x-erp-impersonation-session`, pero PostgreSQL comprueba:

- sesión vigente;
- identidad Auth efectiva;
- perfil objetivo;
- organización.

`system_audit` conserva actor original y actor efectivo.

## Integración AuditoriaERP

Las novedades de Recepción se escriben en una outbox. El dispatcher `pg_net` y el reintento `pg_cron` invocan `erp-auditoria-bridge`.

El bridge conserva autenticación propia porque recibe dos clases de tráfico:

- server-to-server con delivery token/claim;
- fallback de browser con JWT de usuario.

Las métricas utilizan otra Edge Function, `erp-auditoria-metrics`, que desde V11.32.0 exige JWT y devuelve únicamente agregados de la organización autorizada.

## Drive

El bridge de Apps Script verifica origen, sesión ERP, tamaño y tipo de archivo antes de guardar en Drive institucional. El frontend solicita alcance `drive.file`; secretos y credenciales de servidor no se versionan.

## Base de datos y DR

`supabase/migrations/` es la fuente obligatoria para todo DDL nuevo.

El historial anterior contiene 27 migraciones productivas database-only. Esa deuda se registra en `supabase/production-migration-ledger.json` y no puede crecer silenciosamente.

Consulte `docs/DISASTER_RECOVERY.md`: hasta certificar un baseline en una base vacía, recuperación operativa y rebuild source-only son procesos distintos.

## CI/CD

`.github/workflows/validate-crm.yml` es el único workflow canónico.

Incluye:

- sintaxis JavaScript;
- grafo ES Modules/huérfanos;
- contratos de seguridad;
- scanner de secretos actual e histórico;
- TruffleHog;
- CodeQL;
- Dependency Review;
- npm audit;
- contrato de migraciones/DR;
- E2E público;
- E2E autenticado desktop/móvil;
- artefacto desplegable.

Vercel solo debe desplegar Production desde `main`.
