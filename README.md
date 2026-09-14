# CRM Suministros — Electroingeniería S.A.S.

> Versión canónica: **V11.30.0** · build **2026-09-14.01**  
> Producción: Vercel + Supabase `hezjxcxxcjlpmyalftam`  
> Auditoría integral vigente: `docs/AUDITORIA_INTEGRAL_2026-09-14.md`

## 1. Propósito

CRM Suministros centraliza relación comercial, pedidos y operación de suministros desde Ventas hasta el cierre: Cartera, Caja, Compras, Recepción, Alistamiento, Corte, Facturación, Despachos, Inventario, aprobaciones, auditoría, analítica y gestión de actividades.

Las transiciones de negocio no dependen de estados manipulados en el navegador. El frontend solicita acciones a RPC `public.erp_x_*`; PostgreSQL/Supabase valida identidad, roles, propiedad, versión y reglas operativas antes de persistir cambios.

## 2. Arquitectura productiva

```text
Usuario
  │
  ▼
SPA HTML/CSS/ES Modules
  │
  ├── Supabase Auth ───────────── sesión JWT
  ├── public.erp_x_* RPC ──────── lógica de negocio / erp_supply
  ├── Edge Functions ──────────── administración e integraciones server-side
  ├── Google Apps Script ──────── Drive institucional
  └── Vercel ──────────────────── hosting, security headers y Speed Insights
```

El browser no accede directamente a tablas operativas. El esquema `erp_supply` permanece detrás de RLS y contratos RPC. `scripts/validate.mjs` y `scripts/link-check.mjs` hacen cumplir esta frontera.

## 3. Estado V11.30.0

La auditoría de producción del 14 de septiembre de 2026 verificó:

- health check de backend **21/21 OK**;
- 0 pedidos finalizados con tareas activas;
- 0 pedidos activos duplicados;
- 0 saldos negativos de inventario o reservas;
- 0 perfiles operativos activos sin identidad Auth;
- 0 RPC `erp_x_*` ejecutables por `anon`;
- 0 eventos CRM → AuditoriaERP fallidos, vencidos o atascados;
- Vercel sin errores runtime detectados en la ventana auditada;
- CI canónica verde en sintaxis, ES Modules, seguridad, arquitectura, release y smoke desktop/móvil.

Estado detallado: `docs/IMPLEMENTATION_STATUS.md`.

## 4. Integración CRM → AuditoriaERP

Una recepción de mercancía con novedad, avería, faltante, rechazo, estado parcial/no conforme o texto de novedad genera una entrada idempotente para **AuditoriaERP → Recepción**.

```text
warehouse_receipts
   │ trigger
   ▼
auditoria_erp_outbox
   │ pg_net / dispatcher
   ▼
erp-auditoria-bridge
   │
   ▼
AuditoriaERP.recepciones
```

El payload conserva el texto humano digitado en CRM (`noveltyNote`, `informationCaptured`, `verificationNote`, `generalNote`) y usa el marcador determinístico `[CRM_SYNC:<eventKey>]` para no duplicar la recepción destino.

El navegador conserva un fallback autenticado, pero el flujo principal no depende de mantener una pestaña abierta. `scripts/integration-contract-check.mjs` protege este contrato en cada PR.

## 5. Módulos

### Comercial
- Centro de operaciones.
- Pedidos / Ventas.
- Crédito.

### Operación de suministros
- Cartera.
- Caja.
- Compras.
- Recepción de mercancía y Recepción de pedido.
- Alistamiento.
- Corte.
- Facturación.
- Despachos, entregas y cierre.

### Personas y productividad
- Jornada, actividades, planeación, cronograma, evidencias y capacidad.

### Control y análisis
- Inventario.
- Excepciones y aprobaciones.
- Flujo y tiempos / VSM.
- Analítica y reportes.
- Histórico.
- Auditoría.
- Administración.

## 6. Estructura canónica

```text
assets/
  css/
    core-shell.css
    operations.css
    analytics.css
    experience.css
  js/
    app-entry.js          único composition root
    main.js               boot/router
    config.js             configuración pública del browser
    core/
    modules/
    services/
docs/
scripts/
supabase/
  functions/
  migrations/
google-apps-script/
templates/
index.html
service-worker.js
vercel.json
```

No agregar familias CSS, entrypoints o propietarios de módulos paralelos sin actualizar el contrato canónico y pasar CI.

## 7. Desarrollo y validación

Requisitos: Node.js 24 en CI; navegador moderno con ES Modules.

```bash
npm install
npm run validate
npm run serve
```

`npm run validate` ejecuta:

