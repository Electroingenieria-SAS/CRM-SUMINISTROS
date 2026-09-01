# Auditoría integral ERP EI — 1 de septiembre de 2026

## Alcance

Esta auditoría toma como línea base el paquete **BORRADOR-ERP-EI--main (6).zip** y contrasta su runtime con el proyecto Supabase **hezjxcxxcjlpmyalftam**. Se revisaron arquitectura, dependencias, navegación, contratos JavaScript, accesos a datos, autenticación, usuarios, RLS, Edge Functions, cargas de archivos, seguridad del navegador, consistencia básica de flujo y avisos de los Security/Performance Advisors.

## Resultado ejecutivo

La base es recuperable y está mejor estructurada de lo que su acumulación histórica de archivos hacía parecer. El runtime productivo trabaja mediante RPC y no hace acceso directo a tablas desde el navegador. RLS está habilitado en las tablas públicas revisadas. La Edge Function de administración exige JWT y utiliza `service_role` únicamente en servidor.

Los problemas principales encontrados fueron: residuos de QA/Sandbox que el propio validador marcaba como incompatibles con producción; logs del navegador que podían incluir payloads sensibles; un mensaje de error sin escape; CORS administrativo wildcard; CDN de Supabase fijada solo a major; validación insuficiente de tipos de archivo; mínimo de contraseña de ocho caracteres; deuda de Security Advisor sobre funciones `SECURITY DEFINER`; protección de contraseñas filtradas desactivada; y deuda de índices/performance en el esquema operativo.

## Auditoría funcional estática

- `npm run validate`: **OK** después de limpieza.
- 39 archivos JavaScript de producción revisados.
- 0 contratos ES Modules rotos.
- 0 referencias productivas QA/Sandbox.
- 0 accesos `.from(...)` a tablas desde navegador; la aplicación utiliza RPC.
- Consola Super Admin integrada con Edge Function `erp-admin-users` y `verify_jwt=true`.
- Service Worker conserva fallback solo para navegación.
- UI respeta contratos backend `canDecide`, `canTake` y ownership en varios flujos críticos.

### Invariantes comprobados en la base

| Control | Incidencias |
|---|---:|
| Pedidos CLOSED/CANCELLED con tarea operativa activa | 0 |
| Pedidos activos sin ninguna tarea operativa activa | 0 |
| Ítems de pedido huérfanos | 0 |
| Más de una sesión abierta para una misma tarea | 0 |

Estos controles demuestran consistencia estructural, pero no sustituyen una campaña E2E autenticada por cada rol. Para una liberación definitiva se debe recorrer la matriz de pruebas de `docs/QA_RELEASE_CHECKLIST.md` con usuarios de prueba de cada perfil.

## Usuarios

Estado observado en Supabase al 2026-09-01:

- 33 perfiles ERP.
- 21 perfiles activos.
- 12 perfiles inactivos.
- 32 cuentas Supabase Auth.
- 0 cuentas Auth sin confirmar.
- 0 cuentas baneadas.
- 0 enlaces de perfil que apunten a una cuenta Auth inexistente.
- 1 perfil ERP sin `auth_user_id`; revisar antes de eliminar porque puede corresponder a un perfil precreado deliberadamente.

Distribución de roles observada: super_admin 1, gerencia 1, jefe_logistica 1, coordinador_logistico 1, ventas 3, cartera 1, caja 1, compras 1, recepcion_mercancia 1, aux_logistica 5, auxiliar_corte 2, despacho_nacional 1 y auditoria 2.

## Seguridad aplicada en esta reconstrucción

