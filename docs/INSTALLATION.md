# Instalación, recuperación y nuevos entornos

CRM Suministros es una SPA estática en Vercel y utiliza Supabase como backend. Este documento reemplaza las instrucciones históricas que remitían a `sql/00_INSTALL_ALL.sql` y a un workflow `pages.yml` que ya no forman parte del runtime canónico.

## Antes de crear un entorno

Lea primero:

- `docs/DISASTER_RECOVERY.md`;
- `supabase/production-migration-ledger.json`;
- `docs/DEPLOYMENT_VERCEL_SUPABASE.md`;
- `docs/SECURITY.md`.

No ejecute SQL histórico indiscriminadamente sobre un proyecto vacío o productivo.

## Base de datos

La base productiva contiene una deuda histórica congelada de migraciones aplicadas fuera del árbol actual. Por esa razón, V11.32.0 **todavía no certifica un rebuild source-only desde PostgreSQL vacío**.

Para un entorno que deba representar fielmente producción, utilice un snapshot/branch/restauración aprobada del esquema vigente y luego aplique únicamente las migraciones versionadas pendientes de `supabase/migrations/`.

Toda migración nueva debe existir en Git antes de aplicarse.

El control local es:

```bash
npm run db:ledger
```

## Frontend

Requisitos de desarrollo/CI: Node.js 24 o posterior compatible.

```bash
npm install
npm run validate
npm run serve
```

La aplicación se sirve desde la raíz y `index.html` es el único documento de entrada. No cree entrypoints paralelos.

## GitHub Actions

El único workflow canónico es:

`.github/workflows/validate-crm.yml`

En Pull Request ejecuta validación estática, seguridad, secret scanning, análisis de dependencias, CodeQL y E2E público/autenticado. En `main` además produce el artefacto desplegable y el preview de GitHub Pages.

Los Repository Secrets requeridos para el gate autenticado son:

- `ERP_QA_EMAIL`;
- `ERP_QA_PASSWORD`.

La cuenta QA debe tener acceso a los módulos críticos cubiertos por Playwright y no debe utilizarse para trabajo cotidiano.

## Supabase Auth

Después de crear/restaurar un entorno:

1. configure los proveedores de autenticación requeridos;
2. habilite Leaked Password Protection;
3. revise límites de Auth y anti-bot conforme a la política institucional;
4. confirme que perfiles y `auth.users` estén correctamente vinculados;
5. no almacene contraseñas ni service role en Git.

## Edge Functions

Despliegue las funciones desde `supabase/functions/` respetando `supabase/config.toml`.

V11.32.0 exige:

- `erp-admin-users`: JWT;
- `erp-admin-impersonate`: JWT;
- `erp-auditoria-metrics`: JWT;
- `erp-auditoria-bridge`: autenticación propia porque también recibe el dispatcher server-to-server de PostgreSQL.

## Google Drive

Configure los orígenes OAuth/Apps Script para el dominio real del entorno. El cliente utiliza alcance `drive.file`; los secretos del bridge pertenecen al servidor, no a `assets/js/config.js`.

## Validación antes de usar datos reales

El entorno debe aprobar:

```bash
npm run validate
```

y la CI completa del Pull Request.

Además, en backend deben revisarse los health checks e invariantes descritos en `docs/QA_RELEASE_CHECKLIST.md`. Un entorno no se considera equivalente únicamente porque abra el login.

## Importación histórica

La plantilla vigente es `templates/historical_orders.csv`. La importación debe realizarse mediante los contratos RPC del sistema y nunca mediante inserts manuales a tablas operativas.

## Prohibiciones

No:

- ejecutar un instalador histórico como si fuera baseline actual;
- modificar tablas productivas para corregir incidencias que tienen RPC;
- aplicar DDL sin migración versionada;
- reutilizar secretos de producción en repositorios o logs;
- desactivar RLS para facilitar una instalación;
- omitir la CI autenticada antes de promover cambios.