1. arquitectura/invariantes del CRM;
2. grafo ES Modules y detección de huérfanos;
3. scanner/contrato de seguridad;
4. contrato CRM → AuditoriaERP.

La CI añade además Playwright para el shell público desktop/móvil y construye el artefacto desplegable.

## 8. Configuración pública y secretos

`assets/js/config.js` puede contener exclusivamente configuración pública de cliente, incluida la publishable key de Supabase.

Nunca añadir al frontend ni al repositorio:

- `service_role`;
- `sb_secret_...`;
- JWT signing secrets;
- private keys;
- passwords.

Los secretos de integración se mantienen server-side/Vault. La configuración de destino de AuditoriaERP se obtiene mediante RPC service-role-only.

## 9. Edge Functions

`supabase/config.toml` documenta el contrato productivo:

- `erp-admin-users`: `verify_jwt=true`;
- `erp-admin-impersonate`: `verify_jwt=true`;
- `erp-auditoria-bridge`: `verify_jwt=false` deliberadamente, con autenticación propia para browser y token/claim server-to-server para PostgreSQL;
- `erp-auditoria-metrics`: `verify_jwt=false`, endpoint agregado/no PII.

No cambiar estos modos sin revisar su contrato completo. En particular, activar gateway JWT sobre el bridge rompería el dispatcher `pg_net` de base de datos.

## 10. Seguridad

- RLS habilitado en todas las tablas base de `erp_supply`.
- Browser RPC-only para datos operativos.
- Ningún `erp_x_*` disponible para `anon`.
- `SECURITY DEFINER` usa `search_path` controlado y autorización interna según función.
- Funciones sensibles de integración reservadas a `service_role`.
- CORS administrativo por allowlist.
- CSP, HSTS, anti-framing, nosniff, Referrer Policy y Permissions Policy en Vercel.
- Límite local de intentos de login como capa UX; la defensa principal pertenece a Supabase Auth.
- Archivos restringidos por tamaño/tipo en browser y Apps Script.

**Pendiente de plataforma:** Supabase Security Advisor reporta `Leaked Password Protection` deshabilitado. Debe activarse en Auth cuando esté disponible en la configuración del proyecto. No se simula desde código.

## 11. Base de datos y migraciones

No editar producción manualmente para “arreglar un estado” si existe un RPC o transición. Toda modificación de esquema debe quedar en migración reproducible.

Migraciones recientes relevantes:

- 098–101: RLS/performance V11.27.
- 102–107: integración CRM → AuditoriaERP.
- 108: health check integral V11.30.
- 109: contrato observable de integración V11.30.

Antes de promover una migración: CI verde, revisión del SQL, aplicación controlada, health checks posteriores y verificación de Advisors.

## 12. Performance

No convertir automáticamente todas las recomendaciones del Advisor en índices. Las FKs sin índice y los índices sin uso deben evaluarse con volumen, cardinalidad, frecuencia de joins y `pg_stat_statements`; un índice también tiene costo de escritura y mantenimiento.

Durante la auditoría V11.30 los RPC principales medidos se mantuvieron en rangos operativos adecuados para el volumen actual.

## 13. PWA y releases

El service worker es network-first para recursos same-origin y usa cache identificada por release. Al promover versión debe actualizarse de forma coordinada:

- `assets/js/config.js`;
- `package.json` / `package-lock.json`;
- query strings de `index.html`;
- `service-worker.js`;
- invariantes de `.github/workflows/validate-crm.yml`;
- `scripts/validate.mjs`;
- `CHANGELOG.md`.

No hacer bumps parciales.

## 14. QA y despliegue

Un merge a `main` debe pasar la CI canónica. Vercel está configurado para desplegar producción desde `main`; previews de ramas no sustituyen la validación de producción.

Después de un cambio de backend o integración, ejecutar los health checks y comprobar que no existan eventos de outbox fallidos/atascados.

## 15. Operación e incidentes

Consultar:

- `docs/AUDITORIA_INTEGRAL_2026-09-14.md`
- `docs/IMPLEMENTATION_STATUS.md`
- `docs/SECURITY.md`
- `docs/ARCHITECTURE.md`
- `docs/FUNCTIONAL_FLOWS.md`
- `docs/QA_RELEASE_CHECKLIST.md`
- `docs/DEPLOYMENT_VERCEL_SUPABASE.md`
- `docs/OPERATIONS_RUNBOOK.md`

El SQL histórico se conserva por trazabilidad. Cualquier squash futuro debe probarse primero sobre una base vacía antes de retirar migraciones históricas.