1. Scanner local de secretos (`npm run security`).
2. `.gitignore` para `.env`, claves privadas, keystores y artefactos de pruebas.
3. `.env.example` sin secretos.
4. Clave `service_role` restringida a Edge Function; jamás en browser.
5. Clave browser tipo `sb_publishable_...`, que es pública por diseño y cuya seguridad depende de RLS/autorización.
6. Supabase JS fijado a versión exacta `2.111.0`.
7. CORS de `erp-admin-users` cambiado de `*` a allowlist `ERP_ALLOWED_ORIGINS`.
8. Password mínimo de administración elevado a 12 caracteres.
9. Defensa de navegador de 10 intentos fallidos/15 min. Debe complementarse con rate limit real de Supabase Auth.
10. Payloads y contraseñas retirados de logs de error del navegador.
11. Error dinámico en `main.js` escapado antes de entrar en `innerHTML`.
12. Política de carga de archivo por tamaño, extensión y tipo; bloqueo explícito de ejecutables, HTML, SVG y scripts.
13. Mismo bloqueo de archivos añadido en el Apps Script, creando defensa en profundidad.
14. `vercel.json` con HSTS, CSP, nosniff, anti-framing, Referrer Policy, Permissions Policy y HTTPS upgrade.
15. Eliminación del servidor `http-server` como dependencia de desarrollo; servidor local ahora usa únicamente Node estándar.
16. `package-lock.json` generado sin dependencias externas NPM del proyecto.
17. CSS adicional de foco visible, targets táctiles, responsive y `prefers-reduced-motion`.
18. Migración `074_security_performance_hardening_v10_33_1.sql` aplicada el 2026-09-01 al proyecto `hezjxcxxcjlpmyalftam` y versionada en el repositorio para endurecer grants y corregir dos avisos inequívocos de performance.

## Archivos eliminados por evidencia objetiva

Se eliminaron porque el validador de producción V10.33.1 exige expresamente su ausencia o porque dependían del Sandbox retirado:

- `assets/js/modules/qa.js`
- `assets/js/modules/qa-total.js`
- `assets/js/modules/qa-flow.js`
- `assets/js/modules/sandbox.js`
- `tests/qa-total/`
- `tests/load/erp-capacity.js`
- `supabase/functions/erp-e2e-bot/`

No se borró el histórico SQL masivo ni migraciones antiguas sin demostrar antes que existe un bootstrap nuevo equivalente. Borrarlas solo por “verse antiguas” sería una pérdida de trazabilidad y podría impedir reconstruir una base desde cero.

## Hallazgos pendientes de configuración de plataforma

Los siguientes controles no deben fingirse como “aplicados en código”, porque son settings del proyecto/plataforma:

- **Leaked password protection:** Security Advisor la reporta desactivada. Activar en Auth > Providers/Password Security si el plan lo permite.
- **Rate limit Auth:** configurar el endpoint de login en Auth > Rate Limits con política equivalente a máximo 10 intentos dentro de la ventana empresarial escogida.
- **CAPTCHA/Turnstile:** activar en Auth para login, recuperación y cualquier registro habilitado.
- **SSL enforcement de Postgres:** verificar/activar en Database Settings.
- **Network Restrictions:** aplicar cuando estén definidas las IP de administración/CI que necesiten conexión directa a Postgres.
- **MFA de administradores:** recomendable para cuentas Supabase/GitHub y, si la operación lo admite, usuarios ERP privilegiados.
- **Log drains / alertas:** conectar si se requiere SIEM o monitoreo externo.

## Performance

El Performance Advisor reporta numerosas claves foráneas sin índice en `erp_supply`. No se recomienda crear todos los índices de forma mecánica: cada índice acelera lecturas concretas pero encarece INSERT/UPDATE y almacenamiento. Priorizar con `pg_stat_statements` y consultas reales los campos de filtros/joins calientes: pedidos, tareas, aprobaciones, corte, inventario y workforce.

Avisos inequívocos corregibles:

- `public.profiles.profiles_read_v8`: `auth.uid()` por fila; migración 074 aplicada lo convierte a `(select auth.uid())`.
- índice duplicado en `erp_supply.financial_validations`: migración 074 aplicada conserva uno y elimina el duplicado.

## Criterio de liberación

No declarar “versión perfecta” hasta cumplir simultáneamente:

- `npm run validate` en verde.
- Security Advisor sin WARN críticos no aceptados.
- pruebas E2E por rol completadas.
- no existen secretos en Git history.
- dominio Vercel definitivo añadido a CORS y Apps Script.
- CAPTCHA/rate limits/password security verificados en Supabase.
- restauración/backup probados.
- migraciones ejecutadas primero en staging o branch de Supabase.
