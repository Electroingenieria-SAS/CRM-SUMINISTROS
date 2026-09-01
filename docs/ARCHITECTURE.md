# Arquitectura ERP EI

## Visión general

ERP EI es una aplicación web SPA institucional para gestionar el ciclo de pedidos y operación logística de Electroingeniería S.A.S. El frontend es JavaScript ES Modules sin framework de build. La persistencia, Auth, autorización y lógica de negocio viven en Supabase/PostgreSQL; archivos se almacenan en Google Drive mediante un Apps Script institucional autenticado contra la sesión Supabase.

```text
Browser SPA
  ├─ Supabase Auth (publishable key)
  ├─ RPC public.erp_x_* ──> PostgreSQL / erp_supply
  ├─ Edge erp-admin-users ──> Supabase Auth Admin API (service_role server-only)
  └─ Apps Script Drive Bridge ──> Google Drive institucional
```

## Frontend

- `index.html`: shell inicial y librerías externas.
- `assets/js/main.js`: boot, sesión, router y montaje de módulos.
- `assets/js/core/`: state, layout, router, UI, formateo y flujos guiados.
- `assets/js/modules/`: módulos de negocio.
- `assets/js/services/`: API RPC, Supabase, Drive, materiales, PDF y localización.
- `assets/css/app.css`: sistema visual Refined Workspaces + responsive.
- `service-worker.js`: caché de activos/fallback de navegación.

## Backend de datos

La interfaz evita `.from(...)` desde navegador. `services/api.js` concentra llamadas a funciones `public.erp_x_*`. Las funciones validan sesión, organización, rol, ownership y transiciones antes de modificar `erp_supply`.

El esquema `erp_supply` contiene el modelo productivo actual: pedidos, ítems, tareas, sesiones, inventario, compras, recepción, corte, facturación, despacho, aprobaciones, auditoría, workforce y catálogos.

El esquema `public` conserva API/RPC y componentes de compatibilidad/migración que todavía deben evaluarse antes de una futura consolidación.

## Administración de usuarios

`supabase/functions/erp-admin-users/index.ts` es el único punto del frontend para operaciones Auth administrativas. Flujo:

1. Browser invoca Edge Function con JWT.
2. Edge valida JWT contra Auth.
3. Edge invoca `erp_x_admin_user_directory` con el JWT para confirmar permisos Super Admin.
4. Solo entonces usa `SUPABASE_SERVICE_ROLE_KEY` del entorno servidor.
5. Cambios en Auth y perfil ERP se coordinan con rollback compensatorio.
6. Eventos relevantes se auditan.

## Drive

El Browser convierte el archivo a base64 y lo envía por POST a un Apps Script oculto en iframe. El script verifica origen, tamaño, tipo y JWT consultando `erp_x_session`; luego almacena con la identidad institucional y devuelve metadata del archivo. Los empleados no necesitan conceder Drive individualmente.

## Decisiones arquitectónicas de seguridad

- Public key en browser, secretos en servidor.
- RLS y RPC como frontera de autorización.
- Inputs del navegador no se consideran confiables.
- Idempotency keys y expected version se utilizan en mutaciones sensibles donde aplica.
- Auditoría y eventos forman parte del dominio, no solo logs del frontend.
